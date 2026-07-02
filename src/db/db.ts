import { mkdirSync } from "node:fs";
import { Database } from "bun:sqlite";
import { dataDirPath } from "../helpers/paths";

mkdirSync(dataDirPath, { recursive: true });
const db = new Database(`${dataDirPath}/mydb.sqlite`, { create: true });
const LATEST_SCHEMA_VERSION = 5;

function hasTable(table: string): boolean {
  return Boolean(
    db.query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(table),
  );
}

function hasColumn(table: string, column: string): boolean {
  const columns = db.query(`PRAGMA table_info(${table})`).all() as { name?: string }[];
  return columns.some((entry) => entry.name === column);
}

function ensureCaseInsensitiveEmailIndex(): void {
  const duplicate = db
    .query(
      `SELECT lower(trim(email)) AS normalized_email, COUNT(*) AS count
       FROM users
       GROUP BY lower(trim(email))
       HAVING COUNT(*) > 1
       LIMIT 1`,
    )
    .get() as { normalized_email?: string; count?: number } | null;
  if (duplicate) {
    throw new Error(
      `Database migration stopped: duplicate accounts exist for ${duplicate.normalized_email ?? "the same email"}. Resolve the duplicate users before restarting.`,
    );
  }

  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users(email COLLATE NOCASE);");
  const index = db
    .query("SELECT 1 FROM sqlite_master WHERE type = 'index' AND name = 'users_email_unique'")
    .get();
  if (!index) {
    throw new Error("Database migration failed to create users_email_unique");
  }
}

function createLatestSchema(): void {
  db.exec(`
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  password TEXT NOT NULL
);
CREATE TABLE jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  date_created TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK(status IN ('pending', 'processing', 'completed', 'partial', 'failed')),
  num_files INTEGER NOT NULL DEFAULT 0,
  error_message TEXT DEFAULT NULL,
  started_at TEXT DEFAULT NULL,
  completed_at TEXT DEFAULT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE TABLE file_names (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id INTEGER NOT NULL,
  file_name TEXT NOT NULL,
  output_file_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'processing'
    CHECK(status IN ('processing', 'completed', 'failed')),
  error_message TEXT DEFAULT NULL,
  started_at TEXT DEFAULT NULL,
  completed_at TEXT DEFAULT NULL,
  FOREIGN KEY (job_id) REFERENCES jobs(id)
);
CREATE TABLE api_keys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  key_name TEXT NOT NULL,
  key_value TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(user_id, key_name),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
PRAGMA user_version = ${LATEST_SCHEMA_VERSION};`);
}

if (!hasTable("users")) {
  db.transaction(createLatestSchema)();
} else {
  const migrations: Record<number, () => void> = {
    1: () => {
      if (!hasColumn("file_names", "status")) {
        db.exec("ALTER TABLE file_names ADD COLUMN status TEXT DEFAULT 'not started';");
      }
      if (!hasColumn("jobs", "status")) {
        db.exec("ALTER TABLE jobs ADD COLUMN status TEXT DEFAULT 'not started';");
      }
      if (!hasColumn("jobs", "num_files")) {
        db.exec("ALTER TABLE jobs ADD COLUMN num_files INTEGER DEFAULT 0;");
      }
    },
    2: () => {
      db.exec(`
CREATE TABLE IF NOT EXISTS api_keys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  key_name TEXT NOT NULL,
  key_value TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(user_id, key_name),
  FOREIGN KEY (user_id) REFERENCES users(id)
);`);
    },
    3: () => {
      for (const [table, column, definition] of [
        ["file_names", "error_message", "TEXT DEFAULT NULL"],
        ["file_names", "started_at", "TEXT DEFAULT NULL"],
        ["file_names", "completed_at", "TEXT DEFAULT NULL"],
        ["jobs", "error_message", "TEXT DEFAULT NULL"],
        ["jobs", "started_at", "TEXT DEFAULT NULL"],
        ["jobs", "completed_at", "TEXT DEFAULT NULL"],
      ] as const) {
        if (!hasColumn(table, column)) {
          db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition};`);
        }
      }
    },
    4: () => {
      db.exec(`
UPDATE jobs
SET status = CASE
  WHEN status IN ('pending', 'processing', 'completed', 'partial', 'failed') THEN status
  WHEN status IS NULL OR status = 'not started' THEN 'pending'
  ELSE 'failed'
END;
UPDATE file_names
SET status = CASE
  WHEN status IN ('processing', 'completed', 'failed') THEN status
  WHEN status IS NULL OR status = 'not started' THEN 'failed'
  ELSE 'failed'
END,
error_message = CASE
  WHEN status IS NULL OR status = 'not started'
    THEN COALESCE(error_message, 'Legacy conversion did not complete')
  ELSE error_message
END;
CREATE TRIGGER IF NOT EXISTS jobs_status_insert_guard
BEFORE INSERT ON jobs
WHEN NEW.status NOT IN ('pending', 'processing', 'completed', 'partial', 'failed')
BEGIN SELECT RAISE(ABORT, 'invalid job status'); END;
CREATE TRIGGER IF NOT EXISTS jobs_status_update_guard
BEFORE UPDATE OF status ON jobs
WHEN NEW.status NOT IN ('pending', 'processing', 'completed', 'partial', 'failed')
BEGIN SELECT RAISE(ABORT, 'invalid job status'); END;
CREATE TRIGGER IF NOT EXISTS files_status_insert_guard
BEFORE INSERT ON file_names
WHEN NEW.status NOT IN ('processing', 'completed', 'failed')
BEGIN SELECT RAISE(ABORT, 'invalid file status'); END;
CREATE TRIGGER IF NOT EXISTS files_status_update_guard
BEFORE UPDATE OF status ON file_names
WHEN NEW.status NOT IN ('processing', 'completed', 'failed')
BEGIN SELECT RAISE(ABORT, 'invalid file status'); END;`);
      ensureCaseInsensitiveEmailIndex();
    },
    5: () => {
      ensureCaseInsensitiveEmailIndex();
    },
  };

  const versionRow = db.query("PRAGMA user_version").get() as { user_version?: number } | null;
  let version = Number(versionRow?.user_version ?? 0);
  while (version < LATEST_SCHEMA_VERSION) {
    const nextVersion = version + 1;
    const migrate = migrations[nextVersion];
    if (!migrate) throw new Error(`Missing database migration ${nextVersion}`);
    db.transaction(() => {
      migrate();
      db.exec(`PRAGMA user_version = ${nextVersion};`);
    })();
    version = nextVersion;
  }
}

db.transaction(() => {
  const now = new Date().toISOString();
  db.query(
    `UPDATE file_names
     SET status = 'failed',
         error_message = COALESCE(error_message, 'Conversion interrupted by service restart'),
         completed_at = ?
     WHERE status = 'processing'
       AND job_id IN (SELECT id FROM jobs WHERE status = 'processing')`,
  ).run(now);
  db.query(
    `UPDATE jobs
     SET status = 'failed',
         error_message = COALESCE(error_message, 'Conversion interrupted by service restart'),
         completed_at = ?
     WHERE status = 'processing'`,
  ).run(now);
})();

db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA busy_timeout = 5000;");

export default db;
