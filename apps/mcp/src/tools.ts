import type { MemoryService } from "@mneme/core";
import {
  closeSessionInputSchema,
  createSessionInputSchema,
  getContextInputSchema,
  saveCheckpointInputSchema,
  saveEntryInputSchema,
  savePromptInputSchema,
  searchEntriesInputSchema,
} from "@mneme/contracts";

export function makeTools(memory: MemoryService) {
  return [
    {
      name: "mneme_open_session",
      desc: "Open a new memory session for the current workspace.",
      schema: createSessionInputSchema.shape,
      handler: async ({ workspaceId, summary }: { workspaceId: string; summary?: string }) => {
        const session = await memory.openSession({ workspaceId, summary });
        return { content: [{ type: "text" as const, text: JSON.stringify(session, null, 2) }] };
      },
    },

    {
      name: "mneme_close_session",
      desc: "Close an existing memory session with optional summary.",
      schema: closeSessionInputSchema.shape,
      handler: async ({ sessionId, summary }: { sessionId: string; summary?: string }) => {
        await memory.closeSession({ sessionId, summary });
        return { content: [{ type: "text" as const, text: JSON.stringify({ ok: true, sessionId }, null, 2) }] };
      },
    },

    {
      name: "mneme_save_prompt",
      desc: "Save the user's prompt to the memory session for later context recall.",
      schema: savePromptInputSchema.shape,
      handler: async ({
        sessionId,
        workspaceId,
        content,
      }: {
        sessionId: string;
        workspaceId: string;
        content: string;
      }) => {
        const prompt = await memory.savePrompt({
          sessionId,
          workspaceId,
          content,
        });
        return { content: [{ type: "text" as const, text: JSON.stringify(prompt, null, 2) }] };
      },
    },

    {
      name: "mneme_save_entry",
      desc: "Save a structured memory entry (fact, decision, pattern, task, summary, or warning).",
      schema: saveEntryInputSchema.shape,
      handler: async (input: {
        sessionId: string;
        workspaceId: string;
        scope?: "workspace" | "personal";
        kind: "fact" | "decision" | "pattern" | "task" | "summary" | "warning";
        topic: string;
        title: string;
        summary: string;
        body: string;
        confidence?: number;
        source?: string;
      }) => {
        const entry = await memory.saveEntry(input);
        return { content: [{ type: "text" as const, text: JSON.stringify(entry, null, 2) }] };
      },
    },

    {
      name: "mneme_save_checkpoint",
      desc: "Save a checkpoint marking a milestone or progress point in the session.",
      schema: saveCheckpointInputSchema.shape,
      handler: async ({
        sessionId,
        workspaceId,
        label,
        body,
      }: {
        sessionId: string;
        workspaceId: string;
        label: string;
        body: string;
      }) => {
        const checkpoint = await memory.saveCheckpoint({
          sessionId,
          workspaceId,
          label,
          body,
        });
        return { content: [{ type: "text" as const, text: JSON.stringify(checkpoint, null, 2) }] };
      },
    },

    {
      name: "mneme_search_entries",
      desc: "Search stored memory entries using full-text search with optional filters.",
      schema: searchEntriesInputSchema.shape,
      handler: async (input: {
        workspaceId: string;
        query: string;
        limit?: number;
        scope?: "workspace" | "personal";
        kind?: "fact" | "decision" | "pattern" | "task" | "summary" | "warning";
        topic?: string;
      }) => {
        const results = await memory.searchEntries(input);
        return { content: [{ type: "text" as const, text: JSON.stringify(results, null, 2) }] };
      },
    },

    {
      name: "mneme_get_context",
      desc: "Retrieve formatted context (session, prompts, entries, checkpoints) for a workspace.",
      schema: getContextInputSchema.shape,
      handler: async (input: {
        workspaceId: string;
        sessionId?: string;
        limit?: number;
      }) => {
        const text = await memory.getFormattedContext(input);
        return { content: [{ type: "text" as const, text }] };
      },
    },
  ];
}
