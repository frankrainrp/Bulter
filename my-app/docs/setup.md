# Development setup

Requires Node.js 20+ and pnpm 9. From `my-app/`:

```sh
pnpm install --frozen-lockfile
pnpm --filter @smart-hub/web dev --hostname 127.0.0.1
pnpm --filter @smart-hub/web build
```

Copy `apps/web/.env.local.example` to `apps/web/.env.local`. The template configures `http://127.0.0.1:11434/v1` and `qwen3:0.6b`; install that model in Ollama before testing chat.

| Setting | Purpose |
|---|---|
| `OLLAMA_SERVER_BASE_URL` / `OLLAMA_SERVER_MODEL` | Primary endpoint and actual model |
| `OLLAMA_WINDOWS_BASE_URL` / `OLLAMA_WINDOWS_MODEL` | Optional alternate endpoint and actual model |
| `DEEPSEEK_BASE_URL` / `DEEPSEEK_MODEL` / `DEEPSEEK_API_KEY` | Compatibility settings used by the OpenAI-compatible client |
| `BUTLER_DB_PATH` | SQLite state file |
| `MISTRAL_API_KEY` / `MISTRAL_BASE_URL` | Optional scanned-document OCR credentials and endpoint |
| `OCR_PROVIDER` | OCR provider selection; inspect the provider registry for implemented adapters |

The registry fallback is `huihui_ai/qwen3-abliterated:30b`; the example environment overrides it. UI route identifiers are retained for saved-state compatibility.

Text PDFs use `unpdf` and browser-side MiniLM passage filtering. Semantic-model assets may be downloaded on first use. Scanned files require the configured OCR service.

## MCP

From `butler-mcp/`, run `npm ci`, `npm run build`, then `npm run smoke`. Set `BUTLER_VAULT` to a writable JSON-vault path. The MCP process does not open a TCP listener.

## Data and packaging

Keep `.env.local`, SQLite databases and personal vaults outside version control. Preserve IndexedDB migration history and use synthetic files for document tests. Source archives include agent instructions, tests, package manifests and lockfiles. Windows archives additionally include the runtime and production dependencies. See `../../docs/DISTRIBUTION.md`.
