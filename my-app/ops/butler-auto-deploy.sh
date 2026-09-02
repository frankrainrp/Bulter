#!/usr/bin/env bash
set -euo pipefail

repo_url="https://github.com/frankrainrp/Bulter.git"
branch="master"
deploy_root="/home/frankrain/server/deploy/butler"
mirror_dir="$deploy_root/source"
release_root="/home/frankrain/server/releases/butler"
state_dir="/home/frankrain/server/state"
state_file="$state_dir/butler-deployed-sha"
compose_dir="/home/frankrain/server/compose/butler"
lock_file="$state_dir/butler-deploy.lock"

mkdir -p "$deploy_root" "$release_root" "$state_dir"
exec 9>"$lock_file"
flock -n 9 || exit 0

if [[ ! -d "$mirror_dir/.git" ]]; then
  git clone --filter=blob:none --no-checkout "$repo_url" "$mirror_dir"
fi

git -C "$mirror_dir" fetch --quiet --prune origin "$branch"
target_sha="$(git -C "$mirror_dir" rev-parse "origin/$branch")"
deployed_sha="$(cat "$state_file" 2>/dev/null || true)"
[[ "$target_sha" == "$deployed_sha" ]] && exit 0

# Deploy only after the GitHub-hosted CI run for this exact commit succeeds.
ci_state="$(python3 - "$target_sha" <<'PY'
import json, sys, urllib.request

sha = sys.argv[1]
url = "https://api.github.com/repos/frankrainrp/Bulter/actions/runs?branch=master&event=push&per_page=20"
request = urllib.request.Request(url, headers={"Accept": "application/vnd.github+json", "User-Agent": "butler-homeserver"})
with urllib.request.urlopen(request, timeout=20) as response:
    runs = json.load(response).get("workflow_runs", [])
matching = next((run for run in runs if run.get("head_sha") == sha and run.get("name") == "Butler CI"), None)
if not matching:
    print("missing")
elif matching.get("status") != "completed":
    print("running")
else:
    print(matching.get("conclusion") or "unknown")
PY
)"

if [[ "$ci_state" != "success" ]]; then
  logger -t butler-deploy "Waiting for successful CI: sha=$target_sha state=$ci_state"
  exit 0
fi

short_sha="${target_sha:0:12}"
release_dir="$release_root/$target_sha"
if [[ ! -d "$release_dir/my-app" ]]; then
  staging_dir="$(mktemp -d "$release_root/.staging-XXXXXX")"
  trap 'rm -rf "${staging_dir:-}"' EXIT
  git -C "$mirror_dir" archive "$target_sha" my-app | tar -x -C "$staging_dir"
  mv "$staging_dir" "$release_dir"
  trap - EXIT
fi

previous_image="$(docker inspect --format '{{.Config.Image}}' butler-web 2>/dev/null || true)"
export BUTLER_BUILD_CONTEXT="$release_dir/my-app"
export BUTLER_IMAGE_TAG="$short_sha"

cd "$compose_dir"
docker compose build web
docker compose up -d --no-deps web

healthy="false"
for _ in $(seq 1 45); do
  status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' butler-web 2>/dev/null || true)"
  if [[ "$status" == "healthy" ]]; then
    healthy="true"
    break
  fi
  sleep 2
done

if [[ "$healthy" != "true" ]]; then
  logger -t butler-deploy "Deployment failed health check: sha=$target_sha"
  if [[ -n "$previous_image" ]]; then
    export BUTLER_IMAGE_TAG="${previous_image##*:}"
    docker compose up -d --no-deps web
  fi
  exit 1
fi

printf '%s\n' "$target_sha" > "$state_file"
ln -sfn "$release_dir" "$release_root/current"
logger -t butler-deploy "Deployment succeeded: sha=$target_sha"

# Keep the current release plus the four most recent historical releases.
find "$release_root" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' \
  | sort -nr \
  | awk 'NR > 5 {print $2}' \
  | xargs -r rm -rf --
