#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { MemoryService } from "@mneme/core";
import { SqliteMemoryStore, doctorDatabase, resolveDatabasePath } from "@mneme/sqlite";

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

const databasePath = resolveDatabasePath();

const initMemory = async (): Promise<MemoryService> => {
  const memory = new MemoryService(
    new SqliteMemoryStore({ databasePath }),
  );
  await memory.init();
  return memory;
};

// ---------------------------------------------------------------------------
// Arg parsing + Help (use helpers for testability)
// ---------------------------------------------------------------------------
import {
  getArg,
  hasFlag,
  parseAgentArg,
  printHelp,
  renderAgentInstructions,
  resolveInitTarget,
} from "./cli-utils.js";

const [, , command, ...args] = process.argv;

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

if (!command || command === "--help" || command === "help") {
  printHelp();
  process.exit(0);
}

switch (command) {
  case "init": {
    const agent = parseAgentArg(getArg(args, "agent"));
    const workspaceOverride = getArg(args, "workspace");
    const workspaceId = workspaceOverride ?? path.basename(process.cwd());
    const target = resolveInitTarget(agent);
    const targetPath = path.join(process.cwd(), target.filePath);
    const shouldForce = hasFlag(args, "force");

    if (fs.existsSync(targetPath) && !shouldForce) {
      console.error(
          `An instructions file already exists at ${target.filePath}. Use --force to overwrite.\n\n` +
          `⚠️ Attention: Using --force will overwrite the file, deleting all its current contents and replacing them with the Mneme tool instructions.\n\n` +
          `Alternatively, you can manually append the following content to your existing instructions file:\n\n` +
          `${renderAgentInstructions(workspaceId)}`
      );
      process.exit(1);
    }

    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    const content = renderAgentInstructions(workspaceId);
    fs.writeFileSync(targetPath, content, "utf8");

    console.log(JSON.stringify({
      ok: true,
      workspaceId,
      agent: target.agent,
      filePath: target.filePath,
    }, null, 2));
    process.exit(0);
  }

  case "doctor": {
    const result = doctorDatabase(databasePath);
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.ok ? 0 : 1);
  }

  case "info": {
    const source = process.env.MNEME_DB_PATH ? "env" : "default";
    const dbExists = fs.existsSync(databasePath);
    console.log(JSON.stringify({
      databasePath,
      source,
      exists: dbExists,
    }, null, 2));
    process.exit(0);
  }

  default:
    break;
}

const workspaceId = getArg(args, "workspace");
if (!workspaceId) {
  console.error("Missing required flag: --workspace <id>");
  process.exit(1);
}

function parseLimit(raw: string | undefined): number {
  const n = Number(raw ?? "10");
  if (!Number.isFinite(n) || n < 1) {
    console.error(`Invalid value for --limit: "${raw}". Must be a positive integer.`);
    process.exit(1);
  }
  return n;
}

try {
  switch (command) {
    case "search": {
      const query = getArg(args, "query");
      if (!query) {
        console.error("Missing required flag: --query <text>");
        process.exit(1);
      }
      const memory = await initMemory();
      const results = await memory.searchEntries({
        workspaceId,
        query,
        limit: parseLimit(getArg(args, "limit")),
      });
      console.log(JSON.stringify(results, null, 2));
      break;
    }

    case "context": {
      const memory = await initMemory();
      const text = await memory.getFormattedContext({
        workspaceId,
        sessionId: getArg(args, "session"),
        limit: parseLimit(getArg(args, "limit")),
      });
      console.log(text);
      break;
    }

    default:
      console.error(`Unknown command: ${command}`);
      printHelp();
      process.exit(1);
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`mneme: ${message}`);
  process.exit(1);
}
