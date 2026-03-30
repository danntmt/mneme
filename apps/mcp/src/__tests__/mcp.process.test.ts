import { describe, expect, it } from "vitest";
import { makeTools } from "../tools.js";

describe("MCP tools", () => {
  it("tool handlers call memory methods and return content", async () => {
    const memory = {
      openSession: async (input: any) => ({ id: "s1", ...input }),
      closeSession: async (_input: any) => {},
      savePrompt: async (input: any) => ({ id: "p1", ...input }),
      saveEntry: async (input: any) => ({ id: "e1", ...input }),
      saveCheckpoint: async (input: any) => ({ id: "c1", ...input }),
      searchEntries: async (input: any) => [{ id: "e1", score: 1 }],
      getFormattedContext: async (input: any) => "CTX",
    } as any;

    const tools = makeTools(memory);
    const open = tools.find((t: { name: string }) => t.name === "mneme_open_session");
    if (!open) throw new Error("Missing mneme_open_session tool");
    const res = await open.handler({ workspaceId: "w1" } as any);
    expect(res.content?.[0]?.text).toContain("s1");

    const search = tools.find((t: { name: string }) => t.name === "mneme_search_entries");
    if (!search) throw new Error("Missing mneme_search_entries tool");
    const sres = await search.handler({ workspaceId: "w1", query: "x" } as any);
    expect(sres.content?.[0]?.text).toContain("e1");
  });

  it("exposes all supported tools", () => {
    const memory = {
      openSession: async (_input: any) => ({ id: "s1" }),
      closeSession: async (_input: any) => {},
      savePrompt: async (_input: any) => ({ id: "p1" }),
      saveEntry: async (_input: any) => ({ id: "e1" }),
      saveCheckpoint: async (_input: any) => ({ id: "c1" }),
      searchEntries: async (_input: any) => [],
      getFormattedContext: async (_input: any) => "",
    } as any;

    const tools = makeTools(memory);
    const names = tools.map((tool) => tool.name);
    expect(names).toEqual([
      "mneme_open_session",
      "mneme_close_session",
      "mneme_save_prompt",
      "mneme_save_entry",
      "mneme_save_checkpoint",
      "mneme_search_entries",
      "mneme_get_context",
    ]);
  });
});
