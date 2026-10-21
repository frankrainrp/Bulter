# Installation and components

| Component | Package | Start | Interface |
|---|---|---|---|
| Local workspace | `Bulter-Windows-x64.zip` | `Start-Bulter.cmd` | Browser and Next.js API at `127.0.0.1:3000` |
| MCP service | `Butler-MCP-Server-Windows-x64.zip` | Configure a client with `Start-MCP.cmd` or the bundled Node executable and server script | JSON-RPC over stdio; no TCP port |
| Source | `Bulter-Source.zip` | Install dependencies from lockfiles, then build the selected component | Node.js 20+ and pnpm 9 for the web workspace |

[Release downloads](https://github.com/frankrainrp/Bulter/releases/tag/v0.1.0)

Extract into a writable directory. Windows packages include Node.js and production dependencies. The web package creates a fresh SQLite database; model weights are installed separately in Ollama.

`config.json` selects the primary endpoint and model, initially `http://127.0.0.1:11434/v1` and `qwen3:0.6b`. Optional alternate settings select a second endpoint/model. Restart the application after configuration changes. Stop the server with Ctrl+C.

## MCP client configuration

```json
{
  "mcpServers": {
    "butler": {
      "command": "C:/Apps/Butler-MCP-Server-Windows-x64/runtime/node.exe",
      "args": ["C:/Apps/Butler-MCP-Server-Windows-x64/app/dist/index.js"],
      "env": {"BUTLER_VAULT": "C:/Apps/Butler-MCP-Server-Windows-x64/data/butler-vault.json"}
    }
  }
}
```

Use actual absolute paths. The client controls tool approvals. The vault stores notes, tasks and recurring workflows; dated tasks form calendar events. It is independent of the web application's IndexedDB/SQLite state.

## Source archive

The source archive contains the complete maintained repository files, agent entries, technical references, tests, lockfiles and deployment/build configuration. Generated dependency directories, local databases, caches and Git metadata are excluded. Existing runtime assets required by package entry points are preserved.

The Express/MongoDB Study Butler project has its own [repository and Docker instructions](https://github.com/frankrainrp/C270_FA_DEPLOYMENT). These Windows packages run the Next.js/Ollama implementation.
