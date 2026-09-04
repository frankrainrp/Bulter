# Ubuntu Codex 多账号任务池

任务池把“什么时候继续、用哪个 Codex 账号、处理哪个 Git 项目”保存在 SQLite 中。网页运行在只读 Docker 容器里；真正执行任务时，宿主机 worker 为所选账号启动一次性 Codex runner 容器。容器只挂载该账号的 `CODEX_HOME` 与当前项目目录，不挂载 Docker socket，也不接触其他账号或其他项目。

## 边界

- 网页只保存账号标签和状态，不接受账号密码、API key 或 `auth.json` 内容。
- 每套官方 Codex 登录缓存位于 `/home/frankrain/server/data/codex-queue/accounts/<slug>/`，目录权限 `0700`，文件权限 `0600`。
- 每次任务在 `workspace-write` 沙箱和额外 Docker 边界中运行；账号缓存不写入镜像或 Git。
- 项目自己的安装、测试与构建也在无账号缓存、无 Docker socket 的临时容器中执行，不在 Ubuntu 宿主机直接运行。
- worker 会锁定任务开始前的 Git HEAD、remote 与配置摘要；任务容器若改动这些控制状态，会停止而不会提交。宿主机提交显式禁用 Git hooks。
- 项目必须位于 `/home/frankrain/server/automation-workspaces/`，worker 会拒绝其他路径。
- 任务完成后先在隔离容器中运行项目验证，再由宿主机提交和推送；测试失败、额度不足、冲突或需要人做决定时会暂停。
- Web API 只在现有局域网 HTTPS 入口下使用，并保留同源写入检查和速率限制。它没有成员密码，任何能进入受信家庭局域网的人都可以看到任务标题和结果。

## 运行形态

- `compose.yaml`：Web UI，端口 `3765`，由 Caddy 暴露为 `/codex-queue/`。
- `codex-queue-worker.timer`：每 30 秒检查一次，仅领取一个到期任务。
- `Dockerfile.runner`：包含 Codex CLI 0.151.0、Git、Node 与 Python 的一次性执行环境。
- `account-login.sh`：为一个账号槽位执行官方 device-auth 登录。
- `register-project.sh`：只从 GitHub 克隆并登记一个项目。

## 部署与验收

```bash
docker build -f Dockerfile.runner -t local/codex-queue-runner:0.151.0 .
docker compose up --build -d --wait
sudo systemctl enable --now codex-queue-worker.timer
curl --fail http://127.0.0.1:3765/api/health
```

主账号迁移只复制现有 `/home/frankrain/.codex/auth.json` 到独立账号目录，不打印文件内容。添加新账号时先在网页创建标签，再运行网页给出的 `ssh -t ... account-login.sh <slug>`；登录完成后刷新网页即可选择。
