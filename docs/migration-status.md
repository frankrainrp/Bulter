# C270_FA Migration Status

Updated: 2026-07-02

## Completed

- Created an isolated refactor workspace at `D:\User\asus\Desktop\C270_FA`.
- Kept the original `copy` project untouched.
- Removed the old `packages/*` workspace from the transformed project.
- Removed old Next API route handlers from `apps/web/src/app/api`.
- Removed Dexie, SQLite, Drizzle, Postgres, and old `@smart-hub/*` workspace dependencies.
- Added `apps/api` as the Express + Node + MongoDB/Mongoose backend.
- Added `/express-api/*` proxying from the frontend to the Express backend.
- Moved these areas to Express API routes:
  - auth
  - tasks
  - notes
  - chat streaming
  - chat sessions and messages
  - custom panels
  - recurring tasks
  - connector proxy
  - generated panels
  - generated sources
  - deadline extraction
  - OCR
  - research
  - storage records for blobs, custom assets, and wallpapers
- Added TDD architecture guard tests in `scripts/refactor-guard.test.mjs`.
- Removed the Butler character SVG/avatar customization path from the active frontend.
- Added agent note-control support for list/update/delete notes in addition to create notes.
- Changed achievement and document-understanding user-facing text to English-first.
- Changed visible shortcut labels from Mac-style symbols to Windows-first `Ctrl` shortcuts.
- Added `docs/team-maintenance-readme.md` for six-role ownership.

## Current Boundary

This is now a `Next frontend + Express/Node backend + MongoDB` application.

The frontend is not a backend anymore. Next.js only serves the React app and proxies `/express-api/*` to Express.

Browser `localStorage` is still used for UI preferences and lightweight client-only settings, not for core tasks, notes, auth, or chat history.

## Verification Commands

```bash
pnpm test
pnpm build:api
pnpm build:web
pnpm build
pnpm test:all
pnpm test:runtime
```

## Verification Record

2026-07-01:

- `pnpm test` passed: 7 architecture guard tests passed.
- `pnpm build:api` passed: TypeScript compilation passed.
- `pnpm build:web` passed: Next production build passed.
- `pnpm test:all` passed: tests plus API/Web production build passed.
- `pnpm test:runtime` passed against `mongodb://127.0.0.1:27017/c270_fa_runtime_test`: health, chat-history write, chat-history read, and cleanup all succeeded.
- Old data layer scan returned no matches for Dexie, SQLite, Drizzle, Postgres, old workspace imports, `butler.sessions`, or `butler.messages` inside app source.
- `apps/web/src/app` contains no `route.ts` API handlers.

2026-07-02:

- `pnpm test` passed: 7 architecture guard tests passed.
- `pnpm build:api` passed: TypeScript compilation passed.
- `pnpm build:web` passed: Next production build passed.
- `pnpm test:all` passed: tests plus API/Web production build passed.
- `pnpm test:runtime` passed against the runtime MongoDB smoke test.
- `http://localhost:3000/` returned 200 after starting the dev server.
- `http://localhost:4010/api/health` and `http://localhost:3000/express-api/health` returned ok with `mongoReadyState: 1`.
- Butler SVG/avatar runtime references returned no matches for `ButlerCharacter`, `ButlerPose`, `butler-asset`, `butlerPosition`, or `getButlerPosition`.
- Mac shortcut symbols returned no matches in app source after the Windows-first shortcut update.

## Runtime Verification Still Needed For Full Manual QA

MongoDB is reachable on this machine, and the automated runtime smoke test passes.

Manual browser QA is still useful for:

1. `GET /api/health`
2. auth signup/login/logout
3. task create/update/delete
4. note create/update/delete
5. chat session/message persistence after browser refresh
6. storage-backed asset and wallpaper records

## Completion Definition

The refactor is complete when:

- `pnpm test:all` passes.
- no `apps/web/src/app/api/**/route.ts` files exist.
- no Dexie, SQLite, Drizzle, Postgres, or old workspace package dependencies remain.
- core data is persisted through Express API routes and MongoDB models.
- MongoDB runtime verification is recorded.
