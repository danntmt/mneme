import { test, expect } from "vitest";
import { SqliteMemoryStore } from "../index.js";

test("sqlite index re-exports public surface", () => {
  expect(typeof SqliteMemoryStore).toBe("function");
});
