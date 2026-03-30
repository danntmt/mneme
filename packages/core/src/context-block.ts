import type { Checkpoint, Entry, Prompt, Session } from "@mneme/contracts";

/**
 * A snapshot of recent context for a given workspace or session.
 * Returned by MemoryStore.getRecentContext and MemoryService.getContext.
 */
export interface ContextBlock {
  session?: Session;
  prompts: Prompt[];
  entries: Entry[];
  checkpoints: Checkpoint[];
}
