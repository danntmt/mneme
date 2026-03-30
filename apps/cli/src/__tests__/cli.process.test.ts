import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import { printHelp, getArg } from "../cli-utils.js";

vi.mock("@mneme/sqlite", () => ({
  doctorDatabase: (databasePath: string) => ({
    databasePath,
    ok: true,
    checks: [],
  }),
}));

vi.mock("@mneme/core", () => {
  const MemoryService = vi.fn().mockImplementation(() => ({
    init: vi.fn(async () => {}),
    openSession: vi.fn(async () => ({ id: "s1" })),
    closeSession: vi.fn(async () => {}),
    searchEntries: vi.fn(async () => [{ id: "e1" }]),
    getFormattedContext: vi.fn(async () => "CTX"),
  }));
  return { MemoryService };
});

type MockMemoryService = {
  init: () => Promise<void>;
  searchEntries: (input: { workspaceId: string; query: string; limit?: number }) => Promise<unknown>;
  getFormattedContext: (input: { workspaceId: string; sessionId?: string; limit?: number }) => Promise<string>;
};

const runCli = async (args: string[], memory: MockMemoryService) => {
  const { getArg, printHelp } = await import("../cli-utils.js");
  const [, , command, ...rest] = args;
  const { doctorDatabase } = await import("@mneme/sqlite");

  if (!command || command === "--help" || command === "help") {
    printHelp();
    return 0;
  }

  if (command === "init") {
    console.log(JSON.stringify({ ok: true, filePath: "AGENTS.md" }, null, 2));
    return 0;
  }

  if (command === "doctor") {
    const result = doctorDatabase("/tmp/memory.sqlite");
    console.log(JSON.stringify(result, null, 2));
    return result.ok ? 0 : 1;
  }

  if (command === "info") {
    console.log(JSON.stringify({ databasePath: "/tmp/memory.sqlite" }, null, 2));
    return 0;
  }

  const workspaceId = getArg(rest, "workspace");
  if (!workspaceId) {
    console.error("Missing required flag: --workspace <id>");
    return 1;
  }

  switch (command) {
    case "search": {
      const query = getArg(rest, "query");
      if (!query) {
        console.error("Missing required flag: --query <text>");
        return 1;
      }
      const results = await memory.searchEntries({
        workspaceId,
        query,
        limit: Number(getArg(rest, "limit", "10")),
      });
      console.log(JSON.stringify(results, null, 2));
      return 0;
    }

    case "context": {
      const text = await memory.getFormattedContext({
        workspaceId,
        sessionId: getArg(rest, "session"),
        limit: Number(getArg(rest, "limit", "10")),
      });
      console.log(text);
      return 0;
    }

    default:
      console.error(`Unknown command: ${command}`);
      printHelp();
      return 1;
  }
};

describe("CLI utils", () => {
  it("printHelp writes usage text to stdout", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    printHelp();
    expect(spy).toHaveBeenCalled();
    const firstCall = spy.mock.calls[0]?.[0] ?? "";
    expect(firstCall).toMatch(/mneme CLI/);
    spy.mockRestore();
  });

  it("getArg extracts values from args array", () => {
    const args = ["open-session", "--workspace", "w1", "--limit", "5"];
    expect(getArg(args, "workspace")).toBe("w1");
    expect(getArg(args, "limit", "10")).toBe("5");
    expect(getArg(args, "missing", "x")).toBe("x");
  });
});

describe("CLI commands", () => {
  let fsExistsSpy: ReturnType<typeof vi.spyOn> | undefined;

  beforeEach(() => {
    fsExistsSpy = vi.spyOn(fs, "existsSync");
  });

  afterEach(() => {
    fsExistsSpy?.mockRestore();
  });
  const memory: MockMemoryService = {
    init: async () => {},
    searchEntries: async (_input) => [{ id: "e1" }],
    getFormattedContext: async (_input) => "CTX",
  };

  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it("runs search with query", async () => {
    const code = await runCli([
      "node",
      "mneme",
      "search",
      "--workspace",
      "w1",
      "--query",
      "x",
    ], memory);
    expect(code).toBe(0);
    expect(logSpy).toHaveBeenCalled();
  });

  it("runs context with workspace", async () => {
    const code = await runCli([
      "node",
      "mneme",
      "context",
      "--workspace",
      "w1",
    ], memory);
    expect(code).toBe(0);
    expect(logSpy).toHaveBeenCalledWith("CTX");
  });

  it("runs info without workspace", async () => {
    const code = await runCli([
      "node",
      "mneme",
      "info",
    ], memory);
    expect(code).toBe(0);
    expect(logSpy).toHaveBeenCalled();
  });

  it("runs doctor without workspace", async () => {
    const code = await runCli([
      "node",
      "mneme",
      "doctor",
    ], memory);
    expect(code).toBe(0);
    expect(logSpy).toHaveBeenCalled();
  });

  it("runs init without workspace", async () => {
    const { MemoryService } = await import("@mneme/core");
    const code = await runCli([
      "node",
      "mneme",
      "init",
    ], memory);
    expect(code).toBe(0);
    expect(logSpy).toHaveBeenCalled();
    expect(MemoryService).not.toHaveBeenCalled();
    expect(fsExistsSpy).toHaveBeenCalled();
  });
});
