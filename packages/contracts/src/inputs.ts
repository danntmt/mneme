import { z } from "zod";
import { entryKindSchema, memoryScopeSchema } from "./enums.js";

// ---------------------------------------------------------------------------
// Input schemas – validated at the boundary before reaching the store
// ---------------------------------------------------------------------------

export const createSessionInputSchema = z.object({
  workspaceId: z.string().min(1),
  summary: z.string().optional(),
});
export type CreateSessionInput = z.infer<typeof createSessionInputSchema>;

export const closeSessionInputSchema = z.object({
  sessionId: z.string().min(1),
  summary: z.string().optional(),
});
export type CloseSessionInput = z.infer<typeof closeSessionInputSchema>;

export const savePromptInputSchema = z.object({
  sessionId: z.string().min(1),
  workspaceId: z.string().min(1),
  content: z.string().min(1),
});
export type SavePromptInput = z.infer<typeof savePromptInputSchema>;

export const saveEntryInputSchema = z.object({
  sessionId: z.string().min(1),
  workspaceId: z.string().min(1),
  scope: memoryScopeSchema.default("workspace"),
  kind: entryKindSchema,
  topic: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  body: z.string().min(1),
  confidence: z.number().min(0).max(1).default(0.8),
  source: z.string().default("agent"),
});
export type SaveEntryInput = z.infer<typeof saveEntryInputSchema>;
/** Pre-validation input type — defaults (scope, confidence, source) are optional. */
export type SaveEntryRawInput = z.input<typeof saveEntryInputSchema>;

export const saveCheckpointInputSchema = z.object({
  sessionId: z.string().min(1),
  workspaceId: z.string().min(1),
  label: z.string().min(1),
  body: z.string().min(1),
});
export type SaveCheckpointInput = z.infer<typeof saveCheckpointInputSchema>;

export const searchEntriesInputSchema = z.object({
  workspaceId: z.string().min(1),
  query: z.string().min(1),
  limit: z.number().int().min(1).max(50).default(10),
  scope: memoryScopeSchema.optional(),
  kind: entryKindSchema.optional(),
  topic: z.string().optional(),
});
export type SearchEntriesInput = z.infer<typeof searchEntriesInputSchema>;
/** Pre-validation input type — limit default is optional. */
export type SearchEntriesRawInput = z.input<typeof searchEntriesInputSchema>;

export const getContextInputSchema = z.object({
  workspaceId: z.string().min(1),
  sessionId: z.string().optional(),
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(10)
    .describe("Maximum number of items to return per category (prompts, entries, checkpoints)"),
});
export type GetContextInput = z.infer<typeof getContextInputSchema>;
/** Pre-validation input type — limit default is optional. */
export type GetContextRawInput = z.input<typeof getContextInputSchema>;
