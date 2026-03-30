import { describe, expect, it } from "vitest";
import path from "node:path";
import { resolveDatabasePath } from "../paths.js";

describe("resolveDatabasePath", () => {
  it("uses MNEME_DB_PATH when set (absolute)", () => {
    const databasePath = resolveDatabasePath({
      env: { MNEME_DB_PATH: "/custom/path/to/db.sqlite" },
      platform: "linux",
      homedir: "/home/test",
      cwd: "/work",
    });
    expect(databasePath).toBe("/custom/path/to/db.sqlite");
  });

  it("resolves MNEME_DB_PATH relative paths against cwd", () => {
    const databasePath = resolveDatabasePath({
      env: { MNEME_DB_PATH: "relative/db.sqlite" },
      platform: "win32",
      homedir: "/home/test",
      cwd: "C:\\work",
    });
    expect(databasePath).toBe(path.win32.resolve("C:\\work", "relative/db.sqlite"));
  });

  it("uses XDG_DATA_HOME on linux when set", () => {
    const databasePath = resolveDatabasePath({
      env: { XDG_DATA_HOME: "/custom/data" },
      platform: "linux",
      homedir: "/home/test",
      cwd: "/work",
    });
    expect(databasePath).toBe("/custom/data/mneme/memory.sqlite");
  });

  it("defaults to ~/.local/share on linux without XDG_DATA_HOME", () => {
    const databasePath = resolveDatabasePath({
      env: {},
      platform: "linux",
      homedir: "/home/test",
      cwd: "/work",
    });
    expect(databasePath).toBe("/home/test/.local/share/mneme/memory.sqlite");
  });

  it("uses LOCALAPPDATA on windows when set", () => {
    const databasePath = resolveDatabasePath({
      env: { LOCALAPPDATA: "C:\\Users\\test\\AppData\\Local" },
      platform: "win32",
      homedir: "C:\\Users\\test",
      cwd: "C:\\work",
    });
    expect(databasePath).toBe(
      "C:\\Users\\test\\AppData\\Local\\mneme\\memory.sqlite",
    );
  });

  it("uses AppData/Local fallback on windows without LOCALAPPDATA", () => {
    const databasePath = resolveDatabasePath({
      env: {},
      platform: "win32",
      homedir: "C:\\Users\\test",
      cwd: "C:\\work",
    });
    expect(databasePath).toBe(
      "C:\\Users\\test\\AppData\\Local\\mneme\\memory.sqlite",
    );
  });

  it("uses ~/Library/Application Support on macOS", () => {
    const databasePath = resolveDatabasePath({
      env: {},
      platform: "darwin",
      homedir: "/Users/test",
      cwd: "/work",
    });
    expect(databasePath).toBe(
      "/Users/test/Library/Application Support/mneme/memory.sqlite",
    );
  });
});
