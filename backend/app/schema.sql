PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS workspace (
  workspace_hash TEXT PRIMARY KEY,
  path           TEXT NOT NULL,
  display_name   TEXT NOT NULL,
  source         TEXT NOT NULL DEFAULT 'seed'
);

CREATE TABLE IF NOT EXISTS conversation (
  conversation_id TEXT PRIMARY KEY,
  workspace_hash  TEXT NOT NULL REFERENCES workspace(workspace_hash),
  title           TEXT,
  started_at_ms   INTEGER,
  ended_at_ms     INTEGER,
  request_count   INTEGER NOT NULL DEFAULT 0,
  message_count   INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS request (
  request_id            TEXT PRIMARY KEY,
  conversation_id       TEXT NOT NULL REFERENCES conversation(conversation_id) ON DELETE CASCADE,
  state                 TEXT NOT NULL,
  started_at_ms         INTEGER NOT NULL,
  model_id              TEXT,
  model_name            TEXT,
  input_tokens          INTEGER NOT NULL,
  output_tokens         INTEGER NOT NULL,
  total_tokens          INTEGER NOT NULL,
  cache_tokens          INTEGER NOT NULL,
  cached_write_tokens   INTEGER NOT NULL,
  cached_miss_tokens    INTEGER NOT NULL,
  last_tokens           INTEGER NOT NULL,
  credit                REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS message_stat (
  request_id                TEXT PRIMARY KEY REFERENCES request(request_id) ON DELETE CASCADE,
  message_id                TEXT NOT NULL,
  stat_input_tokens         INTEGER,
  stat_output_tokens        INTEGER,
  stat_cached_input_tokens  INTEGER,
  thinking_tokens           INTEGER,
  elapsed_ms                INTEGER,
  last_output_tokens        INTEGER,
  agent_message_count       INTEGER,
  credit                    REAL
);

CREATE TABLE IF NOT EXISTS scan_file (
  path            TEXT PRIMARY KEY,
  kind            TEXT NOT NULL,
  conversation_id TEXT,
  mtime_ns        INTEGER NOT NULL,
  size            INTEGER NOT NULL,
  parsed_at_ms    INTEGER,
  status          TEXT NOT NULL DEFAULT 'ok'
);

CREATE TABLE IF NOT EXISTS sync_meta (
  key   TEXT PRIMARY KEY,
  value TEXT
);

CREATE INDEX IF NOT EXISTS idx_req_started  ON request(started_at_ms);
CREATE INDEX IF NOT EXISTS idx_req_conv     ON request(conversation_id);
CREATE INDEX IF NOT EXISTS idx_req_model    ON request(model_id);
CREATE INDEX IF NOT EXISTS idx_conv_ws      ON conversation(workspace_hash);
CREATE INDEX IF NOT EXISTS idx_conv_started ON conversation(started_at_ms);
