import { z } from "zod";

/** Scope determines the visibility of a memory entry. */
export const memoryScopeSchema = z.enum(["workspace", "personal"]);
export type MemoryScope = z.infer<typeof memoryScopeSchema>;

/** Kind classifies the nature of a memory entry. */
export const entryKindSchema = z.enum([
  "fact",
  "decision",
  "pattern",
  "task",
  "summary",
  "warning",
]);
export type EntryKind = z.infer<typeof entryKindSchema>;
