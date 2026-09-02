# Butler Codex task queue

This service provides a small LAN-only task queue for the Codex CLI on the
Ubuntu server. It intentionally stops instead of guessing when Codex requests
human input, tests fail, or Git cannot push cleanly.

The worker uses a dedicated Git clone, runs Codex with `workspace-write`, builds
the web application, and pushes successful changes to `master`. GitHub Actions
validates the commit, then the server-side deployment timer releases it.

The web UI is intended to sit behind the existing Caddy Basic Authentication at
`/codex-queue/`; port 3765 must not be opened in UFW.
