# Distribution guide

| Download | Server | Client | Runtime | Local address |
|---|---|---|---|---|
| `Bulter-Windows-x64.zip` | Built Next.js API | Built browser UI | Node.js 24.18.0, Windows x64 | `http://127.0.0.1:3000` |
| `Butler-MCP-Server-Windows-x64.zip` | 14-tool MCP stdio process | Bring a compatible MCP client | Node.js 24.18.0, Windows x64 | No TCP port |
| `Bulter-Source.zip` | Source | Source | Install Node/pnpm separately | Developer configured |

Extract packages into writable folders. No administrator rights or global package installation are needed for the Windows runtime bundles. Ollama and model weights are separate. These are portable ZIP distributions, not signed MSI installers.

## Application configuration

Edit `config.json` before starting the application. `ollamaUrl` must be an OpenAI-compatible base URL, including `/v1`. `model` must name an installed model. Optional `alternateOllamaUrl` and `alternateModel` configure a second route. API credentials, if required by a custom provider, belong in process environment variables, not in committed configuration.

The launcher defaults to loopback, port 3000, a fresh `data/butler.sqlite`, and the non-secret Ollama SDK key `ollama`. It sets `DEEPSEEK_BASE_URL`/`DEEPSEEK_MODEL` as compatibility variables for older auxiliary routes. It never installs a scheduled task or connects to a household server. A port conflict stops startup rather than replacing an existing process.

To stop, press Ctrl+C in the running console. Data is kept in the package's `data` folder and browser storage. The MCP package uses a separate vault, created on its first write. Back up these folders before replacing an installation.

## MCP setup

In your MCP client's server configuration, use absolute paths:

```json
{
  "mcpServers": {
    "butler": {
      "command": "C:\\Apps\\Butler-MCP-Server-Windows-x64\\runtime\\node.exe",
      "args": ["C:\\Apps\\Butler-MCP-Server-Windows-x64\\app\\dist\\index.js"],
      "env": {"BUTLER_VAULT": "C:\\Apps\\Butler-MCP-Server-Windows-x64\\data\\butler-vault.json"}
    }
  }
}
```

Replace the example directory with your extraction path. Approve tools according to your MCP client's controls. No LLM, credentials or hosted account is bundled with this server.

## Source boundaries

Source ZIPs contain only the application workspace, MCP source, relevant documentation and dependency lockfiles. Historical UI samples, quarantine folders, assistant session files and unrelated operations scripts are omitted. Binary distributions retain dependency and runtime notices. No project-wide MIT or other new license is granted by this release.
