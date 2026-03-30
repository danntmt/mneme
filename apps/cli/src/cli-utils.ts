import path from "node:path";

export const getArg = (args: string[], name: string, fallback?: string): string | undefined => {
  const index = args.indexOf(`--${name}`);
  if (index === -1) return fallback;
  return args[index + 1] ?? fallback;
};

export const hasFlag = (args: string[], name: string): boolean =>
  args.includes(`--${name}`);

export type AgentName = "opencode" | "copilot";

type AgentTarget = {
  agent: AgentName;
  filePath: string;
};

const AGENT_TARGETS: AgentTarget[] = [
  { agent: "opencode", filePath: "AGENTS.md" },
  { agent: "copilot", filePath: path.join(".github", "copilot-instructions.md") },
];

const AGENT_NAMES = new Set<AgentName>(["opencode", "copilot"]);

export const parseAgentArg = (value?: string): AgentName | undefined => {
  if (!value) return undefined;
  const normalized = value.toLowerCase() as AgentName;
  return AGENT_NAMES.has(normalized) ? normalized : undefined;
};

export const resolveInitTarget = (
  agent?: AgentName,
): AgentTarget => {
  if (agent) {
    const target = AGENT_TARGETS.find((entry) => entry.agent === agent);
    return target ?? { agent, filePath: "AGENTS.md" };
  }

  return { agent: "opencode", filePath: "AGENTS.md" };
};

export const renderAgentInstructions = (workspaceId: string): string => {
  return `## Memory

You have access to a persistent local memory system via MCP tools prefixed with \`mneme_*\`.
Use it to retain knowledge across conversations: facts about the codebase, architectural decisions,
recurring patterns, and warnings.

### Session lifecycle

1. **Retrieve prior context** - Before doing anything, call \`mneme_get_context\` with the
   project's \`workspaceId\` to load recent session data, entries, and checkpoints. Also call
   \`mneme_search_entries\` with keywords relevant to the user's request to find related
   knowledge.

2. **Open a session** - Call \`mneme_open_session\` with \`workspaceId\` set to \"${workspaceId}\".
   The returned object contains a \`sessionId\` - **retain it** for all subsequent calls in this
   conversation.

3. **Save the user's prompt** - Call \`mneme_save_prompt\` with the \`sessionId\`, \`workspaceId\`,
   and the user's message. This builds a retrievable history of what was asked.

4. **Save discoveries incrementally** - As you work, save insights using \`mneme_save_entry\`.
   Don't wait until the end. Use the appropriate \`kind\`:

   | Kind         | When to use                                                       |
   |--------------|-------------------------------------------------------------------|
   | \`fact\`     | Objective information about the codebase, environment, or project |
   | \`decision\` | Architectural or design choices, include rationale                |
   | \`pattern\`  | Recurring workflows, conventions, or coding preferences           |
   | \`task\`     | Work items, next steps, or things to follow up on                 |
   | \`summary\`  | Condensed summaries of what happened in this session              |
   | \`warning\`  | Pitfalls, known issues, or things to avoid                        |

5. **Mark milestones** - Call \`mneme_save_checkpoint\` when meaningful progress is reached
   (e.g., a feature is complete, a refactor passes tests, or before a risky change).

6. **Handle errors** - If a call fails due to a missing or expired session, re-open one with the
   same \`workspaceId\`.

### Key parameters

| Parameter       | Description                                                                                                                                   |
|-----------------|-----------------------------------------------------------------------------------------------------------------------------------------------|
| \`workspaceId\` | Stable project identifier. Use \"${workspaceId}\" for this workspace.                                                                         |
| \`sessionId\`   | Returned by \`open_session\`. Required for \`save_prompt\`, \`save_entry\`, and \`save_checkpoint\`. Retain it for the entire conversation.   |
| \`scope\`       | \`workspace\` (default) for project-wide knowledge, \`personal\` for user-specific preferences.                                               |
| \`topic\`       | Grouping label (e.g., \`architecture\`, \`testing\`, \`deployment\`, \`api\`).                                                                |
| \`confidence\`  | Value from 0.0 to 1.0 indicating certainty. Default is 0.8. Use lower values for uncertain or inferred information.                           |

### Best practices

- **Search before you act.** Before starting a complex task, search memory for related facts,
  decisions, and warnings. Prior context prevents redundant work and contradictory decisions.
- **Save incrementally.** Don't batch all entries at the end. Save insights as you discover them
  so they survive if the session is interrupted.
- **Use meaningful topics.** Good: \`authentication\`, \`database-schema\`, \`ci-cd\`.
  Bad: \`stuff\`, \`misc\`, \`notes\`.
- **Keep titles queryable.** Titles are part of the upsert key and are searched via FTS.
  Write them as short, specific identifiers (e.g., \`PostgreSQL connection pooling\` not \`DB stuff\`).
- **Use consistent workspaceId.** Always use the same value for a given project. If it changes,
  entries become unreachable.
`;
};

export function printHelp(): void {
  console.log(`mneme CLI — local memory inspection tool

Usage:
  mneme init          [--agent <name>] [--workspace <id>] [--force]
  mneme search        --workspace <id> --query <text> [--limit <n>]
  mneme context       --workspace <id> [--session <id>] [--limit <n>]
  mneme doctor
  mneme info

Init flags:
  --agent <name>        opencode | copilot
  --workspace <id>      Override detected workspace id
  --force               Overwrite existing instructions file

Environment:
  MNEME_DB_PATH          Override the SQLite database path
                          Default: platform data directory (see below)

  Platform defaults:
    Linux:   ~/.local/share/mneme/memory.sqlite
    macOS:   ~/Library/Application Support/mneme/memory.sqlite
    Windows: %LOCALAPPDATA%\\mneme\\memory.sqlite
`);
}
