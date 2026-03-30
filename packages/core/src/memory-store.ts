import type {
  Checkpoint,
  CloseSessionInput,
  CreateSessionInput,
  Entry,
  GetContextInput,
  Prompt,
  SaveCheckpointInput,
  SaveEntryInput,
  SavePromptInput,
  SearchEntriesInput,
  Session,
} from "@mneme/contracts";
import type { ContextBlock } from "./context-block.js";

/**
 * Storage contract that any persistence backend must implement.
 *
 * Each method receives already-validated input (validation happens
 * in MemoryService before reaching the store).
 *
 * Implementations can be synchronous or asynchronous.
 */
export interface MemoryStore {
  /** Create tables / indexes if they don't exist yet. */
  init(): void | Promise<void>;
  close?(): void | Promise<void>;

  openSession(input: CreateSessionInput): Session | Promise<Session>;
  closeSession(input: CloseSessionInput): void | Promise<void>;

  savePrompt(input: SavePromptInput): Prompt | Promise<Prompt>;
  saveEntry(input: SaveEntryInput): Entry | Promise<Entry>;
  saveCheckpoint(input: SaveCheckpointInput): Checkpoint | Promise<Checkpoint>;

  searchEntries(input: SearchEntriesInput): Entry[] | Promise<Entry[]>;
  getRecentContext(input: GetContextInput): ContextBlock | Promise<ContextBlock>;
}
