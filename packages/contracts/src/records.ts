import { z } from "zod";
import { entryKindSchema, memoryScopeSchema } from "./enums.js";

// ---------------------------------------------------------------------------
// Domain records – represent persisted entities
// ---------------------------------------------------------------------------

export const sessionSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  startedAt: z.string(),
  endedAt: z.string().nullable(),
  summary: z.string().nullable(),
});
export type Session = z.infer<typeof sessionSchema>;

export const promptSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  workspaceId: z.string(),
  content: z.string(),
  createdAt: z.string(),
});
export type Prompt = z.infer<typeof promptSchema>;

export const entrySchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  workspaceId: z.string(),
  scope: memoryScopeSchema,
  kind: entryKindSchema,
  topic: z.string(),
  title: z.string(),
  summary: z.string(),
  body: z.string(),
  confidence: z.number().min(0).max(1),
  source: z.string(),
  revision: z.number().int().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),
  lastUsedAt: z.string().nullable(),
});
export type Entry = z.infer<typeof entrySchema>;

export const checkpointSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  workspaceId: z.string(),
  label: z.string(),
  body: z.string(),
  createdAt: z.string(),
});
export type Checkpoint = z.infer<typeof checkpointSchema>;
