# Bulter — Local AI Learning Assistant

Turn study material and conversations into tasks, calendar entries and linked notes, with user confirmation before the web assistant applies changes.

**TypeScript · Next.js · React · SQLite · IndexedDB · Ollama · MCP**

[Download Windows packages](https://github.com/frankrainrp/Bulter/releases/tag/v0.1.0) · [Installation & component guide](docs/DISTRIBUTION.md) · [中文说明](docs/README.zh-CN.md)

## What you can do

- Organize tasks, recurring work, calendar entries and Markdown notes in one workspace.
- Ask an assistant to prepare changes, inspect the confirmation card, then apply them.
- Extract text from PDFs; use browser-side MiniLM filtering before sending selected content to inference. Scanned documents use an optional Mistral OCR integration.
- Build schema-driven panels from structured data sources and AI-generated specifications.
- Connect an MCP client to the separate **14-tool MCP server** for notes, tasks, dated events and recurring workflows.

## Try the Windows application

1. Download **Bulter-Windows-x64.zip** from the release and extract it into a writable folder.
2. Double-click **Start-Bulter.cmd**. Open **http://127.0.0.1:3000** when the server is ready.
3. Try Tasks, Calendar and Notes. The local planning features work without a model.
4. For AI, install Ollama separately and pull the model named in `config.json` (the package starts with `qwen3:0.6b`). Restart the application after changing configuration. Model weights are separate downloads.

The package includes a Windows Node.js runtime, the built browser client, the local Next.js API server and production dependencies. It starts with an empty database. Stop the console with Ctrl+C. The English/Chinese language option covers core navigation and settings; some panel text remains Chinese.

## Engineering walkthrough

| Component | Implementation | Source |
|---|---|---|
| Browser workspace | React, TypeScript, Dexie/IndexedDB; task/calendar/note views | [UI source](my-app/apps/web/src/components), [local store](my-app/apps/web/src/lib/db.ts) |
| Local persistence | Next.js `/api/state`, validated keys and SQLite state storage | [API](my-app/apps/web/src/app/api/state/route.ts), [SQLite](my-app/apps/web/src/lib/server-db.ts) |
| Inference | OpenAI-compatible streaming calls to configurable primary/alternate Ollama routes | [Chat API](my-app/apps/web/src/app/api/chat/route.ts), [model registry](my-app/apps/web/src/lib/ai-models.ts) |
| Assisted changes | Tool schemas, pending proposals and a confirmation card in the web app | [Tools](my-app/apps/web/src/lib/ai-tools.ts), [confirmation UI](my-app/apps/web/src/components/ConfirmCard.tsx) |
| Document processing | unpdf, `Xenova/all-MiniLM-L6-v2`, optional Mistral OCR | [Parser](my-app/apps/web/src/lib/document-parser.ts), [filter](my-app/apps/web/src/lib/semantic-filter.ts) |
| MCP integration | 14 tools over stdio, backed by an atomic JSON vault | [MCP server](butler-mcp/src/index.ts), [store](butler-mcp/src/store.ts) |

The historical IDs `deepseek-v4-flash` and `deepseek-v4-thinking` select routes; they are not evidence that DeepSeek V4 is running. The source registry falls back to `huihui_ai/qwen3-abliterated:30b`. `OLLAMA_SERVER_MODEL` and `OLLAMA_WINDOWS_MODEL` override the actual model independently. The portable launcher sets these from `config.json`.

The MCP server uses its own JSON vault. It does **not** automatically synchronize with the browser or SQLite store. MCP tool calls execute directly; the web application's confirmation-card policy does not automatically apply to an external MCP client.

## Build from source

Requires Node.js 20+ and pnpm 9. The ready-to-run Windows package bundles its own runtime.

```sh
git clone https://github.com/frankrainrp/Bulter.git
cd Bulter/my-app
pnpm install --frozen-lockfile
```

Copy `apps/web/.env.local.example` to `apps/web/.env.local`, configure a model already installed in Ollama, then:

```sh
pnpm --filter @smart-hub/web dev --hostname 127.0.0.1
# production build:
pnpm --filter @smart-hub/web build
```

For MCP: `cd butler-mcp`, then `npm ci`, `npm run build`, `npm run smoke`. See the [MCP guide](butler-mcp/README.md).

## Editions and scope

[Hackathon](https://github.com/frankrainrp/Hackathon) is a related learning-assistant edition with Brightspace synchronization, course text retrieval and an existing Windows bundle. Its school worker is optional and is not included in this core release. The two repositories belong to one project family rather than two independent products.

This is a single-user, loopback application. `/api/state` is not protected by internet-grade authentication; keep the packaged listener on `127.0.0.1`. Billing screens are simulations. Tauri and multi-tenant cloud authentication are not delivered by this release. Model services, OCR services and first-use MiniLM downloads have their own connectivity requirements.

## Planned illustrations

Two illustrations are specified in [the diagram brief](docs/DIAGRAM_BRIEF.md): a technical implementation map and a plain-language capability map. They will be produced in a later step.
