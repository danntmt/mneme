#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { MemoryService } from "@mneme/core";
import { SqliteMemoryStore, resolveDatabasePath } from "@mneme/sqlite";
import { makeTools } from "./tools.js";

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

const databasePath = resolveDatabasePath();

try {
  const memory = new MemoryService(
    new SqliteMemoryStore({ databasePath }),
  );
  await memory.init();

  const server = new McpServer({
    name: "mneme",
    version: "0.1.0",
  });

  for (const t of makeTools(memory)) {
    server.tool(t.name, t.desc, t.schema, t.handler);
  }

  // -------------------------------------------------------------------------
  // Connect
  // -------------------------------------------------------------------------

  const transport = new StdioServerTransport();
  await server.connect(transport);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`mneme MCP server failed to start: ${message}\n`);
  process.exit(1);
}
