# Contributing to mneme

Thank you for your interest in contributing. This document covers the setup, conventions, and workflow for development.

## Prerequisites

- **Node.js 22 LTS** (required for `better-sqlite3` prebuilt binaries)
- **pnpm 10+** (the monorepo uses pnpm workspaces)

## Setup

```bash
git clone https://github.com/danntmt/mneme.git
cd mneme
pnpm install
pnpm build
pnpm test
```

## Monorepo layout

| Path                 | Package                   | Description                                               |
| -------------------- | ------------------------- | --------------------------------------------------------- |
| `packages/contracts` | `@mneme/contracts` | Zod schemas, enums, and TypeScript types                  |
| `packages/core`      | `@mneme/core`      | `MemoryStore` interface, `MemoryService`, `formatContext` |
| `packages/sqlite`    | `@mneme/sqlite`    | SQLite-backed `MemoryStore` implementation                |
| `apps/mcp`           | `@mneme/mcp`       | MCP server (stdio transport)                              |
| `apps/cli`           | `@mneme/cli`       | Inspection CLI                                            |

Dependencies flow **downward**: `apps/*` depend on `core` and `sqlite`, which depend on `contracts`. No circular dependencies.

## Code conventions

- **TypeScript** — strict mode, no `any` unless unavoidable
- **Zod** — all input validation happens at the boundary (in `MemoryService`), not in the store
- **SOLID** — single responsibility for each module, dependency injection for the store
- **Naming** — packages scoped under `@mneme/*`, MCP tools prefixed `mneme_*`, env vars prefixed `MNEME_`
- **No side effects at import time** — all initialization is explicit via `init()` or constructor

## Testing

Tests use [Vitest](https://vitest.dev/).

```bash
# Run all tests
pnpm test

# Run tests for a specific package
pnpm --filter @mneme/core test

# Run tests in watch mode (during development)
pnpm --filter @mneme/sqlite exec vitest
```

- **Unit tests** live in `src/__tests__/` within each package
- `core` tests use a mock `MemoryStore` — no SQLite dependency
- `sqlite` tests create a temp database per test run — no shared state

## Type checking

```bash
pnpm typecheck
```

This runs `tsc --noEmit` across all packages.

## Building

```bash
pnpm build
```

Packages use [tsup](https://tsup.egoist.dev/) for bundling. Output goes to `dist/` in each package.

## Adding a new entry kind

1. Add the value to `entryKindSchema` in `packages/contracts/src/enums.ts`
2. Update MCP tool descriptions if relevant in `apps/mcp/src/tools.ts`
3. Add tests covering the new kind

## Adding a new MCP tool

1. Define the tool in `apps/mcp/src/tools.ts` using `server.tool()`
2. Name it with the `mneme_` prefix
3. Use existing `MemoryService` methods, or add new ones following the validation pattern

## Commit messages

Use conventional commit style:

```
feat: add new entry kind "preference"
fix: handle empty search query gracefully
docs: update architecture overview
test: add edge case for upsert with null confidence
```

## Pull requests

- Keep PRs focused on a single concern
- Ensure `pnpm test` and `pnpm typecheck` pass
- Update documentation if you change public APIs or behavior
