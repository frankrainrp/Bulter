# Containerized development task queue

The queue stores execution account, project, schedule and task state in SQLite. A read-only web container manages task definitions. A host worker claims one due task and starts a disposable runner with only the selected account environment and project workspace mounted.

## Runtime

| Component | Responsibility |
|---|---|
| `compose.yaml` | Web service on port 3765 behind the configured private HTTPS proxy |
| `codex-queue-worker.timer` | Periodic worker activation |
| `Dockerfile.runner` | Versioned development CLI, Git, Node.js and Python runtime |
| `account-login.sh` | Official device-auth flow for an account slot |
| `register-project.sh` | GitHub project registration in the approved workspace root |

The web service stores account labels and status, not passwords or login-cache contents. Account directories have restricted permissions. A runner receives neither the Docker socket nor unrelated account/project mounts. Installation, build and test verification use separate disposable containers without account credentials.

The worker records the initial Git HEAD, remote and configuration. It verifies task changes before committing and pushing, with Git hooks disabled for host commits. Conflicts, failed verification, exhausted usage or missing decisions put the task into an attention state.

## Deployment

```sh
docker build -f Dockerfile.runner -t local/codex-queue-runner:0.151.0 .
docker compose up --build -d --wait
sudo systemctl enable --now codex-queue-worker.timer
curl --fail http://127.0.0.1:3765/api/health
```

Use deployment-specific account and workspace paths from the service configuration. This interface uses the trusted private network as its access boundary. [Project registration](PROJECT_REGISTRATION.md)
