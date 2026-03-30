# OpenCode integration

This example shows how to connect mneme to [OpenCode](https://opencode.ai) as an MCP server.

## Prerequisites

1. Build mneme:

```bash
cd /path/to/mneme
pnpm install && pnpm build
```

The database is stored automatically in your platform's standard data directory.

2. OpenCode installed and configured.

## Setup

Add the MCP server to your OpenCode configuration. In your project's `opencode.json` (or global config):

```json
{
  "mcp": {
    "mneme": {
      "type": "stdio",
      "command": "node",
      "args": [
        "/absolute/path/to/mneme/apps/mcp/dist/index.js"
      ]
    }
  }
}
```

Replace the path with your actual mneme install location. The database is stored
automatically in your platform's data directory. Set `MNEME_DB_PATH` only if you need
a custom location.

## Usage

Once configured, the following tools become available in OpenCode:

- `mneme_open_session` — start a new session
- `mneme_close_session` — close a session
- `mneme_save_prompt` — save the user's prompt
- `mneme_save_entry` — save a structured memory entry
- `mneme_save_checkpoint` — mark a progress milestone
- `mneme_search_entries` — full-text search over entries
- `mneme_get_context` — retrieve formatted context

## Custom instructions (optional)

To teach OpenCode how to use the memory tools, copy the agent instructions template into your project root:

```bash
cp /path/to/mneme/examples/AGENTS.md ./AGENTS.md
```

OpenCode reads `AGENTS.md` automatically at the start of each conversation. The template covers the full session lifecycle, entry kinds, key parameters, and best practices. See [`examples/AGENTS.md`](../AGENTS.md) for the contents, or the [agent instructions guide](../../docs/guides/agent-instructions.md) for customization options.

## Verifying the connection

Start OpenCode and ask it to call `mneme_open_session`. It should return a JSON object with a session ID, confirming the MCP
connection is working.
