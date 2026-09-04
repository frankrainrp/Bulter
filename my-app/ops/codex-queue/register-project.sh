#!/usr/bin/env bash
set -euo pipefail

slug="${1:-}"
name="${2:-}"
remote="${3:-}"
branch="${4:-master}"
if [[ ! "$slug" =~ ^[a-z][a-z0-9-]{1,47}$ ]]; then
  echo "项目标识无效。" >&2
  exit 2
fi
case "$remote" in
  https://github.com/*|git@github.com:*) ;;
  *) echo "目前只接受 GitHub HTTPS 或 SSH 仓库地址。" >&2; exit 2 ;;
esac
case "$branch" in
  *..*|*[!A-Za-z0-9._/-]*) echo "分支名称无效。" >&2; exit 2 ;;
esac

root=/home/frankrain/server/automation-workspaces
target="$root/$slug"
app=/home/frankrain/server/apps/codex-queue
data=/home/frankrain/server/data/codex-queue

if [[ -e "$target" && ! -d "$target/.git" ]]; then
  echo "目标目录已存在但不是 Git 仓库：$target" >&2
  exit 3
fi
if [[ ! -d "$target/.git" ]]; then
  git clone --branch "$branch" --single-branch --origin origin -- "$remote" "$target"
fi
python3 "$app/codex_queue.py" --db "$data/queue.sqlite" project-register "$slug" "$name" "$target" --branch "$branch"
