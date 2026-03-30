import { describe, expect, it } from "vitest";

import {
  createSessionInputSchema,
  saveEntryInputSchema,
  searchEntriesInputSchema,
  getContextInputSchema,
} from "../inputs.js";

describe("contracts: input schemas", () => {
  it("createSessionInputSchema rejects empty workspaceId", () => {
    expect(() => createSessionInputSchema.parse({ workspaceId: "" })).toThrow();
  });

  it("saveEntryInputSchema applies defaults and validates bounds", () => {
    const raw = {
      sessionId: "s1",
      workspaceId: "w1",
      topic: "t",
      title: "ttl",
      summary: "sum",
      body: "body",
      kind: "fact",
    } as const;
    const parsed = saveEntryInputSchema.parse(raw);
    expect(parsed.scope).toBeDefined();
    expect(parsed.confidence).toBeGreaterThanOrEqual(0);
    expect(parsed.confidence).toBeLessThanOrEqual(1);
  });

  it("saveEntryInputSchema rejects invalid confidence", () => {
    expect(() =>
      saveEntryInputSchema.parse({
        sessionId: "s",
        workspaceId: "w",
        topic: "t",
        title: "t",
        summary: "s",
        body: "b",
        kind: "fact",
        confidence: 1.1,
      }),
    ).toThrow();
  });

  it("searchEntriesInputSchema validates limit range", () => {
    expect(() => searchEntriesInputSchema.parse({ workspaceId: "w", query: "x", limit: 0 })).toThrow();
    expect(() => searchEntriesInputSchema.parse({ workspaceId: "w", query: "x", limit: 51 })).toThrow();
    const ok = searchEntriesInputSchema.parse({ workspaceId: "w", query: "x" });
    expect(ok.limit).toBe(10);
  });

  it("getContextInputSchema validates optional sessionId and limit", () => {
    expect(() => getContextInputSchema.parse({ workspaceId: "w", limit: 0 })).toThrow();
    const ok = getContextInputSchema.parse({ workspaceId: "w" });
    expect(ok.limit).toBe(10);
  });
});
