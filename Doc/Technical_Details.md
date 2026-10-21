# Technical reference

The maintained implementation is described in `../my-app/docs/architecture.md`, with configuration in `../my-app/docs/setup.md` and integration constraints in `../my-app/docs/pitfalls.md`.

The workspace uses Next.js/React, browser IndexedDB, server SQLite, configurable Ollama routes, browser PDF/MiniLM processing and optional Mistral OCR. A separate TypeScript MCP service persists to its own JSON vault. Source artwork remains in this directory; runtime artwork is under `my-app/apps/web/public/assets/`.
