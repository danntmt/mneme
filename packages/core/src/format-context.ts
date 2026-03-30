import type { ContextBlock } from "./context-block.js";

/**
 * Renders a ContextBlock into a human-readable markdown string.
 * Used by CLI and MCP to return formatted context.
 */
export function formatContext(context: ContextBlock): string {
  const lines: string[] = [];

  if (context.session) {
    lines.push(`# Session ${context.session.id}`);
    lines.push(`Workspace: ${context.session.workspaceId}`);
    lines.push(`Started: ${context.session.startedAt}`);
    if (context.session.summary) {
      lines.push(`Summary: ${context.session.summary}`);
    }
    lines.push("");
  }

  if (context.prompts.length > 0) {
    lines.push("## Recent prompts");
    for (const prompt of context.prompts) {
      lines.push(`- ${prompt.content}`);
    }
    lines.push("");
  }

  if (context.entries.length > 0) {
    lines.push("## Memory entries");
    for (const entry of context.entries) {
      lines.push(`- [${entry.kind}] ${entry.title}: ${entry.summary}`);
    }
    lines.push("");
  }

  if (context.checkpoints.length > 0) {
    lines.push("## Checkpoints");
    for (const checkpoint of context.checkpoints) {
      lines.push(`- ${checkpoint.label}: ${checkpoint.body}`);
    }
  }

  return lines.join("\n").trim();
}
