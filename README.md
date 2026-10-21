<p align="center"><img src="docs/assets/butler-mark.svg" alt="Butler logo" width="100"></p>

# Butler — Local AI Learning Workspace

Butler combines tasks, calendar events, Markdown notes and document-assisted chat in a local web application. React renders the workspace, Next.js serves the API, and SQLite stores application state. Model-generated changes are presented as confirmation cards before the web application applies them.

**TypeScript · Next.js · React · SQLite · IndexedDB · Ollama · MCP**

[Windows downloads](https://github.com/frankrainrp/Bulter/releases/tag/v0.1.0) · [Installation](docs/DISTRIBUTION.md) · [Architecture](my-app/docs/architecture.md)

## Implementation

| Feature | Implementation | Source |
|---|---|---|
| Tasks, calendar and notes | React components, typed records, recurring-task materialization and linked notes | [Components](my-app/apps/web/src/components), [types](my-app/apps/web/src/lib/types.ts) |
| Persistent state | Browser IndexedDB plus validated Next.js state endpoints backed by SQLite | [Browser database](my-app/apps/web/src/lib/db.ts), [server database](my-app/apps/web/src/lib/server-db.ts) |
| Streaming assistant | OpenAI-compatible requests to configurable primary and alternate Ollama endpoints | [Chat API](my-app/apps/web/src/app/api/chat/route.ts), [route registry](my-app/apps/web/src/lib/ai-models.ts) |
| Assisted writes | Tool schemas produce pending operations; the user confirms changes in the browser | [Tools](my-app/apps/web/src/lib/ai-tools.ts), [confirmation card](my-app/apps/web/src/components/ConfirmCard.tsx) |
| Document processing | `unpdf` extracts PDF text; `Xenova/all-MiniLM-L6-v2` selects relevant passages; Mistral OCR handles optional scanned-document processing | [Parser](my-app/apps/web/src/lib/document-parser.ts), [semantic filter](my-app/apps/web/src/lib/semantic-filter.ts) |
| MCP tools | Separate stdio server with 14 tools and an atomic JSON vault | [MCP server](butler-mcp/README.md) |

## Run on Windows

1. Extract `Bulter-Windows-x64.zip` into a writable directory.
2. Run `Start-Bulter.cmd` and open `http://127.0.0.1:3000`.
3. Create tasks, events and notes. The package creates its own local database.
4. For chat, install Ollama and the model selected in `config.json`.

The package includes Node.js, the browser application, the Next.js server and production dependencies. `config.json` defaults to `qwen3:0.6b`; model weights are installed separately. Primary and alternate endpoints have independent model settings. The source registry uses `huihui_ai/qwen3-abliterated:30b` when no environment override is supplied.

## Build from source

Requires Node.js 20+ and pnpm 9.

```sh
git clone https://github.com/frankrainrp/Bulter.git
cd Bulter/my-app
pnpm install --frozen-lockfile
```

Copy `apps/web/.env.local.example` to `apps/web/.env.local`, configure an installed Ollama model, then run:

```sh
pnpm --filter @smart-hub/web dev --hostname 127.0.0.1
pnpm --filter @smart-hub/web build
```

Build the MCP component separately:

```sh
cd ../butler-mcp
npm ci
npm run build
npm run smoke
```

## Components and data boundaries

The browser and API form a single-user application bound to loopback. The MCP component is a separate process with its own JSON vault; it does not automatically synchronize with browser or SQLite state. MCP clients control approval for their own tool calls.

[`C270_FA_DEPLOYMENT`](https://github.com/frankrainrp/C270_FA_DEPLOYMENT) is the Node.js/Express/MongoDB Study Butler implementation. Its Docker deployment is separate from this Next.js/Ollama package. [`Hackathon`](https://github.com/frankrainrp/Hackathon) contains the course-synchronization edition.

## Development

[Agent entry](AGENTS.md) · [Current status](my-app/PROGRESS.md) · [Setup](my-app/docs/setup.md) · [Integration notes](my-app/docs/pitfalls.md)
