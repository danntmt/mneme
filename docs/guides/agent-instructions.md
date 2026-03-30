# Agent instructions guide

mneme works best when the AI agent knows **how** and **when** to use the memory tools. This guide explains how to configure agent instructions for your project.

## What are agent instructions?

Agent instructions are project-level markdown files that tell AI agents about tools, workflows, and conventions specific to your project. Different IDEs use different filenames:

| IDE / Agent   | Instructions file                            |
|---------------|----------------------------------------------|
| OpenCode      | `AGENTS.md` in project root                  |
| VS Code       | `.github/copilot-instructions.md`            |
| Cursor        | `.cursor/rules/*.mdc` or `.cursorrules`      |
| Cline         | `.clinerules`                                |
| Windsurf      | `.windsurfrules`                             |

## The template

A ready-to-use template is provided at [`examples/AGENTS.md`](../../examples/AGENTS.md). Copy its contents into the instructions file that matches your IDE.

### What the template covers

1. **Context retrieval** — The agent searches memory *before* starting work so it builds on prior knowledge instead of starting from scratch.
2. **Session lifecycle** — Open, use, and close sessions consistently so prompts and entries are grouped correctly.
3. **Incremental saving** — The agent saves facts, decisions, and patterns as it discovers them, not just at the end.
4. **Key parameters** — Documents `workspaceId`, `sessionId`, `scope`, `topic`, and `confidence` so the agent uses them correctly.
5. **Best practices** — Concise rules for keeping memory useful and searchable.

## Setup by IDE

### OpenCode

Copy the template into your project root as `AGENTS.md`:

```bash
cp /path/to/mneme/examples/AGENTS.md ./AGENTS.md
```

OpenCode reads `AGENTS.md` automatically at the start of each conversation.

### VS Code / GitHub Copilot

Copy the template contents into `.github/copilot-instructions.md`:

```bash
mkdir -p .github
cp /path/to/mneme/examples/AGENTS.md .github/copilot-instructions.md
```

Copilot in agent mode reads this file when working on your project.

### Cursor

Copy the template contents into `.cursor/rules/memory.mdc` or append to `.cursorrules`:

```bash
mkdir -p .cursor/rules
cp /path/to/mneme/examples/AGENTS.md .cursor/rules/memory.mdc
```

### Other agents

For any MCP-aware agent, copy the template into whatever instructions file the agent reads. The content is agent-agnostic — it references only the `mneme_*` MCP tool names.

## Customizing the template

The template is designed to work as-is, but you may want to adjust:

### `workspaceId`

The template tells the agent to use "the repository or directory name". If your project has a specific identifier you prefer, hardcode it:

```markdown
2. **Open a session** — Call `mneme_open_session` with `workspaceId` set to `"my-project"`.
```

This prevents the agent from guessing different names across sessions.

### Topics

If your project has well-defined domains, list them explicitly:

```markdown
Use one of these topics when saving entries:
- `"api"` — REST/GraphQL endpoints and contracts
- `"database"` — Schema, migrations, queries
- `"auth"` — Authentication and authorization
- `"infra"` — CI/CD, deployment, infrastructure
- `"testing"` — Test strategy, fixtures, coverage
```

### Scope

The default scope is `"workspace"`. If your project has multiple contributors with personal preferences, explain when to use `"personal"`:

```markdown
- Use `scope: "personal"` for individual preferences (e.g., preferred formatting, editor shortcuts)
- Use `scope: "workspace"` (default) for project knowledge shared across all sessions
```

## Why this matters

Without instructions, an agent has access to the memory tools but doesn't know:

- **When** to call them (at the start? end? during work?)
- **What** to save (everything? only decisions? only errors?)
- **How** to structure entries (what topics? what titles? what confidence?)

The template answers all three questions. Agents that follow it produce well-organized, searchable memory that compounds in value over time.
