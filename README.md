# C270_FA

This repository is the refactored Butler/C270 project.

Default project repository: https://github.com/frankrainrp/C270-Team2

## Current Architecture

- `apps/api` - Express + Node backend with MongoDB/Mongoose, session auth, owner-scoped persistence, and API rate limits.
- `apps/web` - Next/React frontend with no Next API route handlers.
- `env` - shareable environment templates only.
- `docs` - refactor plan, migration status, and team ownership documentation.
- `complexity` - complexity and readability notes.
- `scripts` - architecture guard tests, runtime smoke tests, and cleanup scripts.

The frontend calls backend functionality through `/express-api/*`. Next.js rewrites those requests to the Express API under `/api/*`.

Most product APIs are protected by the session middleware in `apps/api/src/middleware/AuthMiddleware.ts`. Auth and AI-heavy entry points also use the in-memory rate limiter in `apps/api/src/middleware/RateLimitMiddleware.ts` so write-heavy and model-heavy routes have an explicit safety boundary.

## Startup Guide

Prerequisites:

- Node.js
- pnpm
- MongoDB running locally or reachable through `MONGO_URL`

Install dependencies:

```powershell
pnpm install
```

Create local environment files:

```powershell
Copy-Item .\env\api.env.example .\apps\api\.env
Copy-Item .\env\web.env.local.example .\apps\web\.env.local
```

Edit API secrets in:

```text
apps/api/.env
```

Required for AI chat:

```env
DEEPSEEK_API_KEY=your_key_here
```

Required for OCR:

```env
MISTRAL_API_KEY=your_key_here
```

Start both apps:

```powershell
pnpm dev
```

Or start them separately:

```powershell
pnpm dev:api
pnpm dev:web
```

Default local URLs:

- Web app: `http://localhost:3000`
- Express API health check: `http://localhost:4010/api/health`
- Frontend proxy health check: `http://localhost:3000/express-api/health`

Runtime env files are intentionally ignored by git:

- API: `apps/api/.env`
- Web: `apps/web/.env.local`

Never commit real API keys or local `.env` files.

## Verification

Run these checks before pushing:

```powershell
pnpm test
pnpm build:web
pnpm build:api
```

Full local verification:

```powershell
pnpm test:all
pnpm test:runtime
```

`pnpm test:runtime` requires MongoDB to be reachable.

Runtime smoke tests create a temporary account, reuse the issued session cookie, and verify protected chat-history persistence through the same authenticated path used by the app.

## Core Data Ownership

The Express backend owns these core data areas:

- auth users and sessions
- tasks
- notes
- chat sessions and chat messages
- custom panels
- recurring tasks
- storage records for blobs, custom assets, and wallpapers
- AI helper routes for chat, OCR, research, panel generation, source generation, connector proxy, and DDL extraction

User-owned records must include `ownerId` and all list, replace, patch, and delete operations must be scoped to the authenticated owner. This applies to tasks, notes, chat history, custom panels, recurring tasks, storage records, and agent logs. Bulk replacement must only clear records for the current owner, never the whole collection.

MongoDB collections that previously relied on globally unique `clientId` values now use owner-aware uniqueness. Existing local databases may need old single-field unique indexes dropped before the compound `ownerId + clientId` indexes can build cleanly.

Browser `localStorage` remains only for UI preferences and lightweight client settings such as theme, language, model selection, onboarding state, and quota-demo counters.

## Team Ownership Summary

Detailed file ownership is maintained in `docs/team-maintenance-readme.md`.

### Frontend Page Breakdown

`apps/web/src/app/page.tsx` is the page composition shell. It should wire hooks, refs, panels, and modals together, while feature-specific behavior should live in owned components, hooks, or library modules.

| Responsibility | Owner Role | Primary Paths |
| --- | --- | --- |
| Page composition, layout wiring, modal/panel placement, global shortcuts, and search jump routing | App Shell And UI System Specialist | `apps/web/src/app/page.tsx`, `apps/web/src/components/AppPortals.tsx`, `apps/web/src/hooks/{useGlobalShortcuts,useSearchJump}.ts`, `apps/web/src/components/layout/*`, `apps/web/src/components/{ChatCanvas,InputPod,MiniAppsDrawer,PreferencesPanel,Toast}.tsx` |
| AI chat send flow, pending review batches, file/PDF extraction pipeline, generated tasks/notes/panels accept/reject/drop behavior | AI Agent Processing Specialist | `apps/web/src/hooks/{useChatFlow,useFilePipeline,usePendingBatches}.ts`, `apps/web/src/lib/{pending,tool-executor,document-parser,semantic-filter}.ts`, `apps/web/src/components/ConfirmCard.tsx` |
| Chat session lifecycle, active session selection, visible messages, and auto-generated chat titles | AI Agent Processing Specialist | `apps/web/src/hooks/useChatSessions.ts`, `apps/web/src/lib/chat-client.ts`, `apps/web/src/components/{ChatCanvas,layout/ChatRail}.tsx` |
| Recurring task creation and materializing daily task instances | Learning Productivity Specialist | `apps/web/src/hooks/useRecurringTasks.ts`, `apps/web/src/lib/recurring.ts`, `apps/web/src/components/RecurringTasksManager.tsx` |
| Task, calendar, note, daily overview, deadline reminders, task-note actions, shared note Markdown rendering, and study-tool surfaces | Learning Productivity Specialist | `apps/web/src/hooks/{useDailyEngagement,useDeadlineNotifications,useTaskNoteActions}.ts`, `apps/web/src/components/{TasksPanel,CalendarPanel,NotesPanel,NotesPreview,ObsidianMarkdown,DailyBrief,TodayHero}.tsx`, `apps/web/src/components/mini-apps/*` |
| Backend data contracts, owner-scoped hydrate/persist, import/export, and browser data adapters | Database And Data Organization Specialist | `apps/api/src/{db,models,routes,services}`, `apps/web/src/hooks/{useCoreAppData,useImportExportActions}.ts`, `apps/web/src/lib/{backend-api,types,json-export,ics-import,ics-export,blobs,storage-client,custom-panels}.ts` |
| Custom panels, local panel datasets, connectors, research, generated sources, visualization modules | Panels, Connectors, And Visualization Specialist | `apps/api/src/routes/{Connector,CustomPanel,GeneratePanel,GenerateSource,Research}Routes.ts`, `apps/web/src/hooks/{useCustomPanels,usePanelDatasets}.ts`, `apps/web/src/components/{CustomPanelView,DataSourceBuilder,GeneratedPanelView}.tsx`, `apps/web/src/components/panel-modules/*` |
| Project config, env templates, auth/rate-limit middleware, guards, billing/quota UI, verification scripts | Platform, Billing, And QA Specialist | root workspace files, `env`, `scripts`, `docs`, `complexity`, `apps/api/src/middleware/*`, `apps/web/src/hooks/useBillingFlow.ts`, `apps/web/src/lib/{api-guard,billing,credits,usage,wallpaper}.ts` |

| Role | Managed Files / Areas |
| --- | --- |
| AI Agent Processing Specialist | `apps/api/src/routes/{Agent,Chat,ExtractDdl,Ocr}Routes.ts`, `apps/api/src/services/{Agent,AgentLog,Ai,Chat,ChatToolDefinitions,ExtractDdl,Ocr}*.ts`, `apps/api/src/models/AgentLogModel.ts`, `apps/web/src/hooks/{useChatFlow,useChatSessions,useFilePipeline,usePendingBatches}.ts`, `apps/web/src/lib/{ai-models,ai-tools,chat-client,tool-executor,document-parser,semantic-filter,pending}.ts`, `apps/web/src/lib/ocr/*`, `apps/web/src/components/{ProcessingPipeline,ConfirmCard}.tsx`; owns AI write confirmation, DDL schema validation, and owner-scoped agent logs |
| Database And Data Organization Specialist | `apps/api/src/db`, `apps/api/src/models`, `AuthService.ts`, `ChatHistoryService.ts`, `GenericDataService.ts`, `NoteService.ts`, `TaskService.ts`, `AuthRoutes.ts`, `StorageRoutes.ts`, `TaskRoutes.ts`, `NoteRoutes.ts`, `apps/web/src/hooks/{useCoreAppData,useImportExportActions}.ts`, `apps/web/src/lib/{backend-api,types,json-export,ics-import,ics-export,blobs,storage-client,custom-panels,recurring}.ts`; owns `ownerId` data isolation and Mongo index compatibility |
| App Shell And UI System Specialist | `apps/web/src/app`, `apps/web/src/components/AppPortals.tsx`, `apps/web/src/hooks/{useGlobalShortcuts,useSearchJump}.ts`, `apps/web/src/components/layout`, `apps/web/src/components/ui`, `apps/web/src/components/{AuthGate,ChatCanvas,InputPod,KeyboardShortcutsHelp,MiniAppsDrawer,OnboardingTour,PreferencesPanel,Toast,WallpaperLayer,EmptyIllustrations}.tsx`, `apps/web/src/lib/{i18n,layout-prefs,theme,use-is-mobile}.ts` |
| Learning Productivity Specialist | `apps/web/src/hooks/{useDailyEngagement,useDeadlineNotifications,useRecurringTasks,useTaskNoteActions}.ts`, `apps/web/src/components/{TasksPanel,CalendarPanel,NotesPanel,NotesPreview,ObsidianMarkdown,AchievementsRoom,RecurringTasksManager,TaskDetailDrawer,DailyBrief,TodayHero}.tsx`, `apps/web/src/components/mini-apps/*`, `apps/web/src/lib/{demo-data,mock-pipeline,recurring,streak}.ts`, task/note/recurring routes, services, and models |
| Panels, Connectors, And Visualization Specialist | `apps/api/src/routes/{Connector,CustomPanel,GeneratePanel,GenerateSource,Research}Routes.ts`, `apps/api/src/services/{Connector,GeneratePanel,GenerateSource,Research}Service.ts`, `apps/web/src/hooks/{useCustomPanels,usePanelDatasets}.ts`, `apps/web/src/components/{CustomPanelView,DataSourceBuilder,GeneratedPanelView}.tsx`, `apps/web/src/components/panel-modules/*`, `apps/web/src/lib/{connector-client,panel-data,panel-generator,panel-local,panel-schema,research-assembler,research-client}.ts` |
| Platform, Billing, And QA Specialist | root package/workspace files, `env`, `scripts`, `docs`, `complexity`, `apps/api/src/{app,server}.ts`, `apps/api/src/config`, `apps/api/src/middleware`, `apps/api/src/routes/HealthRoutes.ts`, `apps/api/src/utils`, `apps/web/src/hooks/useBillingFlow.ts`, `apps/web/src/components/{AttachmentPreview,BillingPanel,CheckoutModal,PricingModal,QuotaWallModal}.tsx`, `apps/web/src/lib/{api-guard,billing,credits,sound,usage,wallpaper}.ts`; owns route protection wiring, rate-limit policy, and authenticated runtime smoke coverage |

### Code Smell Removal Coverage

- API routes must stay thin: read the authenticated owner, validate route input, call a service, and return `MakeOk` or `MakeFail`.
- Services own business rules and persistence scoping. They must not rely on callers to add `ownerId` filters correctly.
- AI-driven write actions require explicit confirmation before mutating tasks or notes.
- AI model output that becomes application data must pass a schema check before it is returned or persisted.
- Page-level React code should remain a composition shell. Feature behavior belongs in the owned hooks listed above.
- Shared Markdown/Obsidian-style note preview behavior belongs in `apps/web/src/components/ObsidianMarkdown.tsx`; note containers should reuse it instead of duplicating renderer overrides and preview CSS.
- Verification ownership is shared: every role keeps its owned files compatible with `pnpm test`, `pnpm build:api`, `pnpm build:web`, and the authenticated `pnpm test:runtime` flow.

### Recurring Task Duplicate Guard

Recurring task instances are materialized only through `apps/web/src/hooks/useRecurringTasks.ts`. Do not append recurring instances directly in `page.tsx` or panel components.

`useRecurringTasks.ts` owns these safeguards:

- serializes concurrent `runMaterialize()` calls so hydrate, AI tool calls, and manager actions cannot append the same period twice
- deduplicates existing recurring instances by task title, due date, due time, description, and tags
- reuses an existing recurring template when AI creates the same recurring task again
- writes generated instances through the shared merge path before `ReplaceTaskListByApi` persists tasks

## Current UI Rule

The newest AI confirmation card is docked directly above the chat input. This behavior is implemented in `apps/web/src/components/ChatCanvas.tsx`.
