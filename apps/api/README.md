# C270_FA Agent API

Basic Express + MongoDB backend framework for the Butler refactor.

## Setup

```bash
pnpm install
copy ..\..\env\api.env.example .env
pnpm dev
```

Default server:

```text
http://localhost:4010
```

## Routes

```text
GET    /api/health
GET    /api/tasks
POST   /api/tasks
GET    /api/tasks/:id
PATCH  /api/tasks/:id
DELETE /api/tasks/:id

GET    /api/notes
POST   /api/notes

POST   /api/agent/run
```

## Agent actions

`POST /api/agent/run`

```json
{
  "actionName": "AddTask",
  "data": {
    "taskName": "C270 - Finish refactor plan",
    "dueDate": "2026-07-05",
    "dueTime": "23:59"
  }
}
```

Supported first actions:

- `AddTask`
- `ListTasks`
- `AddNote`
- `ListNotes`

## Environment

The API reads `apps/api/.env` through `dotenv`.

Use the root template when setting up a new machine:

```powershell
Copy-Item ..\..\env\api.env.example .\.env
```

Required integrations:

- `MONGO_URL` for MongoDB.
- `DEEPSEEK_API_KEY` for chat and AI generation.
- `MISTRAL_API_KEY` for OCR.
