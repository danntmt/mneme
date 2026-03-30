import { describe, expect, it } from "vitest";
import type { ContextBlock } from "../context-block.js";
import { formatContext } from "../format-context.js";

// ---------------------------------------------------------------------------
// Factories — minimal valid domain objects for test fixtures
// ---------------------------------------------------------------------------

function makeSession(overrides: Partial<ContextBlock["session"] & object> = {}) {
  return {
    id: "sess-1",
    workspaceId: "ws-1",
    startedAt: "2025-01-01T00:00:00Z",
    endedAt: null,
    summary: null,
    ...overrides,
  };
}

function makePrompt(overrides: Partial<ContextBlock["prompts"][number]> = {}) {
  return {
    id: "pr-1",
    sessionId: "sess-1",
    workspaceId: "ws-1",
    content: "What is the project structure?",
    createdAt: "2025-01-01T00:01:00Z",
    ...overrides,
  };
}

function makeEntry(overrides: Partial<ContextBlock["entries"][number]> = {}) {
  return {
    id: "ent-1",
    sessionId: "sess-1",
    workspaceId: "ws-1",
    scope: "workspace" as const,
    kind: "fact" as const,
    topic: "architecture",
    title: "Monorepo layout",
    summary: "Uses pnpm workspaces with packages/ and apps/",
    body: "Full body text",
    confidence: 0.9,
    source: "agent",
    revision: 1,
    createdAt: "2025-01-01T00:02:00Z",
    updatedAt: "2025-01-01T00:02:00Z",
    lastUsedAt: null,
    ...overrides,
  };
}

function makeCheckpoint(
  overrides: Partial<ContextBlock["checkpoints"][number]> = {},
) {
  return {
    id: "cp-1",
    sessionId: "sess-1",
    workspaceId: "ws-1",
    label: "v0.1 scaffold",
    body: "Created initial project structure",
    createdAt: "2025-01-01T00:03:00Z",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("formatContext", () => {
  it("returns empty string for a completely empty context block", () => {
    const block: ContextBlock = {
      prompts: [],
      entries: [],
      checkpoints: [],
    };

    expect(formatContext(block)).toBe("");
  });

  it("renders session header without summary when summary is null", () => {
    const block: ContextBlock = {
      session: makeSession(),
      prompts: [],
      entries: [],
      checkpoints: [],
    };

    const result = formatContext(block);
    expect(result).toContain("# Session sess-1");
    expect(result).toContain("Workspace: ws-1");
    expect(result).toContain("Started: 2025-01-01T00:00:00Z");
    expect(result).not.toContain("Summary:");
  });

  it("renders session summary when present", () => {
    const block: ContextBlock = {
      session: makeSession({ summary: "Explored architecture" }),
      prompts: [],
      entries: [],
      checkpoints: [],
    };

    const result = formatContext(block);
    expect(result).toContain("Summary: Explored architecture");
  });

  it("renders prompts section", () => {
    const block: ContextBlock = {
      prompts: [
        makePrompt({ content: "First prompt" }),
        makePrompt({ id: "pr-2", content: "Second prompt" }),
      ],
      entries: [],
      checkpoints: [],
    };

    const result = formatContext(block);
    expect(result).toContain("## Recent prompts");
    expect(result).toContain("- First prompt");
    expect(result).toContain("- Second prompt");
  });

  it("renders entries section with kind and title", () => {
    const block: ContextBlock = {
      prompts: [],
      entries: [
        makeEntry({ kind: "decision", title: "Use SQLite", summary: "For local persistence" }),
        makeEntry({ id: "ent-2", kind: "pattern", title: "Service layer", summary: "Validates then delegates" }),
      ],
      checkpoints: [],
    };

    const result = formatContext(block);
    expect(result).toContain("## Memory entries");
    expect(result).toContain("- [decision] Use SQLite: For local persistence");
    expect(result).toContain("- [pattern] Service layer: Validates then delegates");
  });

  it("renders checkpoints section", () => {
    const block: ContextBlock = {
      prompts: [],
      entries: [],
      checkpoints: [
        makeCheckpoint({ label: "milestone-1", body: "Core done" }),
      ],
    };

    const result = formatContext(block);
    expect(result).toContain("## Checkpoints");
    expect(result).toContain("- milestone-1: Core done");
  });

  it("renders all sections together in correct order", () => {
    const block: ContextBlock = {
      session: makeSession({ summary: "Full context test" }),
      prompts: [makePrompt()],
      entries: [makeEntry()],
      checkpoints: [makeCheckpoint()],
    };

    const result = formatContext(block);
    const sessionIdx = result.indexOf("# Session");
    const promptsIdx = result.indexOf("## Recent prompts");
    const entriesIdx = result.indexOf("## Memory entries");
    const checkpointsIdx = result.indexOf("## Checkpoints");

    expect(sessionIdx).toBeLessThan(promptsIdx);
    expect(promptsIdx).toBeLessThan(entriesIdx);
    expect(entriesIdx).toBeLessThan(checkpointsIdx);
  });

  it("omits empty sections entirely", () => {
    const block: ContextBlock = {
      session: makeSession(),
      prompts: [],
      entries: [makeEntry()],
      checkpoints: [],
    };

    const result = formatContext(block);
    expect(result).toContain("# Session");
    expect(result).toContain("## Memory entries");
    expect(result).not.toContain("## Recent prompts");
    expect(result).not.toContain("## Checkpoints");
  });

  it("trims trailing whitespace", () => {
    const block: ContextBlock = {
      prompts: [makePrompt()],
      entries: [],
      checkpoints: [],
    };

    const result = formatContext(block);
    expect(result).toBe(result.trim());
  });
});
