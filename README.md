![mneme banner](assets/banner.png)

<p align="center" style="
  font-size: 72px;
  font-weight: 700;
  letter-spacing: 10px;
  color: #d6b25e;
  text-shadow: 2px 2px 6px rgba(0,0,0,0.7);
  margin-top: 10px;
  margin-bottom: 0;
  font-family: Georgia, 'Times New Roman', serif;
">
  MNEME
</p>

<p align="center" style="
  font-size: 16px;
  letter-spacing: 6px;
  color: #bfa76a;
  margin-top: 4px;
  margin-bottom: 20px;
  font-family: Georgia, serif;
">
  GODDESS OF MEMORY
</p>

<p align="center">
  <a href="#quick-start"><strong>🚀 Setup</strong></a> &nbsp;&nbsp;|&nbsp;&nbsp;
  <a href="docs/guides/agent-instructions.md"><strong>🧠 Agent instructions</strong></a> &nbsp;&nbsp;|&nbsp;&nbsp;
  <a href="examples/AGENTS.md"><strong>💡 Examples</strong></a> &nbsp;&nbsp;|&nbsp;&nbsp;
  <a href="examples/vscode/README.md"><strong>🛠️ VS Code example</strong></a>
</p>

<p align="center" style="max-width: 600px; margin: 10px auto 0; font-size: 15px;">
  Local memory runtime for AI agents. Agent-agnostic, LLM-agnostic, 100% offline.
</p>

</br>

mneme gives any AI coding agent persistent, structured memory backed by a local SQLite database. It exposes two consumers: a **CLI**
for inspection and an **MCP server** for agent integration. No cloud, no sync, no vendor lock-in.

## ✨ Features

- **Structured memory entries** — facts, decisions, patterns, tasks, summaries, and warnings with confidence scores and revision tracking
- **Full-text search** — FTS5-powered BM25-ranked search across titles, summaries, and bodies
- **Session tracking** — group prompts, entries, and checkpoints by session
- **Upsert semantics** — saving an entry with the same workspace/scope/kind/topic/title updates it in-place and bumps the revision
- **Context retrieval** — pull recent session context as formatted markdown
- **Agent-agnostic** — works with any agent that supports MCP (VS Code/Copilot, OpenCode, Cursor, Cline, etc.)
- **100% local** — SQLite file on disk, no network calls, no telemetry

## ⚡ Quick start

### Prerequisites

- Node.js 22 LTS
- pnpm 10+

### Install and build

```bash
git clone https://github.com/danntmt/mneme.git
cd mneme
pnpm install
pnpm build
```
The database is stored automatically in your platform's standard data directory:

| Platform | Default path |
|----------|-------------|
| Linux | `~/.local/share/mneme/memory.sqlite` |
| macOS | `~/Library/Application Support/mneme/memory.sqlite` |
| Windows | `%LOCALAPPDATA%\mneme\memory.sqlite` |

Both the MCP server and CLI resolve to the same location — no configuration needed.

### Run the MCP server

```bash
pnpm dev:mcp
```

### Install the CLI globally (use from any folder)

```bash
# Build the CLI
pnpm --filter @mneme/cli build

# Option A: install globally from the local folder (no publish)
npm i -g "<path-to-mneme>/apps/cli"

# Option B: pnpm global install (ensure pnpm global bin is in PATH)
pnpm add -g "<path-to-mneme>/apps/cli"
```

### Run the CLI

```bash
# Global install usage
mneme init
mneme search --workspace my-project --query "architecture"
mneme context --workspace my-project
mneme info

# Repo dev usage
pnpm dev:cli -- init
pnpm dev:cli -- search --workspace my-project --query "architecture"
pnpm dev:cli -- context --workspace my-project
pnpm dev:cli -- info
```

## 🛠 MCP tools

The MCP server exposes 7 tools, all prefixed with `mneme_`:

| Tool                           | Description                                       |
| -------------------------------|---------------------------------------------------|
| `mneme_open_session`           | Start a new memory session for a workspace        |
| `mneme_close_session`          | Close a memory session with optional summary      |
| `mneme_save_prompt`            | Save the user's prompt to the session             |
| `mneme_save_entry`             | Save a structured memory entry (upserts by title) |
| `mneme_save_checkpoint`        | Mark a milestone in the session                   |
| `mneme_search_entries`         | Full-text search with scope/kind/topic filters    |
| `mneme_get_context`            | Retrieve formatted context for a workspace        |

## 🧠 Agent instructions

To get the most out of mneme, your AI agent needs instructions on when and how to use the memory tools. A ready-to-use template is provided at [`examples/AGENTS.md`](examples/AGENTS.md) — copy it into your project's agent instructions file (e.g., `AGENTS.md`, `.github/copilot-instructions.md`).

See the [agent instructions guide](docs/guides/agent-instructions.md) for setup details and customization options.

## 📂 Project structure

```
mneme/
├── packages/
│   ├── contracts/       Zod schemas, types, enums
│   ├── core/            MemoryStore interface, MemoryService, formatContext
│   └── sqlite/          SQLite implementation (better-sqlite3 + FTS5)
├── apps/
│   ├── mcp/             MCP server (stdio transport)
│   └── cli/             Inspection CLI
├── docs/                Architecture documentation
└── examples/            Integration examples (VS Code, OpenCode)
```

## ⚙️ Configuration

| Environment variable  | Default                              | Description                      |
|-----------------------|--------------------------------------| -------------------------------- |
| `MNEME_DB_PATH`       | `<platform data dir>/mneme/memory.sqlite` | Override the SQLite database path |

`MNEME_DB_PATH` is read directly from the process environment — neither the CLI nor the MCP server auto-loads a `.env` file. Set it in the place that launches the process:

**Shell / global CLI:**
```bash
export MNEME_DB_PATH=/custom/path/memory.sqlite  # or set in ~/.bashrc / ~/.zshrc
mneme info
```

**MCP host config (e.g. Claude Desktop, VS Code):**
```json
{
  "env": { "MNEME_DB_PATH": "/custom/path/memory.sqlite" }
}
```

`env.example` documents the available variables for reference.

## 🏗 Development

```bash
# Run tests
pnpm test

# Type check
pnpm typecheck

# Dev mode (MCP server with auto-reload)
pnpm dev:mcp

# Dev mode (CLI)
pnpm dev:cli -- <command> [flags]
```

## 🏛 Architecture

See [docs/architecture/overview.md](docs/architecture/overview.md) for a detailed walkthrough of the layered architecture, data model, and
design decisions.

## 📄 License

[MIT](LICENSE)
