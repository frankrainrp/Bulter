# Butler development entry

## Current implementation

The web application uses Next.js, React and TypeScript. Browser state uses Dexie/IndexedDB; `/api/state` persists validated state keys in SQLite through `src/lib/server-db.ts`. The independent `../butler-mcp` service exposes 14 stdio tools backed by a JSON vault.

Chat uses configurable primary and alternate Ollama routes. `OLLAMA_SERVER_MODEL` and `OLLAMA_WINDOWS_MODEL` select actual model names. The IDs `deepseek-v4-flash` and `deepseek-v4-thinking` are compatibility identifiers, not model identities. The example environment and portable configuration select `qwen3:0.6b`; the source registry fallback is `huihui_ai/qwen3-abliterated:30b`.

## Read by task

| Task | Reference |
|---|---|
| Determine current state | `PROGRESS.md` |
| Change storage, tools or component boundaries | `docs/architecture.md` |
| Configure endpoints or build packages | `docs/setup.md` and `../docs/DISTRIBUTION.md` |
| Diagnose document processing, streams or hydration | `docs/pitfalls.md` |
| Change the MCP component | `../butler-mcp/README.md` |
| Change development automation | `ops/codex-queue/README.md` |

## Implementation rules

- Preserve the web application's confirmation-card path for model-proposed writes. Keep validation in application code.
- Keep browser, SQLite and MCP storage responsibilities explicit. A bridge requires an implemented synchronization protocol and tests.
- Preserve existing IndexedDB migration steps and hydration gates; normalize serialized date fields before use.
- Configure models and network locations server-side. Keep credentials, local state and machine-specific addresses out of committed examples.
- Preserve the established interface and assets when changing backend behavior.
- Use synthetic data for verification. Run the web production build for web code changes and `npm run smoke` for MCP behavior changes.
- Keep documentation in English. Update the relevant technical reference and the short current-status record when behavior changes.

`../AGENTS.md` is the repository entry. `docs/workflow.md` defines change completion. Tauri packaging and multi-tenant hosted identity are future work, not current runtime dependencies.
