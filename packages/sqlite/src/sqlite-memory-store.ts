import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
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
import { entryKindSchema, memoryScopeSchema } from "@mneme/contracts";
import type { ContextBlock, MemoryStore } from "@mneme/core";

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

type DatabaseHandle = InstanceType<typeof Database>;

export type DoctorCheck = {
  name: string;
  ok: boolean;
  message: string;
};

export type DoctorResult = {
  databasePath: string;
  ok: boolean;
  checks: DoctorCheck[];
};

type SessionRow = {
  id: string;
  workspace_id: string;
  started_at: string;
  ended_at: string | null;
  summary: string | null;
};

type PromptRow = {
  id: string;
  session_id: string;
  workspace_id: string;
  content: string;
  created_at: string;
};

type EntryRow = {
  id: string;
  session_id: string;
  workspace_id: string;
  scope: string;
  kind: string;
  topic: string;
  title: string;
  summary: string;
  body: string;
  confidence: number;
  source: string;
  revision: number;
  created_at: string;
  updated_at: string;
  last_used_at: string | null;
};

type CheckpointRow = {
  id: string;
  session_id: string;
  workspace_id: string;
  label: string;
  body: string;
  created_at: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const createId = (): string => crypto.randomUUID();
const now = (): string => new Date().toISOString();

const createCheck = (name: string, ok: boolean, message: string): DoctorCheck => ({
  name,
  ok,
  message,
});

/**
 * Sanitize a free-text query for FTS5 MATCH syntax.
 * Each token is double-quoted and ANDed together.
 */
const sanitizeFtsQuery = (query: string): string | null => {
  const tokens = query
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => t.replace(/"/g, ""))
    .filter(Boolean);

  if (tokens.length === 0) return null;

  return tokens.map((t) => `"${t}"`).join(" AND ");
};

// ---------------------------------------------------------------------------
// Row → domain mappers
// ---------------------------------------------------------------------------

const mapSessionRow = (row: SessionRow): Session => ({
  id: row.id,
  workspaceId: row.workspace_id,
  startedAt: row.started_at,
  endedAt: row.ended_at,
  summary: row.summary,
});

const mapPromptRow = (row: PromptRow): Prompt => ({
  id: row.id,
  sessionId: row.session_id,
  workspaceId: row.workspace_id,
  content: row.content,
  createdAt: row.created_at,
});

const mapEntryRow = (row: EntryRow): Entry => ({
  id: row.id,
  sessionId: row.session_id,
  workspaceId: row.workspace_id,
  scope: memoryScopeSchema.parse(row.scope),
  kind: entryKindSchema.parse(row.kind),
  topic: row.topic,
  title: row.title,
  summary: row.summary,
  body: row.body,
  confidence: row.confidence,
  source: row.source,
  revision: row.revision,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  lastUsedAt: row.last_used_at,
});

const mapCheckpointRow = (row: CheckpointRow): Checkpoint => ({
  id: row.id,
  sessionId: row.session_id,
  workspaceId: row.workspace_id,
  label: row.label,
  body: row.body,
  createdAt: row.created_at,
});

// ---------------------------------------------------------------------------
// DDL
// ---------------------------------------------------------------------------

const SCHEMA_DDL = `
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    started_at TEXT NOT NULL,
    ended_at TEXT,
    summary TEXT
  );

  CREATE TABLE IF NOT EXISTS prompts (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions(id),
    workspace_id TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS entries (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions(id),
    workspace_id TEXT NOT NULL,
    scope TEXT NOT NULL,
    kind TEXT NOT NULL,
    topic TEXT NOT NULL,
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    body TEXT NOT NULL,
    confidence REAL NOT NULL,
    source TEXT NOT NULL,
    revision INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    last_used_at TEXT
  );

  CREATE TABLE IF NOT EXISTS checkpoints (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions(id),
    workspace_id TEXT NOT NULL,
    label TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_sessions_workspace
    ON sessions(workspace_id, started_at DESC);

  CREATE INDEX IF NOT EXISTS idx_prompts_workspace_session
    ON prompts(workspace_id, session_id, created_at DESC);

  CREATE UNIQUE INDEX IF NOT EXISTS idx_entries_upsert_key
    ON entries(workspace_id, scope, kind, topic, title);

  CREATE INDEX IF NOT EXISTS idx_entries_workspace_updated
    ON entries(workspace_id, updated_at DESC);

  CREATE INDEX IF NOT EXISTS idx_checkpoints_workspace_session
    ON checkpoints(workspace_id, session_id, created_at DESC);

  CREATE VIRTUAL TABLE IF NOT EXISTS entries_fts USING fts5(
    title,
    summary,
    body,
    content='entries',
    content_rowid='rowid'
  );

  -- Keep FTS index in sync via triggers
  CREATE TRIGGER IF NOT EXISTS entries_ai AFTER INSERT ON entries BEGIN
    INSERT INTO entries_fts(rowid, title, summary, body)
    VALUES (new.rowid, new.title, new.summary, new.body);
  END;

  CREATE TRIGGER IF NOT EXISTS entries_ad AFTER DELETE ON entries BEGIN
    INSERT INTO entries_fts(entries_fts, rowid, title, summary, body)
    VALUES('delete', old.rowid, old.title, old.summary, old.body);
  END;

  CREATE TRIGGER IF NOT EXISTS entries_au AFTER UPDATE ON entries BEGIN
    INSERT INTO entries_fts(entries_fts, rowid, title, summary, body)
    VALUES('delete', old.rowid, old.title, old.summary, old.body);
    INSERT INTO entries_fts(rowid, title, summary, body)
    VALUES (new.rowid, new.title, new.summary, new.body);
  END;
`;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface SqliteMemoryStoreOptions {
  /** Path to the SQLite database file. Parent directories are created automatically. */
  databasePath: string;
}

/**
 * SQLite-backed implementation of MemoryStore using better-sqlite3 and FTS5.
 *
 * All operations are synchronous (better-sqlite3 is sync), which satisfies
 * the MemoryStore contract (methods may return T or Promise<T>).
 */
export class SqliteMemoryStore implements MemoryStore {
  private readonly db: DatabaseHandle;

  public constructor(options: SqliteMemoryStoreOptions) {
    fs.mkdirSync(path.dirname(options.databasePath), { recursive: true });
    this.db = new Database(options.databasePath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
  }

  // -- lifecycle ------------------------------------------------------------

  public init(): void {
    this.db.exec(SCHEMA_DDL);
  }

  public close(): void {
    this.db.close();
  }

  // -- sessions -------------------------------------------------------------

  public openSession(input: CreateSessionInput): Session {
    const record: Session = {
      id: createId(),
      workspaceId: input.workspaceId,
      startedAt: now(),
      endedAt: null,
      summary: input.summary ?? null,
    };

    this.db
      .prepare(
        `INSERT INTO sessions (id, workspace_id, started_at, ended_at, summary)
         VALUES (@id, @workspaceId, @startedAt, @endedAt, @summary)`,
      )
      .run(record);

    return record;
  }

  public closeSession(input: CloseSessionInput): void {
    const result = this.db
      .prepare(
        `UPDATE sessions
         SET ended_at = @endedAt, summary = COALESCE(@summary, summary)
         WHERE id = @sessionId`,
      )
      .run({
        endedAt: now(),
        summary: input.summary ?? null,
        sessionId: input.sessionId,
      });

    if (result.changes === 0) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }
  }

  // -- prompts --------------------------------------------------------------

  public savePrompt(input: SavePromptInput): Prompt {
    const record: Prompt = {
      id: createId(),
      sessionId: input.sessionId,
      workspaceId: input.workspaceId,
      content: input.content,
      createdAt: now(),
    };

    this.db
      .prepare(
        `INSERT INTO prompts (id, session_id, workspace_id, content, created_at)
         VALUES (@id, @sessionId, @workspaceId, @content, @createdAt)`,
      )
      .run(record);

    return record;
  }

  // -- entries (with upsert) ------------------------------------------------

  public saveEntry(input: SaveEntryInput): Entry {
    const timestamp = now();
    this.db
      .prepare(
        `INSERT INTO entries (
           id, session_id, workspace_id, scope, kind, topic, title, summary, body,
           confidence, source, revision, created_at, updated_at, last_used_at
         ) VALUES (
           @id, @sessionId, @workspaceId, @scope, @kind, @topic, @title, @summary, @body,
           @confidence, @source, 1, @timestamp, @timestamp, NULL
         )
         ON CONFLICT(workspace_id, scope, kind, topic, title) DO UPDATE SET
           session_id = @sessionId,
           summary = @summary,
           body = @body,
           confidence = @confidence,
           source = @source,
           revision = revision + 1,
           updated_at = @timestamp`,
      )
      .run({
        id: createId(),
        sessionId: input.sessionId,
        workspaceId: input.workspaceId,
        scope: input.scope,
        kind: input.kind,
        topic: input.topic,
        title: input.title,
        summary: input.summary,
        body: input.body,
        confidence: input.confidence,
        source: input.source,
        timestamp,
      });

    return this.getEntryByKey(
      input.workspaceId,
      input.scope,
      input.kind,
      input.topic,
      input.title,
    );
  }

  // -- checkpoints ----------------------------------------------------------

  public saveCheckpoint(input: SaveCheckpointInput): Checkpoint {
    const record: Checkpoint = {
      id: createId(),
      sessionId: input.sessionId,
      workspaceId: input.workspaceId,
      label: input.label,
      body: input.body,
      createdAt: now(),
    };

    this.db
      .prepare(
        `INSERT INTO checkpoints (id, session_id, workspace_id, label, body, created_at)
         VALUES (@id, @sessionId, @workspaceId, @label, @body, @createdAt)`,
      )
      .run(record);

    return record;
  }

  // -- search ---------------------------------------------------------------

  public searchEntries(input: SearchEntriesInput): Entry[] {
    const query = sanitizeFtsQuery(input.query);
    if (!query) return [];

    const clauses = [
      "entries_fts MATCH @query",
      "entries.workspace_id = @workspaceId",
    ];
    const params: Record<string, string | number> = {
      query,
      workspaceId: input.workspaceId,
      limit: input.limit,
    };

    if (input.scope) {
      clauses.push("entries.scope = @scope");
      params["scope"] = input.scope;
    }

    if (input.kind) {
      clauses.push("entries.kind = @kind");
      params["kind"] = input.kind;
    }

    if (input.topic) {
      clauses.push("entries.topic = @topic");
      params["topic"] = input.topic;
    }

    const rows = this.db
      .prepare(
        `SELECT
           entries.id,
           entries.session_id,
           entries.workspace_id,
           entries.scope,
           entries.kind,
           entries.topic,
           entries.title,
           entries.summary,
           entries.body,
           entries.confidence,
           entries.source,
           entries.revision,
           entries.created_at,
           entries.updated_at,
           entries.last_used_at
         FROM entries_fts
         JOIN entries ON entries.rowid = entries_fts.rowid
         WHERE ${clauses.join(" AND ")}
         ORDER BY bm25(entries_fts), entries.updated_at DESC
         LIMIT @limit`,
      )
      .all(params) as EntryRow[];

    const mapped = rows.map(mapEntryRow);
    if (mapped.length > 0) {
      const timestamp = now();
      this.touchEntries(
        mapped.map((r) => r.id),
        timestamp,
      );
      for (const entry of mapped) {
        entry.lastUsedAt = timestamp;
      }
    }

    return mapped;
  }

  // -- context --------------------------------------------------------------

  public getRecentContext(input: GetContextInput): ContextBlock {
    const sessionRow = input.sessionId
      ? (this.db
          .prepare(
            `SELECT id, workspace_id, started_at, ended_at, summary
             FROM sessions WHERE id = ? AND workspace_id = ?`,
          )
          .get(input.sessionId, input.workspaceId) as SessionRow | undefined)
      : (this.db
          .prepare(
             `SELECT id, workspace_id, started_at, ended_at, summary
              FROM sessions
              WHERE workspace_id = ?
              ORDER BY started_at DESC, rowid DESC
              LIMIT 1`,
          )
          .get(input.workspaceId) as SessionRow | undefined);

    const prompts = this.db
      .prepare(
        `SELECT id, session_id, workspace_id, content, created_at
         FROM prompts
         WHERE workspace_id = @workspaceId
           AND (@sessionId IS NULL OR session_id = @sessionId)
         ORDER BY created_at DESC
         LIMIT @limit`,
      )
      .all({
        workspaceId: input.workspaceId,
        sessionId: input.sessionId ?? null,
        limit: input.limit,
      }) as PromptRow[];

    const entries = this.db
      .prepare(
        `SELECT id, session_id, workspace_id, scope, kind, topic, title, summary, body,
                confidence, source, revision, created_at, updated_at, last_used_at
         FROM entries
         WHERE workspace_id = @workspaceId
           AND (@sessionId IS NULL OR session_id = @sessionId)
         ORDER BY updated_at DESC
         LIMIT @limit`,
      )
      .all({
        workspaceId: input.workspaceId,
        sessionId: input.sessionId ?? null,
        limit: input.limit,
      }) as EntryRow[];

    const checkpoints = this.db
      .prepare(
        `SELECT id, session_id, workspace_id, label, body, created_at
         FROM checkpoints
         WHERE workspace_id = @workspaceId
           AND (@sessionId IS NULL OR session_id = @sessionId)
         ORDER BY created_at DESC
         LIMIT @limit`,
      )
      .all({
        workspaceId: input.workspaceId,
        sessionId: input.sessionId ?? null,
        limit: input.limit,
      }) as CheckpointRow[];

    const mappedEntries = entries.map(mapEntryRow);
    if (mappedEntries.length > 0) {
      const timestamp = now();
      this.touchEntries(
        mappedEntries.map((e) => e.id),
        timestamp,
      );
      for (const entry of mappedEntries) {
        entry.lastUsedAt = timestamp;
      }
    }

    return {
      session: sessionRow ? mapSessionRow(sessionRow) : undefined,
      prompts: prompts.map(mapPromptRow),
      entries: mappedEntries,
      checkpoints: checkpoints.map(mapCheckpointRow),
    };
  }

  // -- internal helpers -----------------------------------------------------

  private getEntryByKey(
    workspaceId: string,
    scope: Entry["scope"],
    kind: Entry["kind"],
    topic: string,
    title: string,
  ): Entry {
    const row = this.db
      .prepare(
        `SELECT
          id,
          session_id,
          workspace_id,
          scope,
          kind,
          topic,
          title,
          summary,
          body,
          confidence,
          source,
          revision,
          created_at,
          updated_at,
          last_used_at
         FROM entries
         WHERE workspace_id = ?
           AND scope = ?
           AND kind = ?
           AND topic = ?
           AND title = ?
         ORDER BY updated_at DESC
         LIMIT 1`,
      )
      .get(workspaceId, scope, kind, topic, title) as EntryRow;
    return mapEntryRow(row);
  }

  private touchEntries(ids: string[], timestamp: string = now()): void {
    const stmt = this.db.prepare(
      `UPDATE entries SET last_used_at = ? WHERE id = ?`,
    );
    const touch = this.db.transaction((entryIds: string[]) => {
      for (const id of entryIds) {
        stmt.run(timestamp, id);
      }
    });
    touch(ids);
  }
}

// ---------------------------------------------------------------------------
// Doctor
// ---------------------------------------------------------------------------

export const doctorDatabase = (databasePath: string): DoctorResult => {
  const checks: DoctorCheck[] = [];
  const parentDir = path.dirname(databasePath);
  let dbExists = false;
  let dbIsFile = false;

  try {
    if (fs.existsSync(databasePath)) {
      dbExists = true;
      const stats = fs.statSync(databasePath);
      dbIsFile = stats.isFile();
      if (!dbIsFile) {
        checks.push(createCheck(
          "database path",
          false,
          "Path exists but is not a file",
        ));
      }
    }
  } catch (error) {
    checks.push(createCheck(
      "database path",
      false,
      `Unable to stat database path: ${(error as Error).message}`,
    ));
  }

  try {
    if (!fs.existsSync(parentDir)) {
      checks.push(createCheck(
        "database path",
        false,
        "Parent directory does not exist",
      ));
    } else {
      const parentStats = fs.statSync(parentDir);
      if (!parentStats.isDirectory()) {
        checks.push(createCheck(
          "database path",
          false,
          "Parent path is not a directory",
        ));
      } else if (!dbExists) {
        checks.push(createCheck(
          "database path",
          true,
          "Database file does not exist; it will be created on first write",
        ));
      } else if (dbIsFile) {
        checks.push(createCheck("database path", true, "Database file found"));
      }
    }
  } catch (error) {
    checks.push(createCheck(
      "database path",
      false,
      `Unable to inspect parent directory: ${(error as Error).message}`,
    ));
  }

  if (dbExists && dbIsFile) {
    try {
      fs.accessSync(databasePath, fs.constants.R_OK);
      checks.push(createCheck("read access", true, "Readable"));
    } catch (error) {
      checks.push(createCheck(
        "read access",
        false,
        `Not readable: ${(error as Error).message}`,
      ));
    }
  } else {
    checks.push(createCheck("read access", true, "Skipped (database missing)"));
  }

  if (dbExists && dbIsFile) {
    try {
      fs.accessSync(databasePath, fs.constants.W_OK);
      checks.push(createCheck("write access", true, "Writable"));
    } catch (error) {
      checks.push(createCheck(
        "write access",
        false,
        `Not writable: ${(error as Error).message}`,
      ));
    }
  } else {
    try {
      fs.accessSync(parentDir, fs.constants.W_OK);
      checks.push(createCheck(
        "write access",
        true,
        "Parent directory is writable (database can be created)",
      ));
    } catch (error) {
      checks.push(createCheck(
        "write access",
        false,
        `Parent directory not writable: ${(error as Error).message}`,
      ));
    }
  }

  if (dbExists && dbIsFile) {
    let db: DatabaseHandle | undefined;
    try {
      db = new Database(databasePath, { readonly: true, fileMustExist: true });
      const journalMode = db.pragma("journal_mode", { simple: true }) as string;
      const isWal = journalMode.toLowerCase() === "wal";
      checks.push(createCheck(
        "wal mode",
        isWal,
        isWal
          ? "journal_mode is WAL"
          : `journal_mode is ${journalMode} (will be set to WAL on write)`,
      ));

      const ftsRow = db
        .prepare(
          "SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name = 'entries_fts'",
        )
        .get() as { name: string; sql: string } | undefined;

      const ftsOk = Boolean(ftsRow?.sql?.toLowerCase().includes("virtual table"))
        && Boolean(ftsRow?.sql?.toLowerCase().includes("fts5"));

      if (!ftsRow) {
        checks.push(createCheck("fts tables", false, "entries_fts table missing"));
      } else if (!ftsOk) {
        checks.push(createCheck(
          "fts tables",
          false,
          "entries_fts is not an FTS5 virtual table",
        ));
      } else {
        const triggerRows = db
          .prepare(
            "SELECT name FROM sqlite_master WHERE type = 'trigger' AND name IN ('entries_ai', 'entries_ad', 'entries_au')",
          )
          .all() as { name: string }[];
        const triggerNames = new Set(triggerRows.map((row) => row.name));
        const missingTriggers = ["entries_ai", "entries_ad", "entries_au"].filter(
          (name) => !triggerNames.has(name),
        );
        if (missingTriggers.length > 0) {
          checks.push(createCheck(
            "fts tables",
            false,
            `Missing triggers: ${missingTriggers.join(", ")}`,
          ));
        } else {
          checks.push(createCheck("fts tables", true, "FTS tables and triggers present"));
        }
      }
    } catch (error) {
      checks.push(createCheck(
        "wal mode",
        false,
        `Unable to read WAL mode: ${(error as Error).message}`,
      ));
      checks.push(createCheck(
        "fts tables",
        false,
        `Unable to inspect FTS tables: ${(error as Error).message}`,
      ));
    } finally {
      if (db) {
        db.close();
      }
    }
  } else {
    checks.push(createCheck("wal mode", true, "Skipped (database missing)"));
    checks.push(createCheck("fts tables", true, "Skipped (database missing)"));
  }

  const ok = checks.every((check) => check.ok);
  return { databasePath, ok, checks };
};
