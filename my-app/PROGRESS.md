# Current implementation status

## 2026-10-21 — English documentation and source maintenance

The repository entry, development references and public descriptions use English technical terminology. The current agent entry documents SQLite persistence, configurable Ollama models and the independent MCP vault. Historical Windows diagnostics, registry/startup backups and UI comparison samples have been removed from the working tree. Original implementation history remains in Git.

## Delivered components

- React/Next.js workspace: chat, tasks, calendar, Markdown notes, recurring tasks, linked records and schema-driven panels.
- Browser IndexedDB plus Next.js state APIs backed by SQLite.
- Primary/alternate Ollama inference with independent endpoint/model overrides and streaming tool-call handling.
- Browser PDF extraction and MiniLM passage selection; optional Mistral OCR.
- Independent 14-tool MCP stdio server with atomic JSON persistence.
- Windows application, MCP runtime and complete source archives.

## Release history

| Record | Technical change |
|---|---|
| 090 / 2026-10-19 | Portable packages, configurable model overrides, component guides and public documentation |
| 089 | Primary and alternate Ollama routing; shared SQLite state |
| 079 | Recurring-task definitions and period-based instance materialization |
| Earlier implementation | Task/calendar/note integration, document processing, confirmation cards, interface assets and local preferences |

Current references: [architecture](docs/architecture.md), [setup](docs/setup.md), [workflow](docs/workflow.md), [integration notes](docs/pitfalls.md). Tauri packaging, hosted multi-tenant identity and production billing remain future extensions.
