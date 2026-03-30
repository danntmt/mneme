import {
  type Checkpoint,
  type CloseSessionInput,
  type CreateSessionInput,
  type Entry,
  type GetContextRawInput,
  type Prompt,
  type SaveCheckpointInput,
  type SaveEntryRawInput,
  type SavePromptInput,
  type SearchEntriesRawInput,
  type Session,
  closeSessionInputSchema,
  createSessionInputSchema,
  getContextInputSchema,
  saveCheckpointInputSchema,
  saveEntryInputSchema,
  savePromptInputSchema,
  searchEntriesInputSchema,
} from "@mneme/contracts";
import type { ContextBlock } from "./context-block.js";
import { formatContext } from "./format-context.js";
import type { MemoryStore } from "./memory-store.js";

/**
 * Application service that sits between consumers (CLI, MCP) and the store.
 *
 * Responsibilities:
 * - validate inputs with zod schemas
 * - delegate to the injected MemoryStore
 * - format context for display
 *
 * It does NOT own persistence logic — that belongs to the store implementation.
 */
export class MemoryService {
  public constructor(private readonly store: MemoryStore) {}

  public async init(): Promise<void> {
    await this.store.init();
  }

  public async close(): Promise<void> {
    if (this.store.close) {
      await this.store.close();
    }
  }

  public async openSession(input: CreateSessionInput): Promise<Session> {
    const parsed = createSessionInputSchema.parse(input);
    return await this.store.openSession(parsed);
  }

  public async closeSession(input: CloseSessionInput): Promise<void> {
    const parsed = closeSessionInputSchema.parse(input);
    await this.store.closeSession(parsed);
  }

  public async savePrompt(input: SavePromptInput): Promise<Prompt> {
    const parsed = savePromptInputSchema.parse(input);
    return await this.store.savePrompt(parsed);
  }

  public async saveEntry(input: SaveEntryRawInput): Promise<Entry> {
    const parsed = saveEntryInputSchema.parse(input);
    return await this.store.saveEntry(parsed);
  }

  public async saveCheckpoint(input: SaveCheckpointInput): Promise<Checkpoint> {
    const parsed = saveCheckpointInputSchema.parse(input);
    return await this.store.saveCheckpoint(parsed);
  }

  public async searchEntries(input: SearchEntriesRawInput): Promise<Entry[]> {
    const parsed = searchEntriesInputSchema.parse(input);
    return await this.store.searchEntries(parsed);
  }

  public async getContext(input: GetContextRawInput): Promise<ContextBlock> {
    const parsed = getContextInputSchema.parse(input);
    return await this.store.getRecentContext(parsed);
  }

  public async getFormattedContext(input: GetContextRawInput): Promise<string> {
    const context = await this.getContext(input);
    return formatContext(context);
  }
}
