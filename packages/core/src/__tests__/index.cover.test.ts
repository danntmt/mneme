import { test, expect } from "vitest";
import { MemoryService, formatContext } from "../index.js";

test("core index re-exports public surface", () => {
  expect(typeof MemoryService).toBe("function");
  expect(typeof formatContext).toBe("function");
});
