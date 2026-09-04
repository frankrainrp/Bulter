#!/usr/bin/env bash
set -euo pipefail

slug="${1:-}"
if [[ ! "$slug" =~ ^[a-z][a-z0-9-]{1,47}$ ]]; then
  echo "账号标识无效。" >&2
  exit 2
fi

app=/home/frankrain/server/apps/codex-queue
data=/home/frankrain/server/data/codex-queue
account_home="$data/accounts/$slug"
image=local/codex-queue-runner:0.151.0

python3 "$app/codex_queue.py" --db "$data/queue.sqlite" account-prepare "$slug"
docker run --rm -it \
  --user 1000:1000 \
  --read-only \
  --cap-drop ALL \
  --security-opt no-new-privileges \
  --pids-limit 256 \
  --memory 2g \
  --cpus 2 \
  --tmpfs /tmp:rw,nosuid,noexec,size=128m \
  --env HOME=/codex-home \
  --env CODEX_HOME=/codex-home \
  --volume "$account_home:/codex-home" \
  "$image" login --device-auth
python3 "$app/codex_queue.py" --db "$data/queue.sqlite" account-mark-ready "$slug"
echo "账号 $slug 已可在任务池中选择。"
