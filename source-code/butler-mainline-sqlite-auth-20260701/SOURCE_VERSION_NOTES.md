# Butler Mainline SQLite Auth Source Snapshot

Snapshot date: 2026-07-01

Branch: `codex/butler-mainline`

Source commit: `b8ac80defe480a67f9f5f1b3566e914441782d02`

Source root in this folder: `my-app/`

## Purpose

This folder is a clean source snapshot of the Butler app after the SQLite database login update. It is meant to preserve the current development-mainline version separately from local runtime files and external helper folders.

## Included

- Full tracked app source under `my-app/`
- Workspace package files, app package files, lockfile, Dockerfile, Docker Compose config, docs, scripts, and progress notes that were committed at the source commit
- SQLite auth implementation using `better-sqlite3`
- Paper-style database login UI, with English as the default language and Chinese as an alternate UI option

## Excluded

- `.git/`
- `node_modules/`
- Next.js build output such as `.next/`
- Turborepo cache such as `.turbo/`
- Local environment files such as `.env.local`
- Local SQLite runtime data such as `apps/web/data/butler.sqlite`
- Temporary dev-server logs
- External helper/security-agent folders that are not part of the Butler application source

## Authentication Notes

The current login path is database based:

- API routes: `/api/auth/signup`, `/api/auth/login`, `/api/auth/me`, `/api/auth/logout`
- Default local database path: `apps/web/data/butler.sqlite`
- Override path: `BUTLER_SQLITE_PATH`
- Session cookie: `butler_session`, httpOnly
- Password hashing: PBKDF2-SHA256 with per-user salt

This is a temporary deployable auth layer for the current project stage. A production-ready account system would still need managed database hosting, email verification, password reset, account recovery, shared rate limiting, audit logs, and backup policy.

## Run Locally

```powershell
cd my-app
corepack enable
corepack prepare pnpm@9.0.0 --activate
pnpm install --frozen-lockfile
pnpm --filter @smart-hub/web dev
```

Default local URL:

```text
http://127.0.0.1:3000
```

## Validate

```powershell
cd my-app
corepack pnpm exec tsc --noEmit
corepack pnpm build
node scripts/ci-validate.mjs
node --test scripts/*.test.mjs
```

Last verified before this snapshot:

- TypeScript check passed
- Production build passed
- Signup, login, `/api/auth/me`, and logout API flow passed
- Browser signup/login flow reached the app
- Clean package validation and script tests passed

Snapshot verification after export:

- `node scripts/ci-validate.mjs` passed inside this snapshot
- `node --test scripts/*.test.mjs` passed inside this snapshot

## Deployment Boundary

Docker Compose includes a named volume for SQLite data. The source snapshot does not include live user accounts or any local database file.
