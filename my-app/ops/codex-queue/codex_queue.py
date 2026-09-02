#!/usr/bin/env python3
"""Small, dependency-free scheduler for unattended Codex CLI jobs."""

from __future__ import annotations

import argparse
import json
import os
import re
import sqlite3
import subprocess
import sys
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse


DEFAULT_DB = "/home/frankrain/server/data/codex-queue/queue.sqlite"
BUTLER_REPO = "/home/frankrain/server/automation-workspaces/Bulter"
MAX_LOG = 24000
MAX_PROMPT = 20000

SCHEMA = """
CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    prompt TEXT NOT NULL,
    repo_path TEXT NOT NULL,
    session_id TEXT,
    schedule_mode TEXT NOT NULL DEFAULT 'once',
    interval_minutes INTEGER NOT NULL DEFAULT 300,
    next_run_at INTEGER NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'scheduled',
    retry_count INTEGER NOT NULL DEFAULT 0,
    last_run_at INTEGER,
    last_exit_code INTEGER,
    last_output TEXT,
    last_thread_id TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_jobs_due ON jobs(enabled, next_run_at);
"""

QUOTA_RE = re.compile(
    r"usage\s+limit|rate\s+limit|quota|too\s+many\s+requests|try\s+again\s+(?:in|after)|"
    r"reset\s+(?:in|at)|5[- ]?hour|five[- ]?hour|额度|用量.{0,12}(?:不足|用完|限制)|限流",
    re.IGNORECASE,
)
ATTENTION_RE = re.compile(
    r"need(?:s|ed)?\s+(?:your|user|human)\s+(?:input|decision|approval)|"
    r"please\s+(?:choose|confirm|provide)|cannot\s+proceed|merge\s+conflict|"
    r"需要.{0,16}(?:你|用户).{0,12}(?:选择|确认|输入|决定)|请.{0,12}(?:选择|确认|提供)|无法继续",
    re.IGNORECASE,
)
SAFE_SESSION_RE = re.compile(r"^[A-Za-z0-9._:-]{1,160}$")


def now() -> int:
    return int(time.time())


def connect(db_path: str) -> sqlite3.Connection:
    path = Path(db_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path, timeout=30)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA busy_timeout=30000")
    conn.executescript(SCHEMA)
    # A killed worker must not leave a job permanently stuck in "running".
    cutoff = now() - 6 * 60 * 60
    conn.execute(
        "UPDATE jobs SET status='scheduled', updated_at=? "
        "WHERE status='running' AND COALESCE(last_run_at, 0) < ?",
        (now(), cutoff),
    )
    conn.commit()
    return conn


def row_dict(row: sqlite3.Row) -> dict:
    data = dict(row)
    data["enabled"] = bool(data["enabled"])
    return data


def tail(text: str, limit: int = MAX_LOG) -> str:
    return text[-limit:]


def run_command(
    command: list[str], cwd: str, timeout: int = 4 * 60 * 60, env: dict | None = None
) -> tuple[int, str, str]:
    try:
        completed = subprocess.run(
            command,
            cwd=cwd,
            env=env,
            text=True,
            capture_output=True,
            timeout=timeout,
            check=False,
        )
        return completed.returncode, completed.stdout, completed.stderr
    except subprocess.TimeoutExpired as exc:
        stdout = exc.stdout if isinstance(exc.stdout, str) else ""
        stderr = exc.stderr if isinstance(exc.stderr, str) else ""
        return 124, stdout, f"{stderr}\n任务运行超过 4 小时，已停止。"
    except OSError as exc:
        return 127, "", str(exc)


def git_output(repo: str, *args: str) -> tuple[int, str]:
    code, stdout, stderr = run_command(["git", "-C", repo, *args], repo, timeout=900)
    return code, tail((stdout + "\n" + stderr).strip(), 12000)


def prepare_repo(repo: str) -> tuple[bool, str]:
    if not Path(repo, ".git").exists():
        return False, "自动化仓库不存在。"
    code, dirty = git_output(repo, "status", "--porcelain")
    if code != 0:
        return False, dirty
    if dirty.strip():
        return False, "自动化仓库有上次遗留的未提交修改，已暂停，避免覆盖：\n" + dirty
    code, output = git_output(repo, "pull", "--ff-only", "origin", "master")
    if code != 0:
        return False, output
    app_dir = str(Path(repo, "my-app"))
    install_code, install_out, install_err = run_command(
        ["corepack", "pnpm", "install", "--frozen-lockfile"], app_dir, timeout=30 * 60
    )
    install_log = tail((install_out + "\n" + install_err).strip(), 10000)
    return install_code == 0, "\n\n".join(part for part in [output, install_log] if part)


def publish_changes(repo: str, title: str) -> tuple[bool, str]:
    code, dirty = git_output(repo, "status", "--porcelain")
    if code != 0:
        return False, dirty
    if not dirty.strip():
        return True, "没有代码改动，不需要推送。"

    app_dir = str(Path(repo, "my-app"))
    build_code, build_out, build_err = run_command(
        ["corepack", "pnpm", "--filter", "@smart-hub/web", "build"], app_dir, timeout=45 * 60
    )
    build_log = tail((build_out + "\n" + build_err).strip(), 10000)
    if build_code != 0:
        return False, "本地构建失败，未提交：\n" + build_log

    code, add_log = git_output(repo, "add", "-A")
    if code != 0:
        return False, add_log
    message = "codex queue: " + re.sub(r"[\r\n]+", " ", title).strip()[:120]
    env = os.environ.copy()
    env.update(
        {
            "GIT_AUTHOR_NAME": "Butler Codex Queue",
            "GIT_AUTHOR_EMAIL": "frankrainrp@users.noreply.github.com",
            "GIT_COMMITTER_NAME": "Butler Codex Queue",
            "GIT_COMMITTER_EMAIL": "frankrainrp@users.noreply.github.com",
        }
    )
    commit_code, commit_out, commit_err = run_command(
        ["git", "-C", repo, "commit", "-m", message], repo, timeout=900, env=env
    )
    if commit_code != 0:
        return False, tail((commit_out + "\n" + commit_err).strip(), 10000)
    push_code, push_log = git_output(repo, "push", "origin", "master")
    if push_code != 0:
        return False, "提交已创建，但推送失败，需要人工处理：\n" + push_log
    return True, "构建通过，已提交并推送 GitHub；服务器部署器会在 CI 通过后上线。"


def parse_codex_events(stdout: str) -> tuple[str | None, str]:
    thread_id = None
    messages: list[str] = []
    for line in stdout.splitlines():
        try:
            event = json.loads(line)
        except json.JSONDecodeError:
            continue
        event_type = event.get("type")
        if event_type == "thread.started":
            thread_id = event.get("thread_id") or event.get("thread", {}).get("id")
        item = event.get("item") or {}
        if event_type == "item.completed" and item.get("type") == "agent_message":
            value = item.get("text") or item.get("content")
            if isinstance(value, str) and value.strip():
                messages.append(value.strip())
        if event_type in {"turn.failed", "error"}:
            message = event.get("message") or event.get("error")
            if message:
                messages.append(str(message))
    return thread_id, "\n\n".join(messages)


def claim_job(conn: sqlite3.Connection) -> sqlite3.Row | None:
    conn.execute("BEGIN IMMEDIATE")
    row = conn.execute(
        "SELECT * FROM jobs WHERE enabled=1 AND next_run_at<=? "
        "AND status!='running' ORDER BY next_run_at, id LIMIT 1",
        (now(),),
    ).fetchone()
    if row:
        conn.execute(
            "UPDATE jobs SET status='running', last_run_at=?, updated_at=? WHERE id=?",
            (now(), now(), row["id"]),
        )
    conn.commit()
    return row


def finish_job(
    conn: sqlite3.Connection,
    job: sqlite3.Row,
    status: str,
    output: str,
    exit_code: int,
    thread_id: str | None,
    *,
    retry: bool = False,
) -> None:
    enabled = 1
    retry_count = job["retry_count"]
    if status == "waiting_quota":
        next_run_at = now() + job["interval_minutes"] * 60
    elif retry:
        retry_count += 1
        next_run_at = now() + 15 * 60
    elif status == "succeeded" and job["schedule_mode"] == "interval":
        retry_count = 0
        next_run_at = now() + job["interval_minutes"] * 60
        status = "scheduled"
    else:
        next_run_at = job["next_run_at"]
        enabled = 0
    conn.execute(
        "UPDATE jobs SET status=?, enabled=?, next_run_at=?, retry_count=?, "
        "last_exit_code=?, last_output=?, last_thread_id=?, "
        "session_id=COALESCE(?, session_id), updated_at=? WHERE id=?",
        (
            status,
            enabled,
            next_run_at,
            retry_count,
            exit_code,
            tail(output),
            thread_id,
            thread_id,
            now(),
            job["id"],
        ),
    )
    conn.commit()


def run_job(conn: sqlite3.Connection, job: sqlite3.Row) -> None:
    repo = job["repo_path"]
    ready, prep_log = prepare_repo(repo)
    if not ready:
        finish_job(conn, job, "needs_attention", prep_log, 2, None)
        return

    prompt = job["prompt"].strip()
    session_id = (job["session_id"] or "").strip()
    if session_id:
        command = [
            "codex",
            "exec",
            "--json",
            "--sandbox",
            "workspace-write",
            "resume",
            session_id,
            prompt,
        ]
    else:
        command = [
            "codex",
            "exec",
            "--json",
            "--sandbox",
            "workspace-write",
            "-C",
            repo,
            prompt,
        ]

    exit_code, stdout, stderr = run_command(command, repo)
    thread_id, agent_message = parse_codex_events(stdout)
    combined = "\n\n".join(
        part for part in [agent_message, stderr.strip(), "Codex 事件日志：\n" + tail(stdout, 8000)] if part
    )
    searchable = stdout + "\n" + stderr + "\n" + agent_message

    if QUOTA_RE.search(searchable):
        finish_job(conn, job, "waiting_quota", combined, exit_code, thread_id)
        return
    if exit_code != 0:
        if job["retry_count"] < 1:
            finish_job(conn, job, "scheduled", combined, exit_code, thread_id, retry=True)
        else:
            finish_job(conn, job, "failed", combined, exit_code, thread_id)
        return
    if ATTENTION_RE.search(agent_message):
        finish_job(conn, job, "needs_attention", combined, exit_code, thread_id)
        return

    published, publish_log = publish_changes(repo, job["title"])
    combined = tail(combined + "\n\n发布结果：\n" + publish_log)
    if not published:
        finish_job(conn, job, "needs_attention", combined, 3, thread_id)
        return
    finish_job(conn, job, "succeeded", combined, 0, thread_id)


def run_due(db_path: str) -> int:
    conn = connect(db_path)
    job = claim_job(conn)
    if not job:
        return 0
    run_job(conn, job)
    return 0


HTML = r"""<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Codex 任务池</title>
<style>
:root{color-scheme:dark;--bg:#101511;--panel:#182019;--line:#314033;--text:#edf4ed;--muted:#9eac9f;--green:#95d5a1;--red:#ff9b91;--amber:#f2ca72}
*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at top,#223326 0,#101511 45%);color:var(--text);font:15px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif}main{max-width:1040px;margin:auto;padding:42px 20px 80px}header{display:flex;justify-content:space-between;gap:24px;align-items:end;margin-bottom:26px}h1{font-size:34px;letter-spacing:-.04em;margin:0}header p{color:var(--muted);max-width:600px;margin:8px 0 0}.tag{border:1px solid var(--line);border-radius:999px;padding:7px 12px;color:var(--green);white-space:nowrap}.panel{background:color-mix(in srgb,var(--panel) 94%,transparent);border:1px solid var(--line);border-radius:18px;padding:20px;box-shadow:0 20px 60px #0003}.grid{display:grid;grid-template-columns:1fr 1fr;gap:15px}label{display:grid;gap:7px;color:var(--muted);font-size:13px}.wide{grid-column:1/-1}input,textarea,select,button{font:inherit}input,textarea,select{width:100%;background:#0e140f;color:var(--text);border:1px solid var(--line);border-radius:10px;padding:11px 12px;outline:none}textarea{min-height:132px;resize:vertical}input:focus,textarea:focus,select:focus{border-color:#699773;box-shadow:0 0 0 3px #77aa8122}button{border:0;border-radius:10px;padding:10px 14px;cursor:pointer;background:#d9eadc;color:#102014;font-weight:650}button.secondary{background:#273229;color:var(--text);border:1px solid var(--line)}button.danger{background:#39221f;color:#ffc2bb}button:disabled{opacity:.5;cursor:wait}.actions{display:flex;gap:9px;flex-wrap:wrap;align-items:center;margin-top:16px}.hint{color:var(--muted);font-size:13px}.section-title{display:flex;justify-content:space-between;align-items:center;margin:30px 2px 12px}.section-title h2{margin:0;font-size:18px}.jobs{display:grid;gap:12px}.job{background:#151c16;border:1px solid var(--line);border-radius:15px;padding:17px}.job-head{display:flex;justify-content:space-between;gap:16px}.job h3{margin:0 0 5px;font-size:17px}.meta{color:var(--muted);font-size:13px}.status{border-radius:999px;padding:5px 9px;font-size:12px;white-space:nowrap;background:#253027}.status.needs_attention,.status.failed{color:var(--red);background:#36211f}.status.waiting_quota{color:var(--amber);background:#382f1d}.status.running{color:#b6d7ff;background:#1d3044}.status.scheduled{color:var(--green)}details{margin-top:12px}summary{cursor:pointer;color:var(--muted)}pre{white-space:pre-wrap;word-break:break-word;background:#0d120e;border-radius:10px;padding:12px;max-height:360px;overflow:auto;color:#cbd7cc;font:12px/1.55 ui-monospace,monospace}.empty{text-align:center;color:var(--muted);padding:38px}.notice{display:none;margin-top:12px;color:var(--green)}@media(max-width:700px){header{align-items:start;flex-direction:column}.grid{grid-template-columns:1fr}.wide{grid-column:auto}h1{font-size:29px}.job-head{flex-direction:column}}
</style></head>
<body><main>
<header><div><h1>Codex 任务池</h1><p>到点在 Ubuntu 上继续 Codex。额度不足会顺延；需要你决策、测试失败或推送冲突会暂停，不会盲目循环。</p></div><div class="tag">Butler · 5 小时调度</div></header>
<section class="panel"><form id="create"><div class="grid">
<label>任务名称<input name="title" maxlength="120" required placeholder="例如：优化登录页交互"></label>
<label>执行方式<select name="schedule_mode"><option value="once">只执行一次</option><option value="interval">每 5 小时继续</option></select></label>
<label class="wide">给 Codex 的明确任务<textarea name="prompt" maxlength="20000" required placeholder="写清楚目标、验收条件，以及不能改动的范围。"></textarea></label>
<label>第一次执行时间<input name="next_run" type="datetime-local" required></label>
<label>Ubuntu 会话 ID（可选）<input name="session_id" maxlength="160" placeholder="留空会创建新会话"></label>
</div><div class="actions"><button type="submit">加入任务池</button><span class="hint">固定工作目录：Butler 自动化仓库；成功后自动测试、推送与部署。</span></div><div id="notice" class="notice"></div></form></section>
<div class="section-title"><h2>任务</h2><button class="secondary" onclick="loadJobs()">刷新</button></div><section id="jobs" class="jobs"><div class="empty">正在读取…</div></section>
</main><script>
const statusName={scheduled:'已排期',running:'运行中',waiting_quota:'等待额度',needs_attention:'需要你处理',failed:'失败',succeeded:'已完成'};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const when=ts=>ts?new Date(ts*1000).toLocaleString('zh-CN',{hour12:false}):'—';
async function api(path,opt){const r=await fetch(path,opt);const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'请求失败');return d}
async function loadJobs(){const root=document.querySelector('#jobs');try{const {jobs}=await api('api/jobs');if(!jobs.length){root.innerHTML='<div class="panel empty">还没有任务。先把一个明确任务放进来。</div>';return}root.innerHTML=jobs.map(j=>`<article class="job"><div class="job-head"><div><h3>${esc(j.title)}</h3><div class="meta">下次：${when(j.next_run_at)} · ${j.schedule_mode==='interval'?'每 '+Math.round(j.interval_minutes/60)+' 小时':'一次性'}${j.session_id?' · 会话 '+esc(j.session_id.slice(0,12))+'…':''}</div></div><span class="status ${esc(j.status)}">${esc(statusName[j.status]||j.status)}${j.enabled?'':' · 已暂停'}</span></div><details><summary>查看任务和最近结果</summary><pre>任务：${esc(j.prompt)}\n\n最近结果：\n${esc(j.last_output||'尚未执行')}</pre></details><div class="actions"><button onclick="act(${j.id},'run')">立即运行</button><button class="secondary" onclick="act(${j.id},'toggle')">${j.enabled?'暂停':'恢复'}</button><button class="danger" onclick="removeJob(${j.id})">删除</button></div></article>`).join('')}catch(e){root.innerHTML=`<div class="panel empty">${esc(e.message)}</div>`}}
async function act(id,name){try{await api(`api/jobs/${id}/${name}`,{method:'POST'});await loadJobs()}catch(e){alert(e.message)}}
async function removeJob(id){if(!confirm('确定删除这个任务？'))return;try{await api(`api/jobs/${id}`,{method:'DELETE'});await loadJobs()}catch(e){alert(e.message)}}
const form=document.querySelector('#create');const dt=form.elements.next_run;const d=new Date(Date.now()+5*60*1000);d.setMinutes(d.getMinutes()-d.getTimezoneOffset());dt.value=d.toISOString().slice(0,16);
form.addEventListener('submit',async e=>{e.preventDefault();const b=form.querySelector('button');b.disabled=true;const x=Object.fromEntries(new FormData(form));x.next_run_at=Math.floor(new Date(x.next_run).getTime()/1000);delete x.next_run;x.interval_minutes=300;try{await api('api/jobs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(x)});form.elements.title.value='';form.elements.prompt.value='';form.elements.session_id.value='';document.querySelector('#notice').textContent='任务已加入。';document.querySelector('#notice').style.display='block';await loadJobs()}catch(err){alert(err.message)}finally{b.disabled=false}});loadJobs();setInterval(loadJobs,30000);
</script></body></html>"""


class Handler(BaseHTTPRequestHandler):
    server_version = "CodexQueue/1.0"

    @property
    def db_path(self) -> str:
        return self.server.db_path  # type: ignore[attr-defined]

    def log_message(self, fmt: str, *args: object) -> None:
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))

    def send_bytes(self, status: int, body: bytes, content_type: str) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.end_headers()
        self.wfile.write(body)

    def send_json(self, status: int, data: dict) -> None:
        self.send_bytes(status, json.dumps(data, ensure_ascii=False).encode(), "application/json; charset=utf-8")

    def body_json(self) -> dict:
        length = min(int(self.headers.get("Content-Length", "0")), MAX_PROMPT + 4096)
        return json.loads(self.rfile.read(length) or b"{}")

    def same_origin(self) -> bool:
        """Reject browser cross-origin writes while still allowing local service checks."""
        origin = self.headers.get("Origin")
        if not origin:
            return True
        parsed = urlparse(origin)
        return parsed.scheme in {"http", "https"} and parsed.netloc == self.headers.get("Host")

    def do_GET(self) -> None:
        path = urlparse(self.path).path
        if path in {"", "/"}:
            self.send_bytes(200, HTML.encode(), "text/html; charset=utf-8")
            return
        if path == "/api/health":
            self.send_json(200, {"ok": True})
            return
        if path == "/api/jobs":
            with connect(self.db_path) as conn:
                rows = conn.execute("SELECT * FROM jobs ORDER BY created_at DESC, id DESC").fetchall()
            self.send_json(200, {"jobs": [row_dict(row) for row in rows]})
            return
        self.send_json(404, {"error": "Not found"})

    def do_POST(self) -> None:
        if not self.same_origin():
            self.send_json(403, {"error": "跨站请求已拒绝。"})
            return
        path = urlparse(self.path).path
        if path == "/api/jobs":
            try:
                data = self.body_json()
                title = str(data.get("title", "")).strip()[:120]
                prompt = str(data.get("prompt", "")).strip()
                mode = str(data.get("schedule_mode", "once"))
                interval = int(data.get("interval_minutes", 300))
                next_run = int(data.get("next_run_at", now()))
                session = str(data.get("session_id", "")).strip() or None
                if not title or not prompt or len(prompt) > MAX_PROMPT:
                    raise ValueError("任务名称和任务内容不能为空。")
                if mode not in {"once", "interval"}:
                    raise ValueError("执行方式无效。")
                if interval < 30 or interval > 10080:
                    raise ValueError("执行间隔必须在 30 分钟到 7 天之间。")
                if session and not SAFE_SESSION_RE.fullmatch(session):
                    raise ValueError("会话 ID 格式无效。")
                stamp = now()
                with connect(self.db_path) as conn:
                    cursor = conn.execute(
                        "INSERT INTO jobs(title,prompt,repo_path,session_id,schedule_mode,"
                        "interval_minutes,next_run_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)",
                        (title, prompt, BUTLER_REPO, session, mode, interval, next_run, stamp, stamp),
                    )
                    conn.commit()
                self.send_json(201, {"ok": True, "id": cursor.lastrowid})
            except (ValueError, TypeError, json.JSONDecodeError) as exc:
                self.send_json(400, {"error": str(exc)})
            return

        match = re.fullmatch(r"/api/jobs/(\d+)/(run|toggle)", path)
        if match:
            job_id, action = int(match.group(1)), match.group(2)
            with connect(self.db_path) as conn:
                row = conn.execute("SELECT enabled FROM jobs WHERE id=?", (job_id,)).fetchone()
                if not row:
                    self.send_json(404, {"error": "任务不存在。"})
                    return
                if action == "run":
                    conn.execute(
                        "UPDATE jobs SET enabled=1,status='scheduled',next_run_at=?,retry_count=0,updated_at=? WHERE id=?",
                        (now(), now(), job_id),
                    )
                else:
                    enabled = 0 if row["enabled"] else 1
                    status = "scheduled" if enabled else "scheduled"
                    conn.execute(
                        "UPDATE jobs SET enabled=?,status=?,updated_at=? WHERE id=?",
                        (enabled, status, now(), job_id),
                    )
                conn.commit()
            self.send_json(200, {"ok": True})
            return
        self.send_json(404, {"error": "Not found"})

    def do_DELETE(self) -> None:
        if not self.same_origin():
            self.send_json(403, {"error": "跨站请求已拒绝。"})
            return
        match = re.fullmatch(r"/api/jobs/(\d+)", urlparse(self.path).path)
        if not match:
            self.send_json(404, {"error": "Not found"})
            return
        with connect(self.db_path) as conn:
            cursor = conn.execute("DELETE FROM jobs WHERE id=?", (int(match.group(1)),))
            conn.commit()
        if cursor.rowcount == 0:
            self.send_json(404, {"error": "任务不存在。"})
        else:
            self.send_json(200, {"ok": True})


def serve(db_path: str, host: str, port: int) -> None:
    connect(db_path).close()
    server = ThreadingHTTPServer((host, port), Handler)
    server.db_path = db_path  # type: ignore[attr-defined]
    print(f"Codex Queue listening on http://{host}:{port}", flush=True)
    server.serve_forever()


def main() -> int:
    parser = argparse.ArgumentParser(description="Codex task queue")
    parser.add_argument("--db", default=os.environ.get("CODEX_QUEUE_DB", DEFAULT_DB))
    sub = parser.add_subparsers(dest="command", required=True)
    web = sub.add_parser("serve")
    web.add_argument("--host", default="127.0.0.1")
    web.add_argument("--port", type=int, default=3765)
    sub.add_parser("run-due")
    args = parser.parse_args()
    if args.command == "serve":
        serve(args.db, args.host, args.port)
        return 0
    return run_due(args.db)


if __name__ == "__main__":
    raise SystemExit(main())
