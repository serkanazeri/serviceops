PRAGMA foreign_keys = ON;
CREATE TABLE sessions (id TEXT PRIMARY KEY, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL);
CREATE TABLE runs (
 id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(id), scenario_id TEXT NOT NULL, title TEXT NOT NULL,
 status TEXT NOT NULL, mode TEXT NOT NULL, source TEXT NOT NULL, case_json TEXT NOT NULL, plan_json TEXT,
 plan_version INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, finished_at INTEGER,
 approval_started_at INTEGER, wait_ms INTEGER NOT NULL DEFAULT 0, verified INTEGER, error_code TEXT, model TEXT NOT NULL, prompt_version TEXT NOT NULL
);
CREATE INDEX runs_session_time ON runs(session_id, created_at DESC);
CREATE INDEX runs_status_time ON runs(status, updated_at);
CREATE TABLE events (id TEXT PRIMARY KEY, run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE, kind TEXT NOT NULL, label TEXT NOT NULL, detail_json TEXT NOT NULL DEFAULT '{}', created_at INTEGER NOT NULL, duration_ms INTEGER);
CREATE INDEX events_run ON events(run_id, created_at);
CREATE TABLE model_calls (id TEXT PRIMARY KEY, run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE, status TEXT NOT NULL, provider TEXT, generation_id TEXT, input_tokens INTEGER, output_tokens INTEGER, cost REAL, duration_ms INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, error_code TEXT);
CREATE INDEX calls_run ON model_calls(run_id);
CREATE TABLE approvals (id TEXT PRIMARY KEY, run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE, plan_version INTEGER NOT NULL, decision TEXT NOT NULL, option_id TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL, UNIQUE(run_id, plan_version));
CREATE TABLE reservations (id TEXT PRIMARY KEY, run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE, option_id TEXT NOT NULL, before_json TEXT NOT NULL, after_json TEXT NOT NULL, verified INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, UNIQUE(run_id));
CREATE TABLE web_vitals (id TEXT PRIMARY KEY, session_id TEXT NOT NULL, name TEXT NOT NULL, value REAL NOT NULL, created_at INTEGER NOT NULL);
CREATE INDEX vitals_session_time ON web_vitals(session_id, created_at);
