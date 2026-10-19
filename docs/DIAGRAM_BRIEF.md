# Bulter — Illustration brief

Status: **planned; artwork deferred**. Deliver two separate images, with English labels and a Chinese caption/translation attachment.

## 1. Technical implementation map

Audience: software engineers and technical interviewers. The reader should understand components, data flow, model boundaries and tradeoffs in 30 seconds.

Show these implemented paths in two aligned lanes:

1. Browser: React workspace → pending proposal / confirmation card → task/calendar/note state. Label Dexie/IndexedDB and the `/api/state` synchronization boundary.
2. Local server: Next.js route handlers → SQLite; chat route → configurable primary/alternate Ollama → SSE response. Write **configured model** on the route; label the portable default `qwen3:0.6b` and the source fallback separately in a short note.
3. Document side path: PDF → unpdf → MiniLM (`Xenova/all-MiniLM-L6-v2`) → selected text → inference. Mistral OCR is optional; DeepSeek-VL and Tesseract are placeholders.
4. Independent MCP lane: external MCP client → stdio → 14 typed tools → atomic JSON vault. Clearly label **separate data store; no automatic browser synchronization**. Do not draw a live link to SQLite.

Use grouped boxes and labelled arrows; approximately 10–12 nodes. Put model names next to inference, storage names next to persistence, and the user confirmation boundary between proposals and web writes. Billing is a simulation, and the school-sync edition is outside this core diagram.

## 2. Plain-language capability map

Audience: recruiters and non-technical readers. The reader should understand what the software helps a person do in 10 seconds.

Show a person bringing study material or a request into Bulter. Branch to **Plan tasks**, **See deadlines**, **Keep linked notes**, and **Ask for help**. For assistant changes, show **Preview → Confirm → Save**. Add one compact optional entry: **Connect an AI assistant through MCP**. Use at most seven main boxes and plain English, with a Chinese caption. Do not use framework, database, token or protocol names in the main flow.

## Later output files

- `technical-architecture.svg` and a readable PNG export.
- `product-overview.svg` and a readable PNG export.
- English source labels, with a Chinese text attachment.

中文：后续制作一张面向专业人士的技术实现图，以及一张面向非技术人员的能力理解图。只展示代码已实现的功能；可选集成、演示流程与未来计划必须清楚区分。本轮仅整理需求，不生成图片。
