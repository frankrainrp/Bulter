# C270_FA Refactor Plan

Created: 2026-07-01  
Updated: 2026-07-02

## 1. Goal

Refactor the Butler project into a structure that is easier for standard Express + Node developers to understand and maintain.

The target architecture is:

- Express + Node backend
- MongoDB/Mongoose persistence
- frontend kept as Next/React for now
- no Next API route handlers in the frontend
- clear route, service, model, and utility boundaries

The original desktop `copy` project is not modified by this workspace.

## 2. Current Problems Being Reduced

- The old application mixed frontend behavior, backend behavior, AI calls, and data processing inside the Next app.
- The old data layer was split across browser storage, SQLite auth data, and old package dependencies.
- `page.tsx` still contains too much UI and orchestration state.
- AI write actions, notes, tasks, and chat history were too tightly coupled.
- The project did not look like a conventional Express service that new backend developers could quickly navigate.

## 3. Target Structure

```text
apps/
  api/       Express + Node + MongoDB backend
  web/       Next/React frontend that calls Express through /express-api/*

apps/api/src/
  app.ts
  server.ts
  config/
  db/
  middleware/
  models/
  routes/
  services/
  utils/
```

## 4. Database Plan

MongoDB is the unified persistence layer for core data.

Current core collections:

| Collection | Purpose |
| --- | --- |
| `users` | user accounts |
| `sessions` | login sessions |
| `tasks` | tasks, deadlines, and calendar data |
| `notes` | study notes |
| `chat_sessions` | chat session metadata |
| `chat_messages` | chat messages |
| `custom_panels` | user-created and AI-created panels |
| `recurring_tasks` | recurring task templates |
| `storage_items` | blob, custom asset, and wallpaper records |
| `agent_logs` | agent action audit records |

Browser `localStorage` is allowed only for UI preferences and lightweight client settings.

## 5. Code Style Rules

Keep function names direct and action-oriented.

Preferred naming examples:

- `AddTask`
- `GetTaskList`
- `GetTaskById`
- `UpdateTask`
- `DeleteTask`
- `AddNote`
- `RunAgentAction`
- `MakeOk`
- `RunSafe`

Avoid early abstraction. Add a shared helper only when it reduces real repetition or makes a file easier to read.

## 6. Completed Refactor Work

- Added `apps/api` as the Express + Node backend.
- Added MongoDB/Mongoose models for core data.
- Added Express routes for auth, tasks, notes, chat, custom panels, recurring tasks, connector proxy, generated panels, generated sources, OCR, research, storage, and DDL extraction.
- Removed Next API route handlers from the frontend.
- Added frontend proxying through `/express-api/*`.
- Added architecture guard tests in `scripts/refactor-guard.test.mjs`.
- Added runtime smoke testing in `scripts/runtime-smoke.mjs`.
- Added environment templates under `env/`.
- Added team ownership documentation under `docs/team-maintenance-readme.md`.

## 7. Remaining Refactor Work

- Split `apps/web/src/app/page.tsx` into smaller view-model and orchestration modules.
- Continue reducing browser-only state for any core workflow that should be server-backed.
- Decide whether the frontend should remain Next/React or later move toward a simpler template layer such as EJS.
- Decide whether the API source should remain TypeScript or be converted to plain JavaScript for a more traditional Node developer workflow.
- Add broader manual QA records for auth, notes, tasks, chat persistence, and storage-backed assets.

## 8. Complexity Targets

| Area | Target |
| --- | --- |
| Route files | keep thin, usually request parsing plus service calls |
| Service files | hold business logic for one domain |
| Model files | hold schema fields, indexes, and minimal model config |
| React page files | keep orchestration readable and split large sections over time |
| Function parameters | prefer one to three clear parameters |
| Function names | describe the action directly |

## 9. Risks

- MongoDB migration changes the source of truth for core data.
- Rewriting the frontend and backend at the same time would increase risk.
- Express adds a separate runtime process and changes local startup.
- The current source is still TypeScript/TSX, even though the backend runtime architecture is Express + Node.
- Manual browser QA is still needed after structural changes.

## 10. Acceptance Criteria

The transformed project is acceptable when:

- `pnpm test` passes.
- `pnpm build:api` passes.
- `pnpm build:web` passes.
- no `apps/web/src/app/api/**/route.ts` files exist.
- core tasks, notes, auth, chat history, custom panels, recurring tasks, and storage records persist through Express API routes and MongoDB models.
- local runtime health checks pass for both `http://localhost:4010/api/health` and `http://localhost:3000/express-api/health`.
- documentation, templates, and README files are English-first.

