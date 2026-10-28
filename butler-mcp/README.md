# Butler MCP Server

A [Model Context Protocol](https://modelcontextprotocol.io) server that exposes
Butler's **notes**, **tasks**, **calendar events**, and **workflows** to any MCP
client (Claude Desktop, Claude Code, …). Once connected, you can ask an assistant
things like _"what's due this week?"_ or _"add a note for today's lecture"_ and it
will read and write Butler's data through the tools below.

## Tools (14)

| Domain | Tools |
| --- | --- |
| **Notes** | `list_notes`, `get_note`, `search_notes`, `create_note`, `update_note` |
| **Tasks** | `list_tasks`, `create_task`, `complete_task`, `update_task` |
| **Events** | `list_events`, `create_event` |
| **Workflows** | `list_workflows`, `create_workflow`, `toggle_workflow` |

> "Events" are not a separate store — a task that has a `dueDate` is automatically
> a calendar event. `list_events` simply projects dated tasks onto a date range.
> "Workflows" are recurring-task automations (e.g. _gym 4×/week_).

## Data source — the vault

Butler's live data lives in the browser's **IndexedDB**, which a separate server
process cannot read. The MCP server therefore reads/writes a JSON **vault file**
that acts as the shared source of truth. The path is configurable:

```
BUTLER_VAULT=/absolute/path/to/butler-vault.json
```

Defaults to `./butler-vault.json` (seeded with sample study data). Writes are
atomic (temp file + rename); reads are fresh on every call, so edits made by
Butler's export — or by you in an editor — are picked up without a restart.

## Build & test

```bash
npm install
npm run build      # tsc → dist/
npm run smoke      # spawns the server, runs the JSON-RPC handshake, calls tools
```

## Connect to Claude Desktop

Add to `claude_desktop_config.json`
(`%APPDATA%\Claude\claude_desktop_config.json` on Windows):

```json
{
  "mcpServers": {
    "butler": {
      "command": "node",
      "args": ["D:/User/asus/Desktop/Bulter/butler-mcp/dist/index.js"],
      "env": {
        "BUTLER_VAULT": "D:/User/asus/Desktop/Bulter/butler-mcp/butler-vault.json"
      }
    }
  }
}
```

Restart Claude Desktop; the 14 tools appear under the 🔌 menu.

## Project layout

```
butler-mcp/
├─ src/
│  ├─ index.ts     # server entry — registers the 14 tools (stdio transport)
│  ├─ store.ts     # JSON-vault read/modify/write (atomic)
│  └─ types.ts     # mirrors Butler's Note / DdlItem / RecurringTask
├─ scripts/smoke.mjs   # end-to-end JSON-RPC client test
└─ butler-vault.json   # seed data
```
