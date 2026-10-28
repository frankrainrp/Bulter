# Butler — Technical Details

> A technical reference for **Butler**, a personal learning operating system for
> polytechnic students. This document describes the complete software: its
> architecture, technology stack, data model, AI layer, the panel-application
> engine, monetization, and the Model Context Protocol (MCP) integration that
> opens Butler's data to external AI assistants.

---

## 1. Overview

Butler is **not** a ChatGPT clone. It is a single-surface **Learning OS** built
around four panels — **Chat, Tasks, Calendar, Notes** — driven by an AI butler
that can read and write every panel. A student can drop in a course PDF and
Butler extracts the deadlines, files them on the calendar, generates revision
notes, and keeps recurring study habits running automatically.

| Property | Value |
| --- | --- |
| Type | Web application (PWA), local-first |
| Primary users | Polytechnic / college students |
| Core panels | Chat · Tasks · Calendar · Notes |
| AI model | DeepSeek-V4-Flash (default) / V4-Thinking |
| Persistence | Browser IndexedDB (Dexie) — zero backend, zero monthly cost |
| External integration | MCP server (notes, tasks, events, workflows) |

---

## 2. Technology Stack

| Layer | Technology |
| --- | --- |
| Framework | **Next.js 14** (App Router) on **React 18** + **TypeScript 5** |
| Monorepo | **Turborepo** + **pnpm** workspaces |
| Styling | CSS custom properties (design tokens) + per-theme overrides; no UI framework |
| Local data | **Dexie** (IndexedDB wrapper), schema at v9 |
| AI provider | **DeepSeek** API (OpenAI-compatible SDK), streaming + tool calling |
| Audio | Web Audio API (synthesised sound effects, zero asset weight) |
| Charts | Hand-rolled SVG (pie / bar / line / heatmap), zero chart dependency |
| External API | **@modelcontextprotocol/sdk** (the MCP server) |
| Tooling | tsc, Prettier, ESLint |

### 2.1 Monorepo layout

```
Bulter/
├─ my-app/                        # the Turborepo workspace
│  ├─ apps/web/                   # Next.js application (the product)
│  │  └─ src/
│  │     ├─ app/                  # App Router pages + /api routes
│  │     ├─ components/           # React UI (panels, chat, layout)
│  │     └─ lib/                  # client logic, data layer, AI glue
│  └─ packages/
│     ├─ ai-core/                 # shared AI types / Zod schemas
│     ├─ database/                # canonical schema definitions
│     └─ workflows/               # workflow / pipeline primitives
└─ butler-mcp/                    # standalone MCP server (this integration)
```

The web app is the deployable product; the three packages hold shared contracts.
`butler-mcp/` is deliberately **outside** the pnpm workspace because it is a
separate runtime process (see §7).

---

## 3. Application Architecture

### 3.1 Client-first design

Butler is **local-first**. All user data is persisted in the browser via Dexie,
so the app works offline, costs nothing to host, and keeps the user's study data
on their own device. The only server-side code is a thin set of Next.js **API
routes** that proxy AI calls and external HTTP (so API keys never reach the
browser and CORS / SSRF are controlled centrally).

```
┌─────────────────────────── Browser ───────────────────────────┐
│  React UI (4 panels)                                           │
│      │                                                         │
│      ├─ lib/* client logic ── Dexie (IndexedDB) ── user data   │
│      │                                                         │
│      └─ fetch() ─────────────┐                                 │
└──────────────────────────────┼────────────────────────────────┘
                               │  (HTTPS)
┌──────────────────────────────▼──────── Next.js server ─────────┐
│  /api/chat        → DeepSeek (streamed tokens + tool calls)    │
│  /api/extract-ddls→ PDF/text → structured deadlines           │
│  /api/connector   → generic HTTP proxy (SSRF-guarded)          │
│  /api/generate-*  → AI panel / data-source generation         │
│  /api/research    → parallel multi-agent research              │
│  /api/ocr         → image → text                              │
└────────────────────────────────────────────────────────────────┘
```

### 3.2 The four panels

| Panel | Responsibility | Backing store |
| --- | --- | --- |
| **Chat** | Conversation with the AI butler; multi-session history | `messages`, `sessions` |
| **Tasks** | Deadlines / to-dos with status, priority, weight, tags | `ddls` |
| **Calendar** | Month & week views; dated tasks rendered as events; drag-to-reschedule; `.ics` import/export | `ddls` (projection) |
| **Notes** | Markdown notes with `[[wikilinks]]`, backlinks, local search | `notes` |

A key design decision: **a "calendar event" is just a task with a `dueDate`.**
There is no separate events table — the calendar is a *view* over the same task
store. This keeps a single source of truth and means a deadline created in Chat
instantly appears on the Calendar.

### 3.3 Cross-panel intelligence

The panels are linked: the AI can create a note from a chat turn, turn a note's
checklist into tasks, and a task can reference the note it came from
(`DdlItem.noteId`). This is what makes Butler feel like one OS rather than four
separate apps.

---

## 4. Data Model

All types live in `apps/web/src/lib/types.ts` and are mirrored by the canonical
schema in `packages/database`. The Dexie database (`butler-db`) is at **version 9**
with forward-only migrations.

### 4.1 Core entities

**Task** (`DdlItem`, table `ddls`)
```ts
{
  id, taskName, weight, dueDate /* YYYY-MM-DD */, dueTime /* HH:MM */,
  description, isGroupWork, source, completed,
  status: "todo" | "in_progress" | "done",
  priority?: "low" | "med" | "high",
  tags?: string[], noteId?, recurringId?
}
```

**Note** (`Note`, table `notes`)
```ts
{ id, title, content /* Markdown */, tags?, pinned?, createdAt, updatedAt }
```

**Workflow** (`RecurringTask`, table `recurringTasks`)
```ts
{
  id, taskName, cadence: "daily" | "weekly" | "monthly",
  timesPerPeriod, dueTime, active, createdAt, lastGeneratedPeriod?
}
```
Each period, `lib/recurring.ts` materialises `timesPerPeriod` task instances into
`ddls` (e.g. *gym 4×/week* → four dated tasks), tagging each with `recurringId`
and recording `lastGeneratedPeriod` to prevent duplicates.

### 4.2 Dexie schema versions (selected)

| v | Added |
| --- | --- |
| 1–2 | `ddls`, `messages`, `blobs` |
| 3 | `sessions` (multi-session chat) |
| 4 | task `status` index |
| 5 | `notes` |
| 6 | `butlerAssets` (custom butler avatar) |
| 7 | `customPanels` |
| 8 | `wallpapers` |
| 9 | `recurringTasks` (workflows) |

### 4.3 Migration path

The local-first store is intentionally a stepping stone:

- **Now (Phase 2):** IndexedDB — single device, zero infra.
- **Phase 3:** Tauri desktop shell → local **SQLite** + read/write of a real
  Obsidian vault for Notes.
- **Phase 4:** optional cloud sync (Neon/Postgres) for multi-device.

The MCP server's vault abstraction (§7) is designed to ride this path.

---

## 5. AI Layer

### 5.1 Model

Butler uses **DeepSeek-V4-Flash** by default (3–25× cheaper than V3) with an
optional **V4-Thinking** mode that adds `reasoning_effort` + a `thinking` field
for chain-of-thought on hard requests. Models are whitelisted server-side; the
client may only request an allowed id (`lib/ai-models.ts`).

### 5.2 Streaming chat + tool calling

`/api/chat` calls DeepSeek through the OpenAI-compatible SDK with
`stream: true`. The butler is given a set of **tools** it can call to mutate the
app; the client executes them against Dexie and streams the result back:

| Tool | Effect |
| --- | --- |
| `create_item` / `update_item` / `delete_item` / `toggle_complete` | Manage tasks |
| `list_items` | Read tasks for grounding |
| `create_note` | Create a Markdown note |
| `create_recurring_task` | Create a workflow |
| `create_custom_panel` | Build a custom panel / dashboard |

Multi-turn tool calling preserves `reasoning_content` on assistant turns so
thinking mode survives across rounds. Token usage is tightly controlled
(trimmed history, capped `max_tokens`, compact prompts) because cost efficiency
is a hard product constraint.

### 5.3 Document → deadlines pipeline

A dropped PDF flows through `/api/ocr` (if scanned) → `/api/extract-ddls`, which
returns structured `DdlItem`s for the user to confirm before they are written —
turning a syllabus into a populated calendar in one step.

---

## 6. Panel Application Engine

Beyond the four built-in panels, Butler ships a **declarative panel engine** that
lets the AI (or the user) build live data dashboards from one sentence.

1. **Schema** (`lib/panel-schema.ts`): a `GeneratedPanelSpec` declares `sources[]`
   (data sources) and `blocks[]` (8 component types: stat, kpiGrid, table, bar,
   line, pie, list, markdown).
2. **Connector** (`/api/connector`): a generic, SSRF-guarded HTTP proxy that
   fetches any REST source, injecting `env:KEY` secrets server-side.
3. **Generation** (`/api/generate-panel`): natural language → validated spec via
   DeepSeek JSON mode.
4. **Parallel research** (`/api/research`): fans a question out to several AI
   "squads" in parallel (`Promise.all`), then deterministically assembles their
   findings into a multi-source panel.

This turns the "custom panel" from a static note into an AI-built application
surface.

---

## 7. MCP Integration (`butler-mcp`)

### 7.1 Why MCP

The [Model Context Protocol](https://modelcontextprotocol.io) is an open standard
that lets any MCP-capable client (Claude Desktop, Claude Code, …) connect to a
**server** that exposes *tools*, *resources*, and *prompts*. Wrapping Butler's
data in an MCP server means a student can manage their study life from **outside**
Butler — e.g. ask Claude Desktop *"what C245 work is due this week?"* and have it
read Butler's tasks directly.

> Note: Butler's in-app `create_item` / `create_note` tools (§5.2) are **provider
> function-calling**, not MCP. They are private to the app. The MCP server is a
> separate, standards-based surface that any client can speak to.

### 7.2 The architectural constraint and its solution

Butler's live data lives in the browser's IndexedDB. An MCP server runs as a
**separate Node process** and physically cannot read a browser tab's database.
The server therefore reads and writes a **JSON vault file** that acts as the
shared source of truth:

```
Claude Desktop ──stdio(JSON-RPC)──▶ butler-mcp (Node) ──read/write──▶ butler-vault.json
```

- Path is configurable via `BUTLER_VAULT`, so the same binary can target a demo
  file today, a Butler **export** of the user's real data, or — once Phase 3
  lands — the Tauri/SQLite store directly.
- Reads reload the file on every call (external edits are picked up live).
- Writes are **atomic** (temp file + rename) to avoid corruption.

### 7.3 Exposed tools (14)

| Domain | Tools | Maps to |
| --- | --- | --- |
| **Notes** | `list_notes`, `get_note`, `search_notes`, `create_note`, `update_note` | `Note` |
| **Tasks** | `list_tasks`, `create_task`, `complete_task`, `update_task` | `DdlItem` |
| **Events** | `list_events`, `create_event` | dated `DdlItem` (calendar projection) |
| **Workflows** | `list_workflows`, `create_workflow`, `toggle_workflow` | `RecurringTask` |

`list_events` projects tasks with a `dueDate` onto a `[from, to]` range —
faithfully reusing Butler's "an event is a dated task" model rather than
inventing a parallel concept.

### 7.4 Implementation

- **Transport:** stdio (`StdioServerTransport`), the standard for local MCP
  servers. JSON-RPC on stdout; logs on stderr.
- **Server:** `McpServer` from `@modelcontextprotocol/sdk`, each tool registered
  with a **Zod** input schema for validated, self-documenting parameters.
- **Store:** `src/store.ts` — `loadVault` / `mutateVault` / atomic `saveVault`.
- **Types:** `src/types.ts` mirrors Butler's `Note` / `DdlItem` / `RecurringTask`
  so the wire format matches the app exactly.

```
butler-mcp/
├─ src/index.ts     # registers the 14 tools, boots stdio transport
├─ src/store.ts     # JSON-vault read / modify / atomic write
├─ src/types.ts     # Butler-compatible Note / Task / Workflow
├─ scripts/smoke.mjs# end-to-end JSON-RPC client test
└─ butler-vault.json# seed study data
```

### 7.5 Build, test, connect

```bash
cd butler-mcp
npm install
npm run build      # tsc → dist/
npm run smoke      # spawns server, runs handshake, lists & calls tools  → PASS
```

The smoke test is a minimal MCP client: it spawns the server, performs the
`initialize` handshake, asserts all 14 tools are listed, then exercises
`create_task`, `list_events`, and `list_notes` — proving the integration works
end-to-end without Claude Desktop.

**Claude Desktop config** (`%APPDATA%\Claude\claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "butler": {
      "command": "node",
      "args": ["D:/User/asus/Desktop/Bulter/butler-mcp/dist/index.js"],
      "env": { "BUTLER_VAULT": "D:/User/asus/Desktop/Bulter/butler-mcp/butler-vault.json" }
    }
  }
}
```

---

## 8. Cross-cutting Concerns

| Concern | Approach |
| --- | --- |
| **Theming** | Single dark theme + a hand-drawn "retro" theme; all colours are CSS tokens, components never hard-code colour |
| **Responsive** | `useIsMobile` hook; mobile gets a bottom tab bar, drawer navigation, and full-screen panel switching |
| **i18n** | `lib/i18n.ts` — zh / en dictionaries, live language switching |
| **Sound** | 14 synthesised Web Audio effects (opt-in), the butler's signature "service bell" |
| **Accessibility** | `prefers-reduced-motion` guard; `aria-*` on interactive controls |
| **Offline / PWA** | Local-first store + installable PWA |

---

## 9. Monetization (summary)

A free **Flash** tier for acquisition plus a paid wall for premium models, metered
by a **5-hour sliding window** of real token cost (`lib/usage.ts`): each window
grants a small budget that refills on a countdown rather than accumulating.
Billing is modelled as usage × 1.3 with a ~25% member discount, and a
multi-provider gateway is scaffolded (GPT + Claude keys first, Gemini greyed out).

---

## 10. Build & Run

```bash
# Web app
cd my-app
pnpm install
pnpm --filter @smart-hub/web dev      # http://localhost:3000

# MCP server
cd butler-mcp
npm install && npm run build && npm run smoke
```

**Environment** (`apps/web/.env.local`): `DEEPSEEK_API_KEY`, optional
`DEEPSEEK_BASE_URL`.

---

*Document scope: the Butler web application (`my-app/`) and the Butler MCP server
(`butler-mcp/`). Internal change history is tracked in `my-app/PROGRESS.md`.*
