# C270_FA Team Maintenance README

Default repository: https://github.com/frankrainrp/C270-Team2

This README maps the latest refactored Butler project into six maintenance areas. The backend runtime is Express + Node + MongoDB/Mongoose, while the current source code is still TypeScript/TSX and compiles before running.

Use this file to assign ownership, review pull requests, and keep future changes inside the right module.

## Current Code Structure

- `apps/api` - Express + Node backend, MongoDB models, routes, services, middleware, environment config.
- `apps/web` - Next/React frontend, UI components, client adapters, local browser helpers, styles.
- `env` - shareable environment templates only. Real secrets stay in ignored runtime env files.
- `scripts` - refactor guards, smoke tests, cleanup utilities.
- `docs` - migration plan, migration status, and team maintenance documentation.
- `complexity` - complexity and readability notes.

Runtime env files:

- API runtime env: `apps/api/.env`
- Web runtime env: `apps/web/.env.local`
- Shareable templates: `env/api.env.example`, `env/web.env.local.example`

Never commit real `.env` or `.env.local` files.

## 1. AI Agent Processing Specialist

Scope: assistant chat, tool calls, note/task agent actions, OCR, DDL extraction, AI flow safety, AI logs.

Backend ownership:

- `apps/api/src/routes/AgentRoutes.ts`
- `apps/api/src/routes/ChatRoutes.ts`
- `apps/api/src/routes/ExtractDdlRoutes.ts`
- `apps/api/src/routes/OcrRoutes.ts`
- `apps/api/src/services/AgentService.ts`
- `apps/api/src/services/AgentLogService.ts`
- `apps/api/src/services/AiService.ts`
- `apps/api/src/services/ChatService.ts`
- `apps/api/src/services/ChatToolDefinitions.ts`
- `apps/api/src/services/ExtractDdlService.ts`
- `apps/api/src/services/OcrService.ts`
- `apps/api/src/models/AgentLogModel.ts`

Frontend ownership:

- `apps/web/src/lib/ai-models.ts`
- `apps/web/src/lib/chat-client.ts`
- `apps/web/src/lib/ai-tools.ts`
- `apps/web/src/lib/pending.ts`
- `apps/web/src/lib/tool-executor.ts`
- `apps/web/src/lib/document-parser.ts`
- `apps/web/src/lib/semantic-filter.ts`
- `apps/web/src/lib/ocr/index.ts`
- `apps/web/src/lib/ocr/providers.ts`
- `apps/web/src/components/ProcessingPipeline.tsx`

Shared review responsibility:

- `apps/web/src/components/ConfirmCard.tsx`
- `apps/web/src/components/ChatCanvas.tsx`

## 2. Database And Data Organization Specialist

Scope: MongoDB connection, models, persistence services, data shape compatibility, import/export, API client contracts.

Backend ownership:

- `apps/api/src/db/MongoDb.ts`
- `apps/api/src/models/ChatMessageModel.ts`
- `apps/api/src/models/ChatSessionModel.ts`
- `apps/api/src/models/CustomPanelModel.ts`
- `apps/api/src/models/NoteModel.ts`
- `apps/api/src/models/RecurringTaskModel.ts`
- `apps/api/src/models/SessionModel.ts`
- `apps/api/src/models/StorageItemModel.ts`
- `apps/api/src/models/TaskModel.ts`
- `apps/api/src/models/UserModel.ts`
- `apps/api/src/services/AuthService.ts`
- `apps/api/src/services/ChatHistoryService.ts`
- `apps/api/src/services/GenericDataService.ts`
- `apps/api/src/services/NoteService.ts`
- `apps/api/src/services/TaskService.ts`
- `apps/api/src/routes/AuthRoutes.ts`
- `apps/api/src/routes/ChatRoutes.ts`
- `apps/api/src/routes/CustomPanelRoutes.ts`
- `apps/api/src/routes/NoteRoutes.ts`
- `apps/api/src/routes/StorageRoutes.ts`
- `apps/api/src/routes/TaskRoutes.ts`

Frontend ownership:

- `apps/web/src/lib/backend-api.ts`
- `apps/web/src/lib/types.ts`
- `apps/web/src/lib/json-export.ts`
- `apps/web/src/lib/ics-import.ts`
- `apps/web/src/lib/ics-export.ts`
- `apps/web/src/lib/blobs.ts`
- `apps/web/src/lib/storage-client.ts`
- `apps/web/src/lib/custom-panels.ts`
- `apps/web/src/lib/recurring.ts`

## 3. App Shell And UI System Specialist

Scope: page shell, navigation, chat canvas layout, input docking, theme, i18n, responsive behavior, global styles.

Primary files:

- `apps/web/src/app/layout.tsx`
- `apps/web/src/app/page.tsx`
- `apps/web/src/app/globals.css`
- `apps/web/src/components/AuthGate.tsx`
- `apps/web/src/components/ChatCanvas.tsx`
- `apps/web/src/components/EmptyIllustrations.tsx`
- `apps/web/src/components/InputPod.tsx`
- `apps/web/src/components/KeyboardShortcutsHelp.tsx`
- `apps/web/src/components/MiniAppsDrawer.tsx`
- `apps/web/src/components/OnboardingTour.tsx`
- `apps/web/src/components/PreferencesPanel.tsx`
- `apps/web/src/components/Toast.tsx`
- `apps/web/src/components/WallpaperLayer.tsx`
- `apps/web/src/components/layout/CalendarRail.tsx`
- `apps/web/src/components/layout/ChatRail.tsx`
- `apps/web/src/components/layout/GlobalSearch.tsx`
- `apps/web/src/components/layout/LeftRail.tsx`
- `apps/web/src/components/layout/MobileTabBar.tsx`
- `apps/web/src/components/layout/NotesRail.tsx`
- `apps/web/src/components/layout/TasksRail.tsx`
- `apps/web/src/components/layout/TopBar.tsx`
- `apps/web/src/components/ui/Glass.tsx`
- `apps/web/src/components/ui/Portal.tsx`
- `apps/web/src/lib/i18n.ts`
- `apps/web/src/lib/layout-prefs.ts`
- `apps/web/src/lib/theme.ts`
- `apps/web/src/lib/use-is-mobile.ts`

Latest UI rule:

- The newest AI confirmation card must stay docked directly above the chat input. This is implemented in `apps/web/src/components/ChatCanvas.tsx`.

## 4. Learning Productivity Specialist

Scope: tasks, calendar, notes, daily overview, achievements, recurring tasks, study tools, focus tools.

Frontend ownership:

- `apps/web/src/components/AchievementsRoom.tsx`
- `apps/web/src/components/CalendarPanel.tsx`
- `apps/web/src/components/DailyBrief.tsx`
- `apps/web/src/components/NotesPanel.tsx`
- `apps/web/src/components/NotesPreview.tsx`
- `apps/web/src/components/RecurringTasksManager.tsx`
- `apps/web/src/components/TaskDetailDrawer.tsx`
- `apps/web/src/components/TasksPanel.tsx`
- `apps/web/src/components/TodayHero.tsx`
- `apps/web/src/components/mini-apps/FocusTimer.tsx`
- `apps/web/src/components/mini-apps/ShareCard.tsx`
- `apps/web/src/components/mini-apps/StatsApp.tsx`
- `apps/web/src/lib/demo-data.ts`
- `apps/web/src/lib/mock-pipeline.ts`
- `apps/web/src/lib/streak.ts`

Backend ownership:

- `apps/api/src/routes/TaskRoutes.ts`
- `apps/api/src/routes/NoteRoutes.ts`
- `apps/api/src/routes/RecurringRoutes.ts`
- `apps/api/src/services/TaskService.ts`
- `apps/api/src/services/NoteService.ts`
- `apps/api/src/models/TaskModel.ts`
- `apps/api/src/models/NoteModel.ts`
- `apps/api/src/models/RecurringTaskModel.ts`

## 5. Panels, Connectors, And Visualization Specialist

Scope: AI-generated panels, custom panels, data sources, charts, connector proxy, research flows, generated source assembly.

Backend ownership:

- `apps/api/src/routes/ConnectorRoutes.ts`
- `apps/api/src/routes/CustomPanelRoutes.ts`
- `apps/api/src/routes/GeneratePanelRoutes.ts`
- `apps/api/src/routes/GenerateSourceRoutes.ts`
- `apps/api/src/routes/ResearchRoutes.ts`
- `apps/api/src/services/ConnectorService.ts`
- `apps/api/src/services/GeneratePanelService.ts`
- `apps/api/src/services/GenerateSourceService.ts`
- `apps/api/src/services/ResearchService.ts`

Frontend ownership:

- `apps/web/src/components/CustomPanelView.tsx`
- `apps/web/src/components/DataSourceBuilder.tsx`
- `apps/web/src/components/GeneratedPanelView.tsx`
- `apps/web/src/components/panel-modules/Charts.tsx`
- `apps/web/src/components/panel-modules/ModuleRenderer.tsx`
- `apps/web/src/lib/connector-client.ts`
- `apps/web/src/lib/panel-data.ts`
- `apps/web/src/lib/panel-generator.ts`
- `apps/web/src/lib/panel-local.ts`
- `apps/web/src/lib/panel-schema.ts`
- `apps/web/src/lib/research-assembler.ts`
- `apps/web/src/lib/research-client.ts`

## 6. Platform, Billing, And QA Specialist

Scope: environment templates, project scripts, package configuration, health checks, middleware, billing simulation, quota, attachments, safety guards, verification.

Platform and backend ownership:

- `.gitignore`
- `package.json`
- `pnpm-workspace.yaml`
- `pnpm-lock.yaml`
- `apps/api/package.json`
- `apps/api/tsconfig.json`
- `apps/api/src/app.ts`
- `apps/api/src/server.ts`
- `apps/api/src/config/Env.ts`
- `apps/api/src/middleware/ErrorMiddleware.ts`
- `apps/api/src/routes/HealthRoutes.ts`
- `apps/api/src/utils/ApiResponse.ts`
- `apps/api/src/utils/CookieTools.ts`
- `apps/api/src/utils/ObjectPath.ts`
- `apps/api/src/utils/RunSafe.ts`
- `env/*`

Frontend and product-system ownership:

- `apps/web/package.json`
- `apps/web/next.config.js`
- `apps/web/tailwind.config.ts`
- `apps/web/src/components/AttachmentPreview.tsx`
- `apps/web/src/components/BillingPanel.tsx`
- `apps/web/src/components/CheckoutModal.tsx`
- `apps/web/src/components/PricingModal.tsx`
- `apps/web/src/components/QuotaWallModal.tsx`
- `apps/web/src/lib/api-guard.ts`
- `apps/web/src/lib/billing.ts`
- `apps/web/src/lib/credits.ts`
- `apps/web/src/lib/sound.ts`
- `apps/web/src/lib/usage.ts`
- `apps/web/src/lib/wallpaper.ts`

QA and documentation ownership:

- `complexity/complexity-estimate.md`
- `scripts/CleanGenerated.mjs`
- `scripts/refactor-guard.test.mjs`
- `scripts/runtime-smoke.mjs`
- `README.md`
- `docs/refactor-plan.md`
- `docs/migration-status.md`
- `docs/team-maintenance-readme.md`
- `env/README.md`

Required checks before push:

- `pnpm test`
- `pnpm build:web`
- `pnpm build:api`

## Cross-Team Rules

- Keep Express API ownership in `apps/api`.
- Keep browser UI ownership in `apps/web`.
- Keep real secrets out of git.
- Update this file when a file is renamed, deleted, or moved.
- When a change touches more than two areas, write a short design note before implementation.
- When changing persistence contracts, add or update a guard test or document the migration in `docs/migration-status.md`.
