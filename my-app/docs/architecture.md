# Butler architecture

## Application boundary

The browser renders Chat, Tasks, Calendar and Notes with React. Next.js provides server routes for streaming chat, persistent state, extraction and OCR. Shared TypeScript packages contain domain types, data-access helpers and workflow definitions.

| Layer | Entry points | Responsibility |
|---|---|---|
| Workspace | `apps/web/src/app/page.tsx`, `src/components/` | Navigation, forms, confirmation cards and derived views |
| Browser state | `apps/web/src/lib/db.ts` | Dexie schemas, IndexedDB records and hydration |
| Server state | `apps/web/src/app/api/state/route.ts`, `src/lib/server-db.ts` | Validated state keys and SQLite persistence |
| Inference | `apps/web/src/app/api/chat/route.ts`, `src/lib/ai-models.ts` | Endpoint selection, configured model, streaming and bounded tool exchanges |
| Documents | `src/lib/document-parser.ts`, `src/lib/semantic-filter.ts`, `src/lib/ocr/` | PDF extraction, MiniLM passage filtering and optional Mistral OCR |
| Tools | `src/lib/ai-tools.ts`, `src/components/ConfirmCard.tsx` | Structured proposals and user-approved web mutations |
| MCP | `../butler-mcp/src/` | JSON-RPC over stdio, 14 tools, atomic JSON-vault writes |

Paths in the table are relative to `my-app/` unless prefixed with `../`.

## Data flow

1. IndexedDB hydration initializes browser records before synchronization starts.
2. UI actions update typed task, note, conversation, event and recurring-work records.
3. The state endpoint validates supported keys and stores JSON values in SQLite.
4. Chat selects bounded workspace context and streams a response from the configured Ollama route.
5. Tool requests become confirmation cards; accepting a card invokes the application's validated mutation path.
6. The independent MCP server reads and writes the path selected by `BUTLER_VAULT`. Dated tasks are projected as calendar events.

## Model configuration

Primary and alternate routes each have endpoint and model overrides. Configuration defaults select Qwen3 through Ollama. `Xenova/all-MiniLM-L6-v2` runs the semantic document-filtering stage in the browser. Mistral OCR is an optional remote service for scanned input.

Compatibility IDs in saved preferences remain stable. Document the actual `model` value sent by the server instead of inferring a provider from an ID.

## Extension points

Schema-driven panels, recurring-task materialization and shared packages extend the workspace. Payment screens are simulations. The current service is a single-user local application; a hosted multi-user service requires a separate identity and authorization design.
