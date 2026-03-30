# VS Code / GitHub Copilot integration

This example shows how to connect mneme to VS Code as an MCP server, making it available to GitHub Copilot agent mode.

## Prerequisites

1. Build mneme:

```bash
cd /path/to/mneme
pnpm install && pnpm build
```

The database is stored automatically in your platform's standard data directory.

2. VS Code with GitHub Copilot (agent mode) or any MCP-aware extension.

## Setup

Create `.vscode/mcp.json` in your project root:

```json
{
  "servers": {
    "mneme": {
      "command": "node",
      "args": [
        "/absolute/path/to/mneme/apps/mcp/dist/index.js"
      ]
    }
  }
}
```

Replace the path with your actual mneme install location. The database is stored
automatically in your platform's data directory (`~/.local/share/mneme/` on Linux,
`~/Library/Application Support/mneme/` on macOS, `%LOCALAPPDATA%\\mneme\\` on Windows).
Set `MNEME_DB_PATH` only if you need a custom location.

## Copilot instructions (optional)

To teach Copilot how to use the memory tools, copy the agent instructions template into your project:

```bash
mkdir -p .github
cp /path/to/mneme/examples/AGENTS.md .github/copilot-instructions.md
```

The template covers the full session lifecycle, entry kinds, key parameters, and best practices. See [`examples/AGENTS.md`](../AGENTS.md) for the contents, or the [agent instructions guide](../../docs/guides/agent-instructions.md) for customization options.

## Verifying the connection

1. Open VS Code in your project
2. Open the Copilot chat panel
3. Ask Copilot to call `mneme_open_session` — it should create a session and return JSON with a session ID
