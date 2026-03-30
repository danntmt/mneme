# Architecture overview

mneme is a local memory runtime for AI agents. This document describes the layered architecture, data model, and key design
decisions.

## Layers

```
┌─────────────────────────────────────────┐
│           Consumers                     │
│   ┌──────────────┐  ┌────────────────┐  │
│   │  MCP server  │  │     CLI        │  │
│   │  (apps/mcp)  │  │  (apps/cli)    │  │
│   └──────┬───────┘  └───────┬────────┘  │
│          │                  │           │
│          ▼                  ▼           │
│   ┌─────────────────────────────────┐   │
│   │        MemoryService            │   │
│   │        (packages/core)          │   │
│   │  - validates inputs (zod)       │   │
│   │  - delegates to store           │   │
│   │  - formats context output       │   │
│   └──────────────┬──────────────────┘   │
│                  │                      │
│                  ▼                      │
│   ┌─────────────────────────────────┐   │
│   │        MemoryStore              │   │
│   │        (interface)              │   │
│   └──────────────┬──────────────────┘   │
│                  │                      │
│                  ▼                      │
│   ┌─────────────────────────────────┐   │
│   │     SqliteMemoryStore           │   │
│   │     (packages/sqlite)           │   │
│   │  - better-sqlite3               │   │
│   │  - FTS5 full-text search        │   │
│   │  - upsert with revision track   │   │
│   └─────────────────────────────────┘   │
│                                         │
│   ┌─────────────────────────────────┐   │
│   │     Contracts                   │   │
│   │     (packages/contracts)        │   │
│   │  - Zod schemas                  │   │
│   │  - TypeScript types             │   │
│   │  - Enums                        │   │
│   └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

### Contracts (`packages/contracts`)

Pure data definitions. No logic, no I/O.

- **Enums**: `MemoryScope` (`workspace` | `personal`), `EntryKind` (`fact` | `decision` | `pattern` | `task` | `summary` | `warning`)
- **Record types**: `Session`, `Prompt`, `Entry`, `Checkpoint`
- **Input schemas**: Zod schemas for all operations with both `z.infer` (output, defaults resolved) and `z.input` (raw, defaults optional)
  types

### Core (`packages/core`)

Application logic. No persistence, no I/O.

- **`MemoryStore`** — interface that any persistence backend must implement. Methods may return `T` or `Promise<T>` to support both sync and
  async backends.
- **`MemoryService`** — validates inputs via zod schemas, delegates to the injected store, and formats context. This is the single entry
  point for consumers.
- **`ContextBlock`** — type representing a snapshot of session, prompts, entries, and checkpoints.
- **`formatContext`** — pure function that renders a `ContextBlock` into human-readable markdown.

### SQLite (`packages/sqlite`)

The only persistence backend in v1.

- Uses **better-sqlite3** for synchronous SQLite access
- **4 tables**: `sessions`, `prompts`, `entries`, `checkpoints`
- **FTS5 virtual table** (`entries_fts`) with sync triggers for full-text search
- **BM25-ranked search** with optional scope/kind/topic filters
- **Upsert logic**: entries are keyed by `(workspace_id, scope, kind, topic, title)`. Saving an entry with the same key updates it in-place
  and increments `revision`.
- **`touchEntries`**: updates `last_used_at` on entries returned by search or context retrieval, enabling usage-based relevance tracking.

### MCP server (`apps/mcp`)

Stdio-based MCP server that exposes 7 tools:

| Tool                           | Operation                           |
| ------------------------------ | ----------------------------------- |
| `mneme_open_session`    | `MemoryService.openSession`         |
| `mneme_close_session`   | `MemoryService.closeSession`        |
| `mneme_save_prompt`     | `MemoryService.savePrompt`          |
| `mneme_save_entry`      | `MemoryService.saveEntry`           |
| `mneme_save_checkpoint` | `MemoryService.saveCheckpoint`      |
| `mneme_search_entries`  | `MemoryService.searchEntries`       |
| `mneme_get_context`     | `MemoryService.getFormattedContext` |

The server reads `MNEME_DB_PATH` from the environment, defaulting to the platform's standard
data directory (`~/.local/share/mneme/` on Linux, `~/Library/Application Support/mneme/` on
macOS, `%LOCALAPPDATA%\mneme\` on Windows).

### CLI (`apps/cli`)

Read-only inspection tool for querying the memory database from the terminal. Commands:

```
mneme init     [--agent <name>] [--workspace <id>] [--force]
mneme search   --workspace <id> --query <text> [--limit <n>]
mneme context  --workspace <id> [--session <id>] [--limit <n>]
mneme doctor
mneme info
```

`init` writes an agent instructions file to the project root (no database writes).
`search` and `context` are read-only queries against the local SQLite database.
`doctor` and `info` inspect the database path and health without modifying data.

## Data model

### Session

A session groups related interactions. Each session belongs to a workspace.

| Field         | Type             | Description          |
| ------------- | ---------------- | -------------------- |
| `id`          | UUID             | Primary key          |
| `workspaceId` | string           | Workspace identifier |
| `startedAt`   | ISO 8601         | Session start time   |
| `endedAt`     | ISO 8601 \| null | Session end time     |
| `summary`     | string \| null   | Optional description |

### Prompt

The user's raw input, stored for context recall.

| Field         | Type     | Description          |
| ------------- | -------- | -------------------- |
| `id`          | UUID     | Primary key          |
| `sessionId`   | UUID     | Parent session       |
| `workspaceId` | string   | Workspace identifier |
| `content`     | string   | The prompt text      |
| `createdAt`   | ISO 8601 | Timestamp            |

### Entry

The core memory unit. Entries are upserted by `(workspaceId, scope, kind, topic, title)`.

| Field         | Type                      | Description                              |
| ------------- | ------------------------- | ---------------------------------------- |
| `id`          | UUID                      | Primary key                              |
| `sessionId`   | UUID                      | Session that last wrote this entry       |
| `workspaceId` | string                    | Workspace identifier                     |
| `scope`       | `workspace` \| `personal` | Visibility scope                         |
| `kind`        | enum                      | Category (fact, decision, etc.)          |
| `topic`       | string                    | Grouping label                           |
| `title`       | string                    | Short identifier (part of upsert key)    |
| `summary`     | string                    | One-line summary                         |
| `body`        | string                    | Full content                             |
| `confidence`  | 0.0–1.0                   | How confident the agent is               |
| `source`      | string                    | Who created it (`agent`, `user`, etc.)   |
| `revision`    | integer                   | Incremented on each upsert               |
| `createdAt`   | ISO 8601                  | First creation time                      |
| `updatedAt`   | ISO 8601                  | Last update time                         |
| `lastUsedAt`  | ISO 8601 \| null          | Last time retrieved by search or context |

### Checkpoint

Marks a milestone or progress point within a session.

| Field         | Type     | Description          |
| ------------- | -------- | -------------------- |
| `id`          | UUID     | Primary key          |
| `sessionId`   | UUID     | Parent session       |
| `workspaceId` | string   | Workspace identifier |
| `label`       | string   | Short label          |
| `body`        | string   | Description          |
| `createdAt`   | ISO 8601 | Timestamp            |

## Design decisions

### Why SQLite?

- Zero infrastructure — no database server to install or manage
- Single-file storage — easy to back up, move, or delete
- WAL mode — concurrent reads don't block writes
- FTS5 — built-in full-text search with BM25 ranking
- `better-sqlite3` — synchronous API eliminates callback/promise overhead for a local-only tool

### Why no SDK package?

v1 targets MCP and CLI as the only consumers. An SDK package would add API surface to maintain without clear demand. If downstream libraries
need programmatic access, `@mneme/core` and `@mneme/sqlite` can be imported directly.

### Why upsert instead of append-only?

Memory entries represent the agent's current understanding, not a log. When the agent learns something new about a topic it already knows,
updating the existing entry (and tracking revisions) is more useful than appending a duplicate.

### Why `z.input` types?

Zod schemas with `.default()` produce two distinct types:

- `z.infer<typeof schema>` — the **output** type with all defaults resolved (e.g., `scope: "workspace"` is required)
- `z.input<typeof schema>` — the **input** type where defaulted fields are optional (e.g., `scope?: "workspace"`)

`MemoryService` methods accept the raw input type so callers don't need to provide values for fields that have sensible defaults. The
service parses the input, resolves defaults, and passes the full type to the store.

### Why sync store, async service?

`better-sqlite3` is synchronous by design — it's faster and simpler for a local-only tool. The `MemoryStore` interface allows both sync and
async returns (`T | Promise<T>`), so a future async backend (e.g., LibSQL, Turso) could be swapped in without changing the interface.
`MemoryService` normalizes everything to `Promise<T>` for a consistent consumer API.
