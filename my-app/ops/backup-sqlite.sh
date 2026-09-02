#!/bin/sh
set -eu

butler_backup_dir=/home/frankrain/server/data/butler/backups
queue_dir=/home/frankrain/server/data/codex-queue
queue_backup_dir="$queue_dir/backups"
stamp=$(date -u +%Y%m%dT%H%M%SZ)

install -d -o 1000 -g 1000 -m 700 "$butler_backup_dir" "$queue_backup_dir"

# better-sqlite3 performs an online backup while Butler continues serving.
docker exec butler-web node -e "const Database=require('better-sqlite3'); const db=new Database('/data/butler.sqlite',{readonly:true}); db.backup('/data/backups/butler-${stamp}.sqlite').then(()=>db.close()).catch((error)=>{console.error(error);process.exit(1)})"

# Python's SQLite backup API is also online-safe and includes committed WAL data.
python3 - "$queue_dir/queue.sqlite" "$queue_backup_dir/codex-queue-${stamp}.sqlite" <<'PY'
import sqlite3
import sys

source_path, destination_path = sys.argv[1:]
with sqlite3.connect(source_path) as source, sqlite3.connect(destination_path) as destination:
    source.backup(destination)
PY
chown 1000:1000 "$queue_backup_dir/codex-queue-${stamp}.sqlite"
chmod 600 "$queue_backup_dir/codex-queue-${stamp}.sqlite"

find "$butler_backup_dir" -maxdepth 1 -type f -name 'butler-*.sqlite' -mtime +14 -delete
find "$queue_backup_dir" -maxdepth 1 -type f -name 'codex-queue-*.sqlite' -mtime +14 -delete
