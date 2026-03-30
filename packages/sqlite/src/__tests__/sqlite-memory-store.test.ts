import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Entry } from "@mneme/contracts";
import { SqliteMemoryStore, doctorDatabase } from "../sqlite-memory-store.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTempDbPath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mneme-test-"));
  return path.join(dir, "test.db");
}

function createStore(): { store: SqliteMemoryStore; dbPath: string } {
  const dbPath = createTempDbPath();
  const store = new SqliteMemoryStore({ databasePath: dbPath });
  store.init();
  return { store, dbPath };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SqliteMemoryStore", () => {
  let store: SqliteMemoryStore;
  let dbPath: string;

  beforeEach(() => {
    ({ store, dbPath } = createStore());
  });

  afterEach(() => {
    // Clean up temp database
    try {
      fs.rmSync(path.dirname(dbPath), { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  // -----------------------------------------------------------------------
  // init
  // -----------------------------------------------------------------------

  describe("init", () => {
    it("creates the database file and tables", () => {
      expect(fs.existsSync(dbPath)).toBe(true);
    });

    it("is idempotent — calling init twice does not throw", () => {
      expect(() => store.init()).not.toThrow();
    });
  });

  // -----------------------------------------------------------------------
  // sessions
  // -----------------------------------------------------------------------

  describe("openSession / closeSession", () => {
    it("creates a session with generated id and timestamp", () => {
      const session = store.openSession({ workspaceId: "ws-1" });

      expect(session.id).toBeTruthy();
      expect(session.workspaceId).toBe("ws-1");
      expect(session.startedAt).toBeTruthy();
      expect(session.endedAt).toBeNull();
      expect(session.summary).toBeNull();
    });

    it("creates a session with optional summary", () => {
      const session = store.openSession({
        workspaceId: "ws-1",
        summary: "Test session",
      });

      expect(session.summary).toBe("Test session");
    });

    it("closes a session with endedAt timestamp", () => {
      const session = store.openSession({ workspaceId: "ws-1" });
      store.closeSession({ sessionId: session.id });

      const context = store.getRecentContext({
        workspaceId: "ws-1",
        sessionId: session.id,
        limit: 1,
      });

      expect(context.session?.endedAt).toBeTruthy();
    });

    it("closes a session with a summary override", () => {
      const session = store.openSession({ workspaceId: "ws-1" });
      store.closeSession({
        sessionId: session.id,
        summary: "Completed successfully",
      });

      const context = store.getRecentContext({
        workspaceId: "ws-1",
        sessionId: session.id,
        limit: 1,
      });

      expect(context.session?.summary).toBe("Completed successfully");
    });

    it("throws when closing a missing session", () => {
      expect(() =>
        store.closeSession({ sessionId: "missing-session" }),
      ).toThrow("Session not found");
    });
  });

  // -----------------------------------------------------------------------
  // prompts
  // -----------------------------------------------------------------------

  describe("savePrompt", () => {
    it("persists a prompt and returns it with generated id", () => {
      const session = store.openSession({ workspaceId: "ws-1" });
      const prompt = store.savePrompt({
        sessionId: session.id,
        workspaceId: "ws-1",
        content: "What is the project structure?",
      });

      expect(prompt.id).toBeTruthy();
      expect(prompt.sessionId).toBe(session.id);
      expect(prompt.workspaceId).toBe("ws-1");
      expect(prompt.content).toBe("What is the project structure?");
      expect(prompt.createdAt).toBeTruthy();
    });
  });

  // -----------------------------------------------------------------------
  // entries (with upsert)
  // -----------------------------------------------------------------------

  describe("saveEntry", () => {
    it("creates a new entry with revision 1", () => {
      const session = store.openSession({ workspaceId: "ws-1" });
      const entry = store.saveEntry({
        sessionId: session.id,
        workspaceId: "ws-1",
        scope: "workspace",
        kind: "fact",
        topic: "architecture",
        title: "Monorepo layout",
        summary: "Uses pnpm workspaces",
        body: "The project uses a pnpm monorepo structure.",
        confidence: 0.9,
        source: "agent",
      });

      expect(entry.id).toBeTruthy();
      expect(entry.revision).toBe(1);
      expect(entry.kind).toBe("fact");
      expect(entry.lastUsedAt).toBeNull();
    });

    it("upserts existing entry by incrementing revision", () => {
      const session = store.openSession({ workspaceId: "ws-1" });

      const first = store.saveEntry({
        sessionId: session.id,
        workspaceId: "ws-1",
        scope: "workspace",
        kind: "fact",
        topic: "architecture",
        title: "Monorepo layout",
        summary: "Uses pnpm workspaces",
        body: "The project uses a pnpm monorepo structure.",
        confidence: 0.9,
        source: "agent",
      });

      const second = store.saveEntry({
        sessionId: session.id,
        workspaceId: "ws-1",
        scope: "workspace",
        kind: "fact",
        topic: "architecture",
        title: "Monorepo layout",
        summary: "Updated: uses pnpm with packages/ and apps/",
        body: "Updated body text.",
        confidence: 0.95,
        source: "agent",
      });

      expect(second.id).toBe(first.id);
      expect(second.revision).toBe(2);
      expect(second.summary).toBe("Updated: uses pnpm with packages/ and apps/");
      expect(second.confidence).toBe(0.95);
      expect(second.createdAt).toBe(first.createdAt);
      // Both operations may complete within the same millisecond,
      // so we only assert the timestamp is at least as recent.
      expect(second.updatedAt >= first.updatedAt).toBe(true);
    });

    it("treats entries with different titles as distinct", () => {
      const session = store.openSession({ workspaceId: "ws-1" });
      const base = {
        sessionId: session.id,
        workspaceId: "ws-1",
        scope: "workspace" as const,
        kind: "fact" as const,
        topic: "architecture",
        summary: "Summary",
        body: "Body",
        confidence: 0.9,
        source: "agent",
      };

      const a = store.saveEntry({ ...base, title: "Title A" });
      const b = store.saveEntry({ ...base, title: "Title B" });

      expect(a.id).not.toBe(b.id);
      expect(a.revision).toBe(1);
      expect(b.revision).toBe(1);
    });
  });

  // -----------------------------------------------------------------------
  // checkpoints
  // -----------------------------------------------------------------------

  describe("saveCheckpoint", () => {
    it("persists a checkpoint with generated id", () => {
      const session = store.openSession({ workspaceId: "ws-1" });
      const checkpoint = store.saveCheckpoint({
        sessionId: session.id,
        workspaceId: "ws-1",
        label: "v0.1 scaffold",
        body: "Created initial project structure",
      });

      expect(checkpoint.id).toBeTruthy();
      expect(checkpoint.sessionId).toBe(session.id);
      expect(checkpoint.label).toBe("v0.1 scaffold");
    });
  });

  // -----------------------------------------------------------------------
  // searchEntries (FTS5)
  // -----------------------------------------------------------------------

  describe("searchEntries", () => {
    let sessionId: string;

    beforeEach(() => {
      const session = store.openSession({ workspaceId: "ws-1" });
      sessionId = session.id;

      store.saveEntry({
        sessionId,
        workspaceId: "ws-1",
        scope: "workspace",
        kind: "fact",
        topic: "architecture",
        title: "Monorepo layout",
        summary: "Uses pnpm workspaces with packages and apps",
        body: "The project uses a pnpm monorepo structure with packages/ and apps/.",
        confidence: 0.9,
        source: "agent",
      });

      store.saveEntry({
        sessionId,
        workspaceId: "ws-1",
        scope: "workspace",
        kind: "decision",
        topic: "tooling",
        title: "Use vitest for testing",
        summary: "Chose vitest over jest for TypeScript-native testing",
        body: "Vitest provides better TypeScript support and faster execution.",
        confidence: 0.85,
        source: "agent",
      });

      store.saveEntry({
        sessionId,
        workspaceId: "ws-1",
        scope: "personal",
        kind: "pattern",
        topic: "workflow",
        title: "Commit after each feature",
        summary: "Always commit after completing a feature",
        body: "This keeps the git history clean and makes rollbacks easier.",
        confidence: 0.7,
        source: "user",
      });
    });

    it("finds entries by keyword match", () => {
      const results = store.searchEntries({
        workspaceId: "ws-1",
        query: "pnpm",
        limit: 10,
      });

      expect(results.length).toBe(1);
      expect(results[0]!.title).toBe("Monorepo layout");
    });

    it("respects limit parameter", () => {
      const results = store.searchEntries({
        workspaceId: "ws-1",
        query: "workspace",
        limit: 1,
      });

      expect(results.length).toBeLessThanOrEqual(1);
    });

    it("filters by scope", () => {
      const results = store.searchEntries({
        workspaceId: "ws-1",
        query: "commit feature",
        limit: 10,
        scope: "personal",
      });

      expect(results.length).toBe(1);
      expect(results[0]!.scope).toBe("personal");
    });

    it("filters by kind", () => {
      const results = store.searchEntries({
        workspaceId: "ws-1",
        query: "vitest testing",
        limit: 10,
        kind: "decision",
      });

      expect(results.length).toBe(1);
      expect(results[0]!.kind).toBe("decision");
    });

    it("filters by topic", () => {
      const results = store.searchEntries({
        workspaceId: "ws-1",
        query: "TypeScript",
        limit: 10,
        topic: "tooling",
      });

      expect(results.length).toBe(1);
      expect(results[0]!.topic).toBe("tooling");
    });

    it("returns empty array for no matches", () => {
      const results = store.searchEntries({
        workspaceId: "ws-1",
        query: "nonexistent keyword xyz",
        limit: 10,
      });

      expect(results).toEqual([]);
    });

    it("returns empty array for whitespace-only query", () => {
      const results = store.searchEntries({
        workspaceId: "ws-1",
        query: "   ",
        limit: 10,
      });

      expect(results).toEqual([]);
    });

    it("updates lastUsedAt on search hits", () => {
      const results = store.searchEntries({
        workspaceId: "ws-1",
        query: "pnpm",
        limit: 10,
      });

      expect(results[0]!.lastUsedAt).toBeTruthy();
    });

    it("isolates results by workspaceId", () => {
      // Entry in a different workspace
      const otherSession = store.openSession({ workspaceId: "ws-other" });
      store.saveEntry({
        sessionId: otherSession.id,
        workspaceId: "ws-other",
        scope: "workspace",
        kind: "fact",
        topic: "architecture",
        title: "pnpm config for other workspace",
        summary: "Also uses pnpm",
        body: "This other workspace also uses pnpm.",
        confidence: 0.8,
        source: "agent",
      });

      const results = store.searchEntries({
        workspaceId: "ws-1",
        query: "pnpm",
        limit: 10,
      });

      expect(results.length).toBe(1);
      expect(results[0]!.workspaceId).toBe("ws-1");
    });
  });

  // -----------------------------------------------------------------------
  // getRecentContext
  // -----------------------------------------------------------------------

  describe("getRecentContext", () => {
    it("returns the most recent session for a workspace", () => {
      store.openSession({ workspaceId: "ws-1", summary: "First" });
      const second = store.openSession({ workspaceId: "ws-1", summary: "Second" });

      const context = store.getRecentContext({
        workspaceId: "ws-1",
        limit: 10,
      });

      expect(context.session?.id).toBe(second.id);
      expect(context.session?.summary).toBe("Second");
    });

    it("returns a specific session when sessionId is provided", () => {
      const first = store.openSession({ workspaceId: "ws-1", summary: "First" });
      store.openSession({ workspaceId: "ws-1", summary: "Second" });

      const context = store.getRecentContext({
        workspaceId: "ws-1",
        sessionId: first.id,
        limit: 10,
      });

      expect(context.session?.id).toBe(first.id);
    });

    it("does not return session from another workspace", () => {
      const other = store.openSession({ workspaceId: "ws-2", summary: "Other" });

      const context = store.getRecentContext({
        workspaceId: "ws-1",
        sessionId: other.id,
        limit: 10,
      });

      expect(context.session).toBeUndefined();
    });

    it("returns prompts, entries, and checkpoints", () => {
      const session = store.openSession({ workspaceId: "ws-1" });

      store.savePrompt({
        sessionId: session.id,
        workspaceId: "ws-1",
        content: "Hello",
      });

      store.saveEntry({
        sessionId: session.id,
        workspaceId: "ws-1",
        scope: "workspace",
        kind: "fact",
        topic: "test",
        title: "Test entry",
        summary: "A test",
        body: "Test body",
        confidence: 0.9,
        source: "agent",
      });

      store.saveCheckpoint({
        sessionId: session.id,
        workspaceId: "ws-1",
        label: "cp-1",
        body: "Checkpoint body",
      });

      const context = store.getRecentContext({
        workspaceId: "ws-1",
        limit: 10,
      });

      expect(context.session).toBeTruthy();
      expect(context.prompts).toHaveLength(1);
      expect(context.entries).toHaveLength(1);
      expect(context.checkpoints).toHaveLength(1);
    });

    it("respects the limit parameter", () => {
      const session = store.openSession({ workspaceId: "ws-1" });

      for (let i = 0; i < 5; i++) {
        store.savePrompt({
          sessionId: session.id,
          workspaceId: "ws-1",
          content: `Prompt ${i}`,
        });
      }

      const context = store.getRecentContext({
        workspaceId: "ws-1",
        limit: 2,
      });

      expect(context.prompts.length).toBeLessThanOrEqual(2);
    });

    it("returns empty arrays when no data exists", () => {
      const context = store.getRecentContext({
        workspaceId: "ws-empty",
        limit: 10,
      });

      expect(context.session).toBeUndefined();
      expect(context.prompts).toEqual([]);
      expect(context.entries).toEqual([]);
      expect(context.checkpoints).toEqual([]);
    });
  });
});

// ---------------------------------------------------------------------------
// doctorDatabase
// ---------------------------------------------------------------------------

describe("doctorDatabase", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mneme-doctor-"));
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  it("reports ok when the database file does not yet exist but the parent dir is writable", () => {
    const dbPath = path.join(tmpDir, "memory.sqlite");
    const result = doctorDatabase(dbPath);

    expect(result.ok).toBe(true);
    expect(result.databasePath).toBe(dbPath);
    const dbCheck = result.checks.find((c) => c.name === "database path");
    expect(dbCheck?.ok).toBe(true);
    expect(dbCheck?.message).toMatch(/will be created/i);
  });

  it("reports ok for a healthy, initialised database", () => {
    const dbPath = path.join(tmpDir, "memory.sqlite");
    // Initialise the database so all tables/triggers exist.
    const store = new SqliteMemoryStore({ databasePath: dbPath });
    store.init();

    const result = doctorDatabase(dbPath);

    expect(result.ok).toBe(true);
    const checks = result.checks;
    expect(checks.find((c) => c.name === "database path")?.ok).toBe(true);
    expect(checks.find((c) => c.name === "read access")?.ok).toBe(true);
    expect(checks.find((c) => c.name === "write access")?.ok).toBe(true);
    expect(checks.find((c) => c.name === "wal mode")?.ok).toBe(true);
    expect(checks.find((c) => c.name === "fts tables")?.ok).toBe(true);
  });

  it("reports failure when the parent directory does not exist", () => {
    const dbPath = path.join(tmpDir, "nonexistent-dir", "memory.sqlite");
    const result = doctorDatabase(dbPath);

    expect(result.ok).toBe(false);
    const dbCheck = result.checks.find((c) => c.name === "database path");
    expect(dbCheck?.ok).toBe(false);
    expect(dbCheck?.message).toMatch(/parent directory does not exist/i);
  });

  it("reports failure when the path points to a directory instead of a file", () => {
    const dbPath = tmpDir; // tmpDir itself is a directory
    const result = doctorDatabase(dbPath);

    // The parent-dir check will pass (parent of tmpDir exists), but the
    // "path exists but is not a file" check should fail.
    expect(result.ok).toBe(false);
    const dbCheck = result.checks.find((c) => c.name === "database path");
    expect(dbCheck?.ok).toBe(false);
    expect(dbCheck?.message).toMatch(/not a file/i);
  });
});
