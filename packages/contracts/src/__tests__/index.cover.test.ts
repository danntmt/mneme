import { test, expect } from "vitest";
import {
  entryKindSchema,
  memoryScopeSchema,
  sessionSchema,
  promptSchema,
  entrySchema,
  checkpointSchema,
  createSessionInputSchema,
  closeSessionInputSchema,
  savePromptInputSchema,
  saveEntryInputSchema,
  saveCheckpointInputSchema,
  searchEntriesInputSchema,
  getContextInputSchema,
} from "../index.js";

test("contracts index re-exports public surface", () => {
  expect(entryKindSchema).toBeDefined();
  expect(memoryScopeSchema).toBeDefined();
  expect(sessionSchema).toBeDefined();
  expect(promptSchema).toBeDefined();
  expect(entrySchema).toBeDefined();
  expect(checkpointSchema).toBeDefined();
  expect(createSessionInputSchema).toBeDefined();
  expect(closeSessionInputSchema).toBeDefined();
  expect(savePromptInputSchema).toBeDefined();
  expect(saveEntryInputSchema).toBeDefined();
  expect(saveCheckpointInputSchema).toBeDefined();
  expect(searchEntriesInputSchema).toBeDefined();
  expect(getContextInputSchema).toBeDefined();
});
