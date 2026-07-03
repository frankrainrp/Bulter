# Complexity Estimate

## Current Refactor Goal

The current goal is to keep the application understandable and maintainable while moving backend ownership into a conventional Express + Node + MongoDB structure.

The project is not yet a plain JavaScript codebase. The backend runtime is Express + Node, but the source still uses TypeScript and compiles before running.

## Estimated Complexity

| Module | Current Complexity | Reason |
| --- | --- | --- |
| Express app setup | Low | The structure is fixed and the app entry is small. |
| MongoDB connection | Low | One connection module owns the setup. |
| Task CRUD | Medium-low | The data shape has many fields, but the service logic is direct. |
| Note CRUD | Low | The data shape is small and the service logic is direct. |
| Agent action dispatch | Medium | The action set will keep growing. |
| Auth migration | Medium | It includes password handling, cookies, and sessions. |
| Chat and AI migration | High | It includes streaming responses, tool calls, error handling, and model configuration. |
| Frontend state split | High | `page.tsx` still owns too much orchestration state and needs gradual extraction. |
| Panel and connector system | Medium-high | It connects generated UI, external data, charts, and research workflows. |
| Runtime configuration | Medium | API and web env files must stay separated and secrets must stay out of git. |

## Complexity Reduction Rules

- Each route should receive the request, call a service, and return a response.
- Each service should own one business area.
- Mongo models should define fields and indexes, not business workflows.
- API responses should use shared response helpers such as `MakeOk`.
- Async route errors should go through `RunSafe`.
- Keep agent actions direct first, then split to an action map only when the list becomes hard to scan.
- Keep environment templates in `env/` and real local secrets in ignored runtime env files.

## Naming Convention

Use direct PascalCase function names:

- `AddTask`
- `GetTaskList`
- `AddNote`
- `RunAgentAction`
- `SaveAgentLog`
- `MakeOk`
- `RunSafe`

Avoid unclear abbreviations. Do not wrap simple logic in complex classes unless it removes meaningful duplication.

## Current Highest-Risk Files

- `apps/web/src/app/page.tsx` - large orchestration surface.
- `apps/web/src/components/ChatCanvas.tsx` - chat rendering, input docking, and confirmation-card placement.
- `apps/api/src/services/ChatService.ts` - streaming model calls and tool-support behavior.
- `apps/api/src/services/AgentService.ts` - agent action dispatch and note/task control behavior.
- `apps/api/src/config/Env.ts` - runtime defaults and environment ownership.

