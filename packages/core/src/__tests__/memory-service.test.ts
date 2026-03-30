import { describe, expect, it, vi, beforeEach } from "vitest";
import type {
  Checkpoint,
  Entry,
  Prompt,
  Session,
} from "@mneme/contracts";
import { MemoryService } from "../memory-service.js";
import type { MemoryStore } from "../memory-store.js";
import type { ContextBlock } from "../context-block.js";

// ---------------------------------------------------------------------------
// Mock store factory
// ---------------------------------------------------------------------------

function createMockStore(): MemoryStore {
  return {
    init: vi.fn(),
    close: vi.fn(),
    openSession: vi.fn(),
    closeSession: vi.fn(),
    savePrompt: vi.fn(),
    saveEntry: vi.fn(),
    saveCheckpoint: vi.fn(),
    searchEntries: vi.fn(),
    getRecentContext: vi.fn(),
  };
}

// ---------------------------------------------------------------------------
// Fixture factories — minimal valid domain objects
// ---------------------------------------------------------------------------

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: "sess-1",
    workspaceId: "ws-1",
    startedAt: "2025-01-01T00:00:00Z",
    endedAt: null,
    summary: null,
    ...overrides,
  };
}

function makePrompt(overrides: Partial<Prompt> = {}): Prompt {
  return {
    id: "pr-1",
    sessionId: "sess-1",
    workspaceId: "ws-1",
    content: "Hello",
    createdAt: "2025-01-01T00:01:00Z",
    ...overrides,
  };
}

function makeEntry(overrides: Partial<Entry> = {}): Entry {
  return {
    id: "ent-1",
    sessionId: "sess-1",
    workspaceId: "ws-1",
    scope: "workspace",
    kind: "fact",
    topic: "architecture",
    title: "Monorepo layout",
    summary: "Uses pnpm workspaces",
    body: "Full body",
    confidence: 0.9,
    source: "agent",
    revision: 1,
    createdAt: "2025-01-01T00:02:00Z",
    updatedAt: "2025-01-01T00:02:00Z",
    lastUsedAt: null,
    ...overrides,
  };
}

function makeCheckpoint(overrides: Partial<Checkpoint> = {}): Checkpoint {
  return {
    id: "cp-1",
    sessionId: "sess-1",
    workspaceId: "ws-1",
    label: "v0.1",
    body: "Initial scaffold",
    createdAt: "2025-01-01T00:03:00Z",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("MemoryService", () => {
  let store: MemoryStore;
  let service: MemoryService;

  beforeEach(() => {
    store = createMockStore();
    service = new MemoryService(store);
  });

  // -----------------------------------------------------------------------
  // init
  // -----------------------------------------------------------------------

  describe("init", () => {
    it("delegates to store.init()", async () => {
      await service.init();
      expect(store.init).toHaveBeenCalledOnce();
    });
  });

  // -----------------------------------------------------------------------
  // close
  // -----------------------------------------------------------------------

  describe("close", () => {
    it("delegates to store.close() when available", async () => {
      await service.close();
      expect(store.close).toHaveBeenCalledOnce();
    });
  });

  // -----------------------------------------------------------------------
  // openSession
  // -----------------------------------------------------------------------

  describe("openSession", () => {
    it("validates input and delegates to store", async () => {
      const session = makeSession();
      vi.mocked(store.openSession).mockResolvedValue(session);

      const result = await service.openSession({ workspaceId: "ws-1" });

      expect(store.openSession).toHaveBeenCalledWith({ workspaceId: "ws-1" });
      expect(result).toEqual(session);
    });

    it("passes optional summary through", async () => {
      const session = makeSession({ summary: "Test session" });
      vi.mocked(store.openSession).mockResolvedValue(session);

      await service.openSession({ workspaceId: "ws-1", summary: "Test session" });

      expect(store.openSession).toHaveBeenCalledWith({
        workspaceId: "ws-1",
        summary: "Test session",
      });
    });

    it("throws ZodError for empty workspaceId", async () => {
      await expect(service.openSession({ workspaceId: "" })).rejects.toThrow();
      expect(store.openSession).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // closeSession
  // -----------------------------------------------------------------------

  describe("closeSession", () => {
    it("delegates to store with sessionId only", async () => {
      await service.closeSession({ sessionId: "sess-1" });
      expect(store.closeSession).toHaveBeenCalledWith({ sessionId: "sess-1" });
    });

    it("delegates to store with sessionId and summary", async () => {
      await service.closeSession({ sessionId: "sess-1", summary: "Done" });
      expect(store.closeSession).toHaveBeenCalledWith({
        sessionId: "sess-1",
        summary: "Done",
      });
    });

    it("throws ZodError for empty sessionId", async () => {
      await expect(
        service.closeSession({ sessionId: "" }),
      ).rejects.toThrow();
      expect(store.closeSession).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // savePrompt
  // -----------------------------------------------------------------------

  describe("savePrompt", () => {
    it("validates and delegates to store", async () => {
      const prompt = makePrompt();
      vi.mocked(store.savePrompt).mockResolvedValue(prompt);

      const input = { sessionId: "sess-1", workspaceId: "ws-1", content: "Hello" };
      const result = await service.savePrompt(input);

      expect(store.savePrompt).toHaveBeenCalledWith(input);
      expect(result).toEqual(prompt);
    });

    it("throws ZodError for empty content", async () => {
      const input = { sessionId: "sess-1", workspaceId: "ws-1", content: "" };
      await expect(service.savePrompt(input)).rejects.toThrow();
      expect(store.savePrompt).not.toHaveBeenCalled();
    });

    it("throws ZodError for missing sessionId", async () => {
      const input = { sessionId: "", workspaceId: "ws-1", content: "Hello" };
      await expect(service.savePrompt(input)).rejects.toThrow();
      expect(store.savePrompt).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // saveEntry
  // -----------------------------------------------------------------------

  describe("saveEntry", () => {
    it("validates and delegates with defaults applied", async () => {
      const entry = makeEntry();
      vi.mocked(store.saveEntry).mockResolvedValue(entry);

      const input = {
        sessionId: "sess-1",
        workspaceId: "ws-1",
        kind: "fact" as const,
        topic: "architecture",
        title: "Monorepo layout",
        summary: "Uses pnpm workspaces",
        body: "Full body",
      };

      const result = await service.saveEntry(input);

      // Defaults should be applied by zod: scope="workspace", confidence=0.8, source="agent"
      expect(store.saveEntry).toHaveBeenCalledWith({
        ...input,
        scope: "workspace",
        confidence: 0.8,
        source: "agent",
      });
      expect(result).toEqual(entry);
    });

    it("allows explicit scope and confidence overrides", async () => {
      const entry = makeEntry({ scope: "personal", confidence: 0.5 });
      vi.mocked(store.saveEntry).mockResolvedValue(entry);

      const input = {
        sessionId: "sess-1",
        workspaceId: "ws-1",
        scope: "personal" as const,
        kind: "decision" as const,
        topic: "tooling",
        title: "Use vitest",
        summary: "Fast and TS-native",
        body: "Decided to use vitest",
        confidence: 0.5,
        source: "user",
      };

      await service.saveEntry(input);
      expect(store.saveEntry).toHaveBeenCalledWith(input);
    });

    it("throws ZodError for invalid kind", async () => {
      const input = {
        sessionId: "sess-1",
        workspaceId: "ws-1",
        kind: "invalid-kind" as never,
        topic: "architecture",
        title: "Test",
        summary: "Test",
        body: "Test",
      };

      await expect(service.saveEntry(input)).rejects.toThrow();
      expect(store.saveEntry).not.toHaveBeenCalled();
    });

    it("throws ZodError for confidence out of range", async () => {
      const input = {
        sessionId: "sess-1",
        workspaceId: "ws-1",
        kind: "fact" as const,
        topic: "architecture",
        title: "Test",
        summary: "Test",
        body: "Test",
        confidence: 1.5,
      };

      await expect(service.saveEntry(input)).rejects.toThrow();
      expect(store.saveEntry).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // saveCheckpoint
  // -----------------------------------------------------------------------

  describe("saveCheckpoint", () => {
    it("validates and delegates to store", async () => {
      const checkpoint = makeCheckpoint();
      vi.mocked(store.saveCheckpoint).mockResolvedValue(checkpoint);

      const input = {
        sessionId: "sess-1",
        workspaceId: "ws-1",
        label: "v0.1",
        body: "Initial scaffold",
      };

      const result = await service.saveCheckpoint(input);

      expect(store.saveCheckpoint).toHaveBeenCalledWith(input);
      expect(result).toEqual(checkpoint);
    });

    it("throws ZodError for empty label", async () => {
      const input = {
        sessionId: "sess-1",
        workspaceId: "ws-1",
        label: "",
        body: "Initial scaffold",
      };

      await expect(service.saveCheckpoint(input)).rejects.toThrow();
      expect(store.saveCheckpoint).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // searchEntries
  // -----------------------------------------------------------------------

  describe("searchEntries", () => {
    it("validates and delegates with default limit", async () => {
      const entries = [makeEntry()];
      vi.mocked(store.searchEntries).mockResolvedValue(entries);

      const input = { workspaceId: "ws-1", query: "architecture" };
      const result = await service.searchEntries(input);

      expect(store.searchEntries).toHaveBeenCalledWith({
        workspaceId: "ws-1",
        query: "architecture",
        limit: 10, // default
      });
      expect(result).toEqual(entries);
    });

    it("passes explicit limit and filters through", async () => {
      vi.mocked(store.searchEntries).mockResolvedValue([]);

      const input = {
        workspaceId: "ws-1",
        query: "decisions",
        limit: 5,
        scope: "workspace" as const,
        kind: "decision" as const,
        topic: "tooling",
      };

      await service.searchEntries(input);
      expect(store.searchEntries).toHaveBeenCalledWith(input);
    });

    it("throws ZodError for empty query", async () => {
      await expect(
        service.searchEntries({ workspaceId: "ws-1", query: "" }),
      ).rejects.toThrow();
      expect(store.searchEntries).not.toHaveBeenCalled();
    });

    it("throws ZodError for limit exceeding max", async () => {
      await expect(
        service.searchEntries({ workspaceId: "ws-1", query: "test", limit: 100 }),
      ).rejects.toThrow();
      expect(store.searchEntries).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // getContext
  // -----------------------------------------------------------------------

  describe("getContext", () => {
    it("validates and returns context block", async () => {
      const contextBlock: ContextBlock = {
        session: makeSession(),
        prompts: [makePrompt()],
        entries: [makeEntry()],
        checkpoints: [makeCheckpoint()],
      };
      vi.mocked(store.getRecentContext).mockResolvedValue(contextBlock);

      const result = await service.getContext({ workspaceId: "ws-1" });

      expect(store.getRecentContext).toHaveBeenCalledWith({
        workspaceId: "ws-1",
        limit: 10, // default
      });
      expect(result).toEqual(contextBlock);
    });

    it("passes optional sessionId and limit through", async () => {
      const contextBlock: ContextBlock = {
        prompts: [],
        entries: [],
        checkpoints: [],
      };
      vi.mocked(store.getRecentContext).mockResolvedValue(contextBlock);

      await service.getContext({
        workspaceId: "ws-1",
        sessionId: "sess-1",
        limit: 20,
      });

      expect(store.getRecentContext).toHaveBeenCalledWith({
        workspaceId: "ws-1",
        sessionId: "sess-1",
        limit: 20,
      });
    });
  });

  // -----------------------------------------------------------------------
  // getFormattedContext
  // -----------------------------------------------------------------------

  describe("getFormattedContext", () => {
    it("returns formatted markdown string", async () => {
      const contextBlock: ContextBlock = {
        session: makeSession(),
        prompts: [makePrompt({ content: "Hello world" })],
        entries: [],
        checkpoints: [],
      };
      vi.mocked(store.getRecentContext).mockResolvedValue(contextBlock);

      const result = await service.getFormattedContext({ workspaceId: "ws-1" });

      expect(typeof result).toBe("string");
      expect(result).toContain("# Session sess-1");
      expect(result).toContain("- Hello world");
    });

    it("returns empty string for empty context", async () => {
      const contextBlock: ContextBlock = {
        prompts: [],
        entries: [],
        checkpoints: [],
      };
      vi.mocked(store.getRecentContext).mockResolvedValue(contextBlock);

      const result = await service.getFormattedContext({ workspaceId: "ws-1" });
      expect(result).toBe("");
    });
  });
});
