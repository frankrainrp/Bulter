#!/usr/bin/env python3
"""Small, dependency-free scheduler for unattended Codex CLI jobs."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sqlite3
import subprocess
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse


DEFAULT_DB = "/home/frankrain/server/data/codex-queue/queue.sqlite"
DEFAULT_ACCOUNTS_ROOT = "/home/frankrain/server/data/codex-queue/accounts"
DEFAULT_PROJECTS_ROOT = "/home/frankrain/server/automation-workspaces"
DEFAULT_RUNNER_IMAGE = "local/codex-queue-runner:0.151.0"
BUTLER_REPO = "/home/frankrain/server/automation-workspaces/Bulter"
FAMILYOS_REPO = "/home/frankrain/server/automation-workspaces/FamilyOS"
PROJECTS = {
    "butler": {"name": "Butler", "repo": BUTLER_REPO},
    "familyos": {"name": "FamilyOS", "repo": FAMILYOS_REPO},
}
MAX_LOG = 24000
MAX_PROMPT = 20000
MUTATION_LIMIT = 60
RUN_LIMIT = 6
RATE_WINDOW = 60
RATE_LOCK = threading.Lock()
RATE_BUCKETS: dict[tuple[str, str], list[int]] = {}
SENSITIVE_PATTERNS = (
    (re.compile(r"\bsk-[A-Za-z0-9_-]{16,}\b"), "[已隐藏 API key]"),
    (re.compile(r"\bgh[pousr]_[A-Za-z0-9]{20,}\b"), "[已隐藏 GitHub token]"),
    (re.compile(r"(?i)\b(authorization\s*:\s*bearer)\s+\S+"), r"\1 [已隐藏]"),
    (
        re.compile(r"(?i)\b(password|passwd|api[_-]?key|access[_-]?token|secret)\s*([:=])\s*([^\s,;]+)"),
        r"\1\2[已隐藏]",
    ),
)

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
    updated_at INTEGER NOT NULL,
    account_id INTEGER
);
CREATE INDEX IF NOT EXISTS idx_jobs_due ON jobs(enabled, next_run_at);
CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    label TEXT NOT NULL,
    auth_state TEXT NOT NULL DEFAULT 'pending',
    last_used_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    repo_path TEXT NOT NULL UNIQUE,
    default_branch TEXT NOT NULL DEFAULT 'master',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);
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
SAFE_SLUG_RE = re.compile(r"^[a-z][a-z0-9-]{1,47}$")
SAFE_GIT_REF_RE = re.compile(r"^[A-Za-z0-9._/-]{1,120}$")
FAMILYOS_COMPLETION_MARKER = "FAMILYOS_MVP_COMPLETE"


def now() -> int:
    return int(time.time())


class ClosingConnection(sqlite3.Connection):
    def __exit__(self, exc_type, exc_value, traceback):
        try:
            return super().__exit__(exc_type, exc_value, traceback)
        finally:
            self.close()


def connect(db_path: str) -> sqlite3.Connection:
    path = Path(db_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path, timeout=30, factory=ClosingConnection)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA busy_timeout=30000")
    conn.executescript(SCHEMA)
    columns = {row[1] for row in conn.execute("PRAGMA table_info(jobs)")}
    if "account_id" not in columns:
        conn.execute("ALTER TABLE jobs ADD COLUMN account_id INTEGER")
    stamp = now()
    conn.execute(
        "INSERT OR IGNORE INTO accounts(slug,label,auth_state,created_at,updated_at) VALUES('primary','主账号','pending',?,?)",
        (stamp, stamp),
    )
    for slug, project in PROJECTS.items():
        conn.execute(
            "INSERT OR IGNORE INTO projects(slug,name,repo_path,default_branch,created_at,updated_at) VALUES(?,?,?,?,?,?)",
            (slug, project["name"], project["repo"], "master", stamp, stamp),
        )
    primary_id = conn.execute("SELECT id FROM accounts WHERE slug='primary'").fetchone()[0]
    conn.execute("UPDATE jobs SET account_id=? WHERE account_id IS NULL", (primary_id,))
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
    data.pop("repo_path", None)
    if data.get("last_output"):
        data["last_output"] = redact_sensitive(str(data["last_output"]))
    data["enabled"] = bool(data["enabled"])
    data["project"] = data.pop("project_slug", None) or "unknown"
    data["project_name"] = data.pop("project_label", None) or "未知项目"
    data["account"] = data.pop("account_slug", None) or "primary"
    data["account_name"] = data.pop("account_label", None) or "主账号"
    return data


def list_jobs(conn: sqlite3.Connection, suffix: str = "", params: tuple = ()) -> list[sqlite3.Row]:
    return conn.execute(
        "SELECT jobs.*,accounts.slug AS account_slug,accounts.label AS account_label,"
        "projects.slug AS project_slug,projects.name AS project_label "
        "FROM jobs LEFT JOIN accounts ON accounts.id=jobs.account_id "
        "LEFT JOIN projects ON projects.repo_path=jobs.repo_path " + suffix,
        params,
    ).fetchall()


def accounts_root() -> Path:
    return Path(os.environ.get("CODEX_QUEUE_ACCOUNTS_ROOT", DEFAULT_ACCOUNTS_ROOT)).resolve()


def projects_root() -> Path:
    return Path(os.environ.get("CODEX_QUEUE_PROJECTS_ROOT", DEFAULT_PROJECTS_ROOT)).resolve()


def account_home(slug: str) -> Path:
    if not SAFE_SLUG_RE.fullmatch(slug):
        raise ValueError("账号标识只能使用小写字母、数字和连字符。")
    return accounts_root() / slug


def ensure_account_home(slug: str) -> Path:
    root = accounts_root()
    root.mkdir(parents=True, exist_ok=True, mode=0o700)
    path = account_home(slug)
    path.mkdir(parents=True, exist_ok=True, mode=0o700)
    os.chmod(root, 0o700)
    os.chmod(path, 0o700)
    config = path / "config.toml"
    if not config.exists():
        config.write_text('cli_auth_credentials_store = "file"\n', encoding="utf-8")
        os.chmod(config, 0o600)
    return path


def validated_repo_path(value: str) -> str:
    candidate = Path(value).resolve()
    root = projects_root()
    try:
        candidate.relative_to(root)
    except ValueError as exc:
        raise ValueError("项目目录必须位于任务池工作区内。") from exc
    if not candidate.joinpath(".git").is_dir():
        raise ValueError("项目目录不存在或不是 Git 仓库。")
    return str(candidate)


def tail(text: str, limit: int = MAX_LOG) -> str:
    return text[-limit:]


def redact_sensitive(text: str) -> str:
    for pattern, replacement in SENSITIVE_PATTERNS:
        text = pattern.sub(replacement, text)
    return text


def rate_allowed(address: str, bucket: str, limit: int) -> bool:
    stamp = now()
    key = (address, bucket)
    with RATE_LOCK:
        values = [value for value in RATE_BUCKETS.get(key, []) if value > stamp - RATE_WINDOW]
        if len(values) >= limit:
            RATE_BUCKETS[key] = values
            return False
        values.append(stamp)
        RATE_BUCKETS[key] = values
        return True


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
    code, stdout, stderr = run_command(
        ["git", "-c", "core.hooksPath=/dev/null", "-C", repo, *args], repo, timeout=900
    )
    return code, tail((stdout + "\n" + stderr).strip(), 12000)


def git_control_snapshot(repo: str) -> tuple[dict[str, str] | None, str]:
    """Capture Git control-plane state that an untrusted runner must not change."""
    values: dict[str, str] = {}
    for key, args in {
        "head": ("rev-parse", "HEAD"),
        "origin": ("remote", "get-url", "origin"),
        "git_dir": ("rev-parse", "--absolute-git-dir"),
    }.items():
        code, output = git_output(repo, *args)
        if code != 0 or not output.strip():
            return None, f"无法读取 Git {key}：\n{output}"
        values[key] = output.strip()
    config = Path(values["git_dir"], "config")
    if not config.is_file():
        return None, "Git 配置文件不存在，已停止。"
    values["config_sha256"] = hashlib.sha256(config.read_bytes()).hexdigest()
    return values, ""


def verify_git_control(repo: str, expected: dict[str, str]) -> tuple[bool, str]:
    actual, error = git_control_snapshot(repo)
    if actual is None:
        return False, error
    changed = [key for key in ("head", "origin", "git_dir", "config_sha256") if actual[key] != expected[key]]
    if changed:
        return False, "执行容器改动了受保护的 Git 控制状态（" + "、".join(changed) + "），已拒绝提交和推送。"
    return True, ""


def run_verification_container(repo: str) -> tuple[int, str]:
    """Run project-controlled build/test code without host credentials or Docker socket."""
    if repo == BUTLER_REPO:
        workdir = "/workspace/my-app"
        script = "corepack pnpm install --frozen-lockfile && corepack pnpm --filter @smart-hub/web build"
        network = "bridge"
    elif repo == FAMILYOS_REPO or Path(repo, "tools", "verify.sh").is_file():
        workdir = "/workspace"
        script = "bash tools/verify.sh"
        network = "none"
    elif Path(repo, "package.json").is_file() and Path(repo, "pnpm-lock.yaml").is_file():
        workdir = "/workspace"
        script = "corepack pnpm install --frozen-lockfile && corepack pnpm run build"
        network = "bridge"
    else:
        workdir = "/workspace"
        script = "git diff --check"
        network = "none"
    command = [
        "docker", "run", "--rm", "--init",
        "--name", f"codex-queue-verify-{os.getpid()}-{now()}",
        "--user", "1000:1000",
        "--read-only",
        "--cap-drop=ALL",
        "--security-opt", "no-new-privileges",
        "--pids-limit", "512",
        "--memory", os.environ.get("CODEX_QUEUE_RUNNER_MEMORY", "12g"),
        "--cpus", os.environ.get("CODEX_QUEUE_RUNNER_CPUS", "6"),
        "--network", network,
        "--tmpfs", "/tmp:rw,nosuid,noexec,size=4g",
        "--env", "HOME=/tmp",
        "--env", "CI=true",
        "--env", "NEXT_TELEMETRY_DISABLED=1",
        "--volume", f"{repo}:/workspace",
        "--workdir", workdir,
        "--entrypoint", "/bin/bash",
        os.environ.get("CODEX_QUEUE_RUNNER_IMAGE", DEFAULT_RUNNER_IMAGE),
        "-lc", script,
    ]
    code, stdout, stderr = run_command(command, repo, timeout=45 * 60)
    return code, tail((stdout + "\n" + stderr).strip(), 10000)


def prepare_repo(repo: str, branch: str) -> tuple[bool, str]:
    try:
        repo = validated_repo_path(repo)
    except ValueError as exc:
        return False, str(exc)
    if not SAFE_GIT_REF_RE.fullmatch(branch):
        return False, "项目分支名称无效。"
    code, dirty = git_output(repo, "status", "--porcelain")
    if code != 0:
        return False, dirty
    if dirty.strip():
        return False, "自动化仓库有上次遗留的未提交修改，已暂停，避免覆盖：\n" + dirty
    code, output = git_output(repo, "pull", "--ff-only", "origin", branch)
    if code != 0:
        return False, output
    return True, output


def publish_changes(repo: str, title: str, branch: str) -> tuple[bool, str]:
    code, dirty = git_output(repo, "status", "--porcelain")
    if code != 0:
        return False, dirty
    if not dirty.strip():
        return True, "没有代码改动，不需要推送。"

    build_code, build_log = run_verification_container(repo)
    if build_code != 0:
        return False, "隔离容器内构建失败，未提交：\n" + build_log

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
        ["git", "-c", "core.hooksPath=/dev/null", "-C", repo, "commit", "-m", message],
        repo,
        timeout=900,
        env=env,
    )
    if commit_code != 0:
        return False, tail((commit_out + "\n" + commit_err).strip(), 10000)
    push_code, push_log = git_output(repo, "push", "origin", branch)
    if push_code != 0:
        return False, "提交已创建，但推送失败，需要人工处理：\n" + push_log
    if repo == BUTLER_REPO:
        return True, "构建通过，已提交并推送 GitHub；服务器部署器会在 CI 通过后上线。"
    deploy_code, deploy_out, deploy_err = run_command(
        ["docker", "compose", "up", "--build", "-d", "--wait", "--wait-timeout", "120"],
        repo,
        timeout=45 * 60,
    )
    deploy_log = tail((deploy_out + "\n" + deploy_err).strip(), 10000)
    if deploy_code != 0:
        return False, "FamilyOS 已推送，但自动部署失败：\n" + deploy_log
    health_code, health_out, health_err = run_command(
        ["curl", "--fail", "--silent", "--show-error", "--max-time", "10", "http://192.168.110.49:8080/api/health"],
        repo,
        timeout=30,
    )
    health_log = tail((health_out + "\n" + health_err).strip(), 2000)
    if health_code != 0:
        return False, "FamilyOS 已部署，但局域网健康检查失败：\n" + health_log
    return True, "验证通过，已提交并推送 FamilyOS 私有仓库；容器已重建，局域网健康检查通过：\n" + health_log


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
    target = conn.execute(
        "SELECT id FROM jobs WHERE enabled=1 AND next_run_at<=? "
        "AND status!='running' ORDER BY next_run_at, id LIMIT 1",
        (now(),),
    ).fetchone()
    row = None
    if target:
        conn.execute(
            "UPDATE jobs SET status='running', last_run_at=?, updated_at=? WHERE id=?",
            (now(), now(), target["id"]),
        )
        row = list_jobs(conn, "WHERE jobs.id=?", (target["id"],))[0]
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
    interval_seconds = job["interval_minutes"] * 60
    next_interval_at = job["next_run_at"] + interval_seconds
    while next_interval_at <= now():
        next_interval_at += interval_seconds
    if status == "waiting_quota":
        next_run_at = next_interval_at
    elif retry:
        retry_count += 1
        next_run_at = now() + 15 * 60
    elif status == "succeeded" and job["schedule_mode"] == "interval":
        retry_count = 0
        next_run_at = next_interval_at
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
            tail(redact_sensitive(output)),
            thread_id,
            thread_id,
            now(),
            job["id"],
        ),
    )
    conn.commit()


def run_job(conn: sqlite3.Connection, job: sqlite3.Row) -> None:
    repo = job["repo_path"]
    project = conn.execute("SELECT * FROM projects WHERE repo_path=?", (repo,)).fetchone()
    if not project:
        finish_job(conn, job, "needs_attention", "项目未在任务池注册。", 2, None)
        return
    branch = project["default_branch"]
    ready, prep_log = prepare_repo(repo, branch)
    if not ready:
        finish_job(conn, job, "needs_attention", prep_log, 2, None)
        return
    control_snapshot, control_error = git_control_snapshot(repo)
    if control_snapshot is None:
        finish_job(conn, job, "needs_attention", control_error, 2, None)
        return

    account_slug = job["account_slug"] or "primary"
    try:
        codex_home = ensure_account_home(account_slug)
    except (OSError, ValueError) as exc:
        finish_job(conn, job, "needs_attention", f"账号目录不可用：{exc}", 2, None)
        return
    auth_file = codex_home / "auth.json"
    if not auth_file.is_file():
        conn.execute("UPDATE accounts SET auth_state='pending',updated_at=? WHERE slug=?", (now(), account_slug))
        conn.commit()
        finish_job(conn, job, "needs_attention", f"账号 {account_slug} 尚未完成 Codex 登录。", 2, None)
        return

    prompt = (
        "只处理 /workspace 中当前项目的代码、测试和文档。不要读取、输出或复制任何账号凭据、"
        "浏览器资料或 /codex-home/auth.json；不要运行 git commit/push，也不要修改 .git 目录、Git remote 或 Git 配置；"
        "遇到需要外部秘密、产品决策或高风险操作时停止并说明。\n\n"
        + job["prompt"].strip()
    )
    session_id = (job["session_id"] or "").strip()
    command = [
        "docker", "run", "--rm", "--init",
        "--name", f"codex-queue-job-{job['id']}-{now()}",
        "--user", "1000:1000",
        "--read-only",
        "--cap-drop=ALL",
        "--security-opt", "no-new-privileges",
        "--pids-limit", "512",
        "--memory", os.environ.get("CODEX_QUEUE_RUNNER_MEMORY", "12g"),
        "--cpus", os.environ.get("CODEX_QUEUE_RUNNER_CPUS", "6"),
        "--tmpfs", "/tmp:rw,nosuid,noexec,size=1g",
        "--env", "HOME=/codex-home",
        "--env", "CODEX_HOME=/codex-home",
        "--volume", f"{codex_home}:/codex-home",
        "--volume", f"{repo}:/workspace",
        "--workdir", "/workspace",
        os.environ.get("CODEX_QUEUE_RUNNER_IMAGE", DEFAULT_RUNNER_IMAGE),
        "exec", "--json", "--sandbox", "workspace-write", "--ignore-user-config",
        "--config", "sandbox_workspace_write.network_access=true", "-C", "/workspace",
    ]
    if session_id:
        command.extend(["resume", session_id, prompt])
    else:
        command.append(prompt)

    exit_code, stdout, stderr = run_command(command, repo)
    conn.execute("UPDATE accounts SET last_used_at=?,auth_state='ready',updated_at=? WHERE slug=?", (now(), now(), account_slug))
    conn.commit()
    thread_id, agent_message = parse_codex_events(stdout)
    combined = "\n\n".join(
        part for part in [agent_message, stderr.strip(), "Codex 事件日志：\n" + tail(stdout, 8000)] if part
    )
    searchable = stdout + "\n" + stderr + "\n" + agent_message

    control_ok, control_log = verify_git_control(repo, control_snapshot)
    if not control_ok:
        combined = tail(combined + "\n\n安全检查：\n" + control_log)
        finish_job(conn, job, "needs_attention", combined, 4, thread_id)
        return

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

    published, publish_log = publish_changes(repo, job["title"], branch)
    combined = tail(combined + "\n\n发布结果：\n" + publish_log)
    if not published:
        finish_job(conn, job, "needs_attention", combined, 3, thread_id)
        return
    finish_job(conn, job, "succeeded", combined, 0, thread_id)
    if repo == FAMILYOS_REPO and FAMILYOS_COMPLETION_MARKER in agent_message:
        conn.execute(
            "UPDATE jobs SET enabled=0,status='succeeded',updated_at=? WHERE id=?",
            (now(), job["id"]),
        )
        conn.commit()


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
:root{color-scheme:dark;--bg:#101511;--panel:#182019;--line:#314033;--text:#edf4ed;--muted:#aab7aa;--green:#95d5a1;--red:#ff9b91;--amber:#f2ca72;--blue:#a8caf2}
*{box-sizing:border-box}html{scrollbar-color:#55745b var(--bg)}body{margin:0;background:radial-gradient(circle at top,#223326 0,#101511 45%);color:var(--text);font:15px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif;caret-color:var(--green)}::selection{background:var(--amber);color:#101511}main{max-width:1040px;margin:auto;padding:42px 20px 80px}header{display:flex;justify-content:space-between;gap:24px;align-items:end;margin-bottom:26px}h1{font-size:34px;letter-spacing:-.035em;margin:0}header p{color:var(--muted);max-width:660px;margin:8px 0 0}.tag{border:1px solid var(--line);border-radius:999px;padding:7px 12px;color:var(--green);white-space:nowrap}.panel{background:color-mix(in srgb,var(--panel) 94%,transparent);border:1px solid var(--line);border-radius:16px;padding:20px;box-shadow:0 20px 60px #0003}.grid{display:grid;grid-template-columns:1fr 1fr;gap:15px}label,.field{display:grid;gap:7px;color:var(--muted);font-size:13px}.wide{grid-column:1/-1}.field-label{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:34px}.voice-area{display:flex;align-items:center;justify-content:flex-end;gap:10px;min-width:0}.voice-button{display:inline-flex;align-items:center;gap:7px;padding:7px 10px;background:#273229;color:var(--text);border:1px solid var(--line);white-space:nowrap}.voice-button svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.voice-button.listening{background:#4a2925;color:#ffd2cc;border-color:#8a4a42}.voice-status{color:var(--muted);font-size:12px;max-width:310px;overflow-wrap:anywhere}.voice-status.error{color:var(--red)}input,textarea,select,button{font:inherit}input,textarea,select{width:100%;background:#0e140f;color:var(--text);border:1px solid var(--line);border-radius:10px;padding:11px 12px;outline:none}textarea{min-height:132px;resize:vertical}input:focus,textarea:focus,select:focus,button:focus-visible{border-color:#699773;box-shadow:0 0 0 3px #77aa8122;outline:none}button{border:0;border-radius:10px;padding:10px 14px;cursor:pointer;background:#d9eadc;color:#102014;font-weight:650}button.secondary{background:#273229;color:var(--text);border:1px solid var(--line)}button.danger{background:#39221f;color:#ffc2bb}button:disabled{opacity:.5;cursor:not-allowed}.actions{display:flex;gap:9px;flex-wrap:wrap;align-items:center;margin-top:16px}.hint{color:var(--muted);font-size:13px}.accounts{display:grid;gap:0;margin-bottom:24px}.account-row{display:grid;grid-template-columns:minmax(150px,1fr) auto;gap:18px;align-items:center;padding:13px 0;border-top:1px solid var(--line)}.account-row:first-child{border-top:0}.account-row strong{display:block}.account-row small{display:block;color:var(--muted);margin-top:2px}.account-state{font-size:12px;color:var(--amber)}.account-state.ready{color:var(--green)}.account-create{display:grid;grid-template-columns:1fr 1fr auto;gap:12px;align-items:end;padding-top:16px;border-top:1px solid var(--line)}.login-command{display:none;margin:14px 0 0;padding:12px;background:#0d120e;border:1px solid var(--line);color:var(--blue);overflow:auto;font:12px/1.55 ui-monospace,monospace}.section-title{display:flex;justify-content:space-between;align-items:center;margin:30px 2px 12px}.section-title h2{margin:0;font-size:18px}.jobs{display:grid;gap:12px}.job{background:#151c16;border:1px solid var(--line);border-radius:15px;padding:17px}.job-head{display:flex;justify-content:space-between;gap:16px}.job h3{margin:0 0 5px;font-size:17px}.meta{color:var(--muted);font-size:13px}.status{border-radius:999px;padding:5px 9px;font-size:12px;white-space:nowrap;background:#253027}.status.needs_attention,.status.failed{color:var(--red);background:#36211f}.status.waiting_quota{color:var(--amber);background:#382f1d}.status.running{color:#b6d7ff;background:#1d3044}.status.scheduled{color:var(--green)}details{margin-top:12px}summary{cursor:pointer;color:var(--muted)}pre{white-space:pre-wrap;word-break:break-word;background:#0d120e;border-radius:10px;padding:12px;max-height:360px;overflow:auto;color:#cbd7cc;font:12px/1.55 ui-monospace,monospace}.empty{text-align:center;color:var(--muted);padding:38px}.notice{display:none;margin-top:12px;color:var(--green)}@media(max-width:700px){header{align-items:start;flex-direction:column}.grid,.account-create{grid-template-columns:1fr}.wide{grid-column:auto}.field-label{align-items:flex-start;flex-direction:column}.voice-area{justify-content:flex-start;flex-wrap:wrap}h1{font-size:29px}.job-head{flex-direction:column}}@media(prefers-reduced-motion:no-preference){.voice-button.listening svg{animation:pulse 1.2s cubic-bezier(.16,1,.3,1) infinite}@keyframes pulse{50%{opacity:.45;transform:scale(.92)}}}
</style></head>
<body><main>
<header><div><h1>Codex 任务池</h1><p>把不同 Codex 账号的项目交给 Ubuntu 继续。每套登录态独立保存、每次执行进入临时容器；额度不足会顺延，需要人做决定时自动停下。</p></div><div class="tag">Docker 隔离 · 30 秒巡检</div></header>
<section class="panel"><div class="section-title" style="margin:0 0 12px"><h2>执行账号</h2><span class="hint">这里只显示标签，不读取密码或令牌内容</span></div><div id="accounts" class="accounts"><div class="empty">正在读取…</div></div><form id="create-account" class="account-create"><label>账号称呼<input name="label" maxlength="80" required placeholder="例如：客户 A"></label><label>账号标识<input name="slug" maxlength="48" pattern="[a-z][a-z0-9-]{1,47}" required placeholder="例如：client-a"></label><button type="submit">新增账号槽位</button></form><code id="login-command" class="login-command"></code></section>
<section class="panel"><form id="create"><div class="grid">
<label>任务名称<input name="title" maxlength="120" required placeholder="例如：优化登录页交互"></label>
<label>项目<select id="project-select" name="project" required></select></label>
<label>执行账号<select id="account-select" name="account" required></select></label>
<label>执行方式<select name="schedule_mode"><option value="once">只执行一次</option><option value="interval">每 5 小时继续</option></select></label>
<label>第一次执行时间<input name="next_run" type="datetime-local" required></label>
<div class="wide field"><div class="field-label"><label for="task-prompt">给 Codex 的明确任务</label><div class="voice-area"><button id="voice-button" class="voice-button" type="button" aria-pressed="false" aria-describedby="voice-status"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="12" rx="3"></rect><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3M9 21h6"></path></svg><span id="voice-label">语音输入</span></button><span id="voice-status" class="voice-status" role="status" aria-live="polite"></span></div></div><textarea id="task-prompt" name="prompt" maxlength="20000" required placeholder="写清楚目标、验收条件，以及不能改动的范围。"></textarea></div>
<label class="wide">Ubuntu 会话 ID（可选）<input name="session_id" maxlength="160" placeholder="留空会创建新会话；循环任务会自动续接首次会话"></label>
</div><div class="actions"><button type="submit">加入任务池</button><span class="hint">项目目录固定在允许列表中；成功后自动验证并推送对应 GitHub 仓库。</span></div><div id="notice" class="notice"></div></form></section>
<div class="section-title"><h2>任务</h2><button class="secondary" onclick="loadJobs()">刷新</button></div><section id="jobs" class="jobs"><div class="empty">正在读取…</div></section>
</main><script>
const statusName={scheduled:'已排期',running:'运行中',waiting_quota:'等待额度',needs_attention:'需要你处理',failed:'失败',succeeded:'已完成'};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const when=ts=>ts?new Date(ts*1000).toLocaleString('zh-CN',{hour12:false}):'—';
async function api(path,opt){const r=await fetch(path,opt);const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'请求失败');return d}
const promptInput=document.querySelector('#task-prompt');const voiceButton=document.querySelector('#voice-button');const voiceLabel=document.querySelector('#voice-label');const voiceStatus=document.querySelector('#voice-status');const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;let recognition=null;let listening=false;let voiceBase='';let voiceFinal='';let voiceError=false;
function voiceState(active,message='',error=false){listening=active;voiceButton.classList.toggle('listening',active);voiceButton.setAttribute('aria-pressed',String(active));voiceLabel.textContent=active?'停止听写':'语音输入';voiceStatus.textContent=message;voiceStatus.classList.toggle('error',error)}
if(!window.isSecureContext){voiceButton.disabled=true;voiceState(false,'请先信任这个 HTTPS 地址，浏览器才能使用麦克风。',true)}else if(!Recognition){voiceButton.disabled=true;voiceState(false,'当前浏览器不支持语音听写，请使用最新版 Edge 或 Chrome。',true)}else{recognition=new Recognition();recognition.lang='zh-CN';recognition.continuous=true;recognition.interimResults=true;recognition.onstart=()=>voiceState(true,'正在听，请直接说任务内容…');recognition.onresult=e=>{let interim='';for(let i=e.resultIndex;i<e.results.length;i++){const text=e.results[i][0].transcript.trim();if(e.results[i].isFinal&&text)voiceFinal+=(voiceFinal?' ':'')+text;else if(text)interim+=(interim?' ':'')+text}const spoken=[voiceFinal,interim].filter(Boolean).join(' ');const next=[voiceBase,spoken].filter(Boolean).join(voiceBase&&spoken?'\n':'');promptInput.value=next.slice(0,20000);promptInput.dispatchEvent(new Event('input',{bubbles:true}));if(next.length>20000){voiceError=true;recognition.stop();voiceState(false,'任务内容已达到 20000 字上限。',true)}};recognition.onerror=e=>{voiceError=true;const messages={'not-allowed':'没有麦克风权限，请在地址栏左侧允许麦克风后重试。','audio-capture':'没有检测到可用麦克风。','no-speech':'没有听到声音，请靠近麦克风后重试。','network':'语音识别服务暂时无法连接，请稍后重试。'};voiceState(false,messages[e.error]||`语音输入失败：${e.error}`,true)};recognition.onend=()=>{if(!voiceError)voiceState(false,voiceFinal?'听写完成，可以继续编辑。':'听写已停止。')};voiceButton.addEventListener('click',()=>{if(listening){recognition.stop();return}voiceBase=promptInput.value.trimEnd();voiceFinal='';voiceError=false;voiceState(false,'正在请求麦克风…');try{recognition.start()}catch{voiceState(false,'麦克风正在启动，请稍后再试。',true)}})}
async function loadAccountsAndProjects(){const [a,p]=await Promise.all([api('api/accounts'),api('api/projects')]);const accountSelect=document.querySelector('#account-select');const projectSelect=document.querySelector('#project-select');accountSelect.innerHTML=a.accounts.map(x=>`<option value="${esc(x.slug)}" ${x.auth_state==='ready'?'':'disabled'}>${esc(x.label)}${x.auth_state==='ready'?'':'（待登录）'}</option>`).join('');projectSelect.innerHTML=p.projects.map(x=>`<option value="${esc(x.slug)}">${esc(x.name)}</option>`).join('');const root=document.querySelector('#accounts');root.innerHTML=a.accounts.map(x=>`<div class="account-row"><div><strong>${esc(x.label)}</strong><small>${esc(x.slug)}${x.last_used_at?' · 最近使用 '+when(x.last_used_at):''}</small></div><span class="account-state ${x.auth_state==='ready'?'ready':''}">${x.auth_state==='ready'?'已就绪':'等待一次性登录'}</span></div>`).join('')||'<div class="empty">还没有账号槽位。</div>'}
async function loadJobs(){const root=document.querySelector('#jobs');try{const {jobs}=await api('api/jobs');if(!jobs.length){root.innerHTML='<div class="panel empty">还没有任务。先把一个明确任务放进来。</div>';return}root.innerHTML=jobs.map(j=>`<article class="job"><div class="job-head"><div><h3>${esc(j.title)}</h3><div class="meta">${esc(j.project_name)} · ${esc(j.account_name)} · 下次：${when(j.next_run_at)} · ${j.schedule_mode==='interval'?'每 '+Math.round(j.interval_minutes/60)+' 小时':'一次性'}${j.session_id?' · 会话 '+esc(j.session_id.slice(0,12))+'…':''}</div></div><span class="status ${esc(j.status)}">${esc(statusName[j.status]||j.status)}${j.enabled?'':' · 已暂停'}</span></div><details><summary>查看任务和最近结果</summary><pre>任务：${esc(j.prompt)}\n\n最近结果：\n${esc(j.last_output||'尚未执行')}</pre></details><div class="actions"><button onclick="act(${j.id},'run')">立即运行</button><button class="secondary" onclick="act(${j.id},'toggle')">${j.enabled?'暂停':'恢复'}</button><button class="danger" onclick="removeJob(${j.id})">删除</button></div></article>`).join('')}catch(e){root.innerHTML=`<div class="panel empty">${esc(e.message)}</div>`}}
async function act(id,name){try{await api(`api/jobs/${id}/${name}`,{method:'POST'});await loadJobs()}catch(e){alert(e.message)}}
async function removeJob(id){if(!confirm('确定删除这个任务？'))return;try{await api(`api/jobs/${id}`,{method:'DELETE'});await loadJobs()}catch(e){alert(e.message)}}
const accountForm=document.querySelector('#create-account');accountForm.addEventListener('submit',async e=>{e.preventDefault();const b=accountForm.querySelector('button');b.disabled=true;try{const x=Object.fromEntries(new FormData(accountForm));const result=await api('api/accounts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(x)});const command=document.querySelector('#login-command');command.textContent=result.login_command;command.style.display='block';accountForm.reset();await loadAccountsAndProjects()}catch(err){alert(err.message)}finally{b.disabled=false}});
const form=document.querySelector('#create');const dt=form.elements.next_run;const d=new Date(Date.now()+5*60*1000);d.setMinutes(d.getMinutes()-d.getTimezoneOffset());dt.value=d.toISOString().slice(0,16);
form.addEventListener('submit',async e=>{e.preventDefault();if(listening&&recognition)recognition.stop();const b=form.querySelector('button[type="submit"]');b.disabled=true;const x=Object.fromEntries(new FormData(form));x.next_run_at=Math.floor(new Date(x.next_run).getTime()/1000);delete x.next_run;x.interval_minutes=300;try{await api('api/jobs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(x)});form.elements.title.value='';form.elements.prompt.value='';form.elements.session_id.value='';document.querySelector('#notice').textContent='任务已加入。';document.querySelector('#notice').style.display='block';await loadJobs()}catch(err){alert(err.message)}finally{b.disabled=false}});Promise.all([loadAccountsAndProjects(),loadJobs()]).catch(e=>alert(e.message));setInterval(loadJobs,30000);
</script></body></html>"""


class Handler(BaseHTTPRequestHandler):
    server_version = "CodexQueue/2.0"

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
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Permissions-Policy", "camera=(), microphone=(self), geolocation=()")
        self.send_header(
            "Content-Security-Policy",
            "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; "
            "img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
        )
        self.end_headers()
        self.wfile.write(body)

    def send_json(self, status: int, data: dict) -> None:
        self.send_bytes(status, json.dumps(data, ensure_ascii=False).encode(), "application/json; charset=utf-8")

    def body_json(self) -> dict:
        content_type = self.headers.get("Content-Type", "").split(";", 1)[0].strip().lower()
        if content_type != "application/json":
            raise ValueError("请求必须使用 application/json。")
        length = int(self.headers.get("Content-Length", "0"))
        if length < 0 or length > MAX_PROMPT + 4096:
            raise ValueError("请求内容过大。")
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
                rows = list_jobs(conn, "ORDER BY jobs.created_at DESC, jobs.id DESC")
            self.send_json(200, {"jobs": [row_dict(row) for row in rows]})
            return
        if path == "/api/accounts":
            with connect(self.db_path) as conn:
                rows = conn.execute(
                    "SELECT slug,label,auth_state,last_used_at,created_at FROM accounts ORDER BY id"
                ).fetchall()
            self.send_json(200, {"accounts": [dict(row) for row in rows]})
            return
        if path == "/api/projects":
            with connect(self.db_path) as conn:
                rows = conn.execute(
                    "SELECT slug,name,default_branch FROM projects ORDER BY name COLLATE NOCASE"
                ).fetchall()
            self.send_json(200, {"projects": [dict(row) for row in rows]})
            return
        self.send_json(404, {"error": "Not found"})

    def do_POST(self) -> None:
        if not self.same_origin():
            self.send_json(403, {"error": "跨站请求已拒绝。"})
            return
        path = urlparse(self.path).path
        if not rate_allowed(self.client_address[0], "mutation", MUTATION_LIMIT):
            self.send_json(429, {"error": "操作过于频繁，请一分钟后重试。"})
            return
        if path == "/api/accounts":
            try:
                data = self.body_json()
                label = str(data.get("label", "")).strip()
                slug = str(data.get("slug", "")).strip().lower()
                if not label or len(label) > 80:
                    raise ValueError("账号称呼不能为空且不能超过 80 个字符。")
                if not SAFE_SLUG_RE.fullmatch(slug):
                    raise ValueError("账号标识需以小写字母开头，只能包含小写字母、数字和连字符。")
                stamp = now()
                with connect(self.db_path) as conn:
                    conn.execute(
                        "INSERT INTO accounts(slug,label,auth_state,created_at,updated_at) VALUES(?,?,'pending',?,?)",
                        (slug, label, stamp, stamp),
                    )
                    conn.commit()
                command = f"ssh -t frankrain@192.168.110.49 '/home/frankrain/server/apps/codex-queue/account-login.sh {slug}'"
                self.send_json(201, {"ok": True, "slug": slug, "login_command": command})
            except sqlite3.IntegrityError:
                self.send_json(409, {"error": "这个账号标识已经存在。"})
            except (ValueError, TypeError, json.JSONDecodeError) as exc:
                self.send_json(400, {"error": str(exc)})
            return
        if path == "/api/jobs":
            try:
                data = self.body_json()
                title = redact_sensitive(str(data.get("title", "")).strip())[:120]
                prompt = redact_sensitive(str(data.get("prompt", "")).strip())
                project_key = str(data.get("project", "butler")).strip().lower()
                account_slug = str(data.get("account", "primary")).strip().lower()
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
                    project = conn.execute("SELECT * FROM projects WHERE slug=?", (project_key,)).fetchone()
                    account = conn.execute("SELECT * FROM accounts WHERE slug=?", (account_slug,)).fetchone()
                    if not project:
                        raise ValueError("项目无效。")
                    if not account or account["auth_state"] != "ready":
                        raise ValueError("执行账号不存在或尚未完成登录。")
                    cursor = conn.execute(
                        "INSERT INTO jobs(title,prompt,repo_path,session_id,schedule_mode,"
                        "interval_minutes,next_run_at,created_at,updated_at,account_id) VALUES(?,?,?,?,?,?,?,?,?,?)",
                        (
                            title,
                            prompt,
                            project["repo_path"],
                            session,
                            mode,
                            interval,
                            next_run,
                            stamp,
                            stamp,
                            account["id"],
                        ),
                    )
                    conn.commit()
                self.send_json(201, {"ok": True, "id": cursor.lastrowid})
            except (ValueError, TypeError, json.JSONDecodeError) as exc:
                self.send_json(400, {"error": str(exc)})
            return

        match = re.fullmatch(r"/api/jobs/(\d+)/(run|toggle)", path)
        if match:
            job_id, action = int(match.group(1)), match.group(2)
            if action == "run" and not rate_allowed(self.client_address[0], "run", RUN_LIMIT):
                self.send_json(429, {"error": "立即运行操作一分钟最多 6 次。"})
                return
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


def account_init(db_path: str, slug: str, label: str) -> int:
    slug = slug.strip().lower()
    label = label.strip()
    if not SAFE_SLUG_RE.fullmatch(slug):
        raise ValueError("账号标识需以小写字母开头，只能包含小写字母、数字和连字符。")
    if not label or len(label) > 80:
        raise ValueError("账号称呼不能为空且不能超过 80 个字符。")
    stamp = now()
    with connect(db_path) as conn:
        conn.execute(
            "INSERT INTO accounts(slug,label,auth_state,created_at,updated_at) VALUES(?,?,'pending',?,?) "
            "ON CONFLICT(slug) DO UPDATE SET label=excluded.label,updated_at=excluded.updated_at",
            (slug, label, stamp, stamp),
        )
        conn.commit()
    path = ensure_account_home(slug)
    print(f"账号槽位已准备：{slug} ({path})")
    return 0


def account_mark_ready(db_path: str, slug: str) -> int:
    slug = slug.strip().lower()
    path = account_home(slug)
    auth_file = path / "auth.json"
    if not auth_file.is_file() or auth_file.stat().st_size < 100:
        raise ValueError("没有找到有效的 auth.json；请先完成 Codex 登录。")
    os.chmod(path, 0o700)
    os.chmod(auth_file, 0o600)
    with connect(db_path) as conn:
        cursor = conn.execute(
            "UPDATE accounts SET auth_state='ready',updated_at=? WHERE slug=?",
            (now(), slug),
        )
        conn.commit()
    if cursor.rowcount != 1:
        raise ValueError("账号槽位不存在，请先执行 account-init。")
    print(f"账号 {slug} 已就绪；凭据内容未写入数据库。")
    return 0


def account_prepare(db_path: str, slug: str) -> int:
    slug = slug.strip().lower()
    with connect(db_path) as conn:
        account = conn.execute("SELECT slug FROM accounts WHERE slug=?", (slug,)).fetchone()
    if not account:
        raise ValueError("账号槽位不存在，请先在任务池网页新增账号。")
    path = ensure_account_home(slug)
    print(f"账号目录已准备：{path}")
    return 0


def project_register(db_path: str, slug: str, name: str, repo: str, branch: str) -> int:
    slug = slug.strip().lower()
    name = name.strip()
    branch = branch.strip()
    if not SAFE_SLUG_RE.fullmatch(slug):
        raise ValueError("项目标识需以小写字母开头，只能包含小写字母、数字和连字符。")
    if not name or len(name) > 100:
        raise ValueError("项目名称不能为空且不能超过 100 个字符。")
    if not SAFE_GIT_REF_RE.fullmatch(branch) or ".." in branch:
        raise ValueError("项目分支名称无效。")
    repo_path = validated_repo_path(repo)
    stamp = now()
    with connect(db_path) as conn:
        conn.execute(
            "INSERT INTO projects(slug,name,repo_path,default_branch,created_at,updated_at) VALUES(?,?,?,?,?,?) "
            "ON CONFLICT(slug) DO UPDATE SET name=excluded.name,repo_path=excluded.repo_path,"
            "default_branch=excluded.default_branch,updated_at=excluded.updated_at",
            (slug, name, repo_path, branch, stamp, stamp),
        )
        conn.commit()
    print(f"项目已注册：{slug} -> {repo_path} ({branch})")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Codex task queue")
    parser.add_argument("--db", default=os.environ.get("CODEX_QUEUE_DB", DEFAULT_DB))
    sub = parser.add_subparsers(dest="command", required=True)
    web = sub.add_parser("serve")
    web.add_argument("--host", default="127.0.0.1")
    web.add_argument("--port", type=int, default=3765)
    sub.add_parser("run-due")
    init = sub.add_parser("account-init")
    init.add_argument("slug")
    init.add_argument("label")
    ready = sub.add_parser("account-mark-ready")
    ready.add_argument("slug")
    prepare = sub.add_parser("account-prepare")
    prepare.add_argument("slug")
    project = sub.add_parser("project-register")
    project.add_argument("slug")
    project.add_argument("name")
    project.add_argument("repo")
    project.add_argument("--branch", default="master")
    args = parser.parse_args()
    if args.command == "serve":
        serve(args.db, args.host, args.port)
        return 0
    if args.command == "account-init":
        return account_init(args.db, args.slug, args.label)
    if args.command == "account-mark-ready":
        return account_mark_ready(args.db, args.slug)
    if args.command == "account-prepare":
        return account_prepare(args.db, args.slug)
    if args.command == "project-register":
        return project_register(args.db, args.slug, args.name, args.repo, args.branch)
    return run_due(args.db)


if __name__ == "__main__":
    raise SystemExit(main())
