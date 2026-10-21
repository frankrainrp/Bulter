# Butler MCP server

This TypeScript service exposes 14 tools through Model Context Protocol JSON-RPC over stdio. An MCP client invokes validated operations against an atomic JSON vault.

| Domain | Tools |
|---|---|
| Notes | `list_notes`, `get_note`, `search_notes`, `create_note`, `update_note` |
| Tasks | `list_tasks`, `create_task`, `complete_task`, `update_task` |
| Events | `list_events`, `create_event` |
| Recurring workflows | `list_workflows`, `create_workflow`, `toggle_workflow` |

Dated tasks are projected as calendar events. Recurring workflows describe repeated task generation.

## Build and run

```sh
npm ci
npm run build
npm run smoke
```

Set `BUTLER_VAULT` to a writable absolute JSON path, then start `node dist/index.js` from a compatible MCP client. The entry point and npm `bin` require the built `dist/` files. Reads reload the vault; writes replace it atomically through a temporary file.

The service has its own data store. Web IndexedDB/SQLite state is not synchronized automatically. Tool calls execute through this service; configure approvals in the MCP client.

[Windows package and client configuration](../docs/DISTRIBUTION.md)
