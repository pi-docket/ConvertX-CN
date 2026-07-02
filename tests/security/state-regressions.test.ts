import { afterEach, describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const runtimeRoot = resolve("test-output-state-regressions");

afterEach(() => {
  rmSync(runtimeRoot, { recursive: true, force: true });
});

function spawnImport(dataDir: string) {
  return Bun.spawn({
    cmd: [process.execPath, "-e", "await import('./src/db/db.ts')"],
    cwd: process.cwd(),
    env: { ...process.env, DATA_DIR: dataDir },
    stdout: "pipe",
    stderr: "pipe",
  });
}

describe("job state regressions", () => {
  test("a duplicate submission cannot fail the already-running job", async () => {
    const dataDir = resolve(runtimeRoot, "concurrent");
    const child = Bun.spawn({
      cmd: [process.execPath, "tests/security/helpers/concurrent-submit-check.ts"],
      cwd: process.cwd(),
      env: { ...process.env, DATA_DIR: dataDir },
      stdout: "pipe",
      stderr: "pipe",
    });
    const stdout = await new Response(child.stdout).text();
    const stderr = await new Response(child.stderr).text();
    expect(await child.exited).toBe(0);
    expect(stderr).not.toContain("error:");
    const result = JSON.parse(stdout.trim().split("\n").at(-1) ?? "{}");
    expect(result).toEqual({
      duplicateCode: "INVALID_TRANSITION",
      statusDuringFirst: "processing",
      finalStatus: "completed",
      artifactReadWorks: true,
      createScopeUploadWorks: true,
      readScopeDeleteDenied: true,
      collisionOutputs: ["same-2.pdf", "same.pdf"],
    });
  });

  test("startup marks orphaned processing jobs and files as failed", async () => {
    const dataDir = resolve(runtimeRoot, "recovery");
    mkdirSync(dataDir, { recursive: true });
    const initial = spawnImport(dataDir);
    expect(await initial.exited).toBe(0);

    const database = new Database(resolve(dataDir, "mydb.sqlite"));
    database.exec(`
      INSERT INTO users(email, password) VALUES ('owner@example.invalid', 'hash');
      INSERT INTO jobs(user_id, date_created, status, num_files, started_at)
      VALUES (1, '2026-01-01', 'processing', 1, '2026-01-01');
      INSERT INTO file_names(job_id, file_name, output_file_name, status, started_at)
      VALUES (1, 'source.txt', 'source.pdf', 'processing', '2026-01-01');
    `);
    database.close();

    const recovery = spawnImport(dataDir);
    expect(await recovery.exited).toBe(0);
    const recovered = new Database(resolve(dataDir, "mydb.sqlite"));
    const job = recovered.query("SELECT status, error_message FROM jobs WHERE id = 1").get() as {
      status: string;
      error_message: string;
    };
    const file = recovered
      .query("SELECT status, error_message FROM file_names WHERE id = 1")
      .get() as { status: string; error_message: string };
    recovered.close();
    expect(job.status).toBe("failed");
    expect(file.status).toBe("failed");
    expect(job.error_message).toContain("service restart");
    expect(file.error_message).toContain("service restart");
  });

  test("migration refuses to claim success when duplicate emails prevent the unique index", async () => {
    const dataDir = resolve(runtimeRoot, "duplicate-email");
    mkdirSync(dataDir, { recursive: true });
    const database = new Database(resolve(dataDir, "mydb.sqlite"), { create: true });
    database.exec(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL,
        password TEXT NOT NULL
      );
      CREATE TABLE jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        date_created TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        num_files INTEGER NOT NULL DEFAULT 0,
        error_message TEXT,
        started_at TEXT,
        completed_at TEXT
      );
      CREATE TABLE file_names (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        job_id INTEGER NOT NULL,
        file_name TEXT NOT NULL,
        output_file_name TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'processing',
        error_message TEXT,
        started_at TEXT,
        completed_at TEXT
      );
      CREATE TABLE api_keys (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        key_name TEXT NOT NULL,
        key_value TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      INSERT INTO users(email, password) VALUES
        ('Owner@example.invalid', 'a'),
        ('owner@example.invalid', 'b');
      PRAGMA user_version = 4;
    `);
    database.close();

    const migration = spawnImport(dataDir);
    const stderr = await new Response(migration.stderr).text();
    expect(await migration.exited).not.toBe(0);
    expect(stderr).toContain("duplicate accounts");

    const unchanged = new Database(resolve(dataDir, "mydb.sqlite"));
    const version = unchanged.query("PRAGMA user_version").get() as { user_version: number };
    const index = unchanged
      .query("SELECT 1 FROM sqlite_master WHERE type='index' AND name='users_email_unique'")
      .get();
    unchanged.close();
    expect(version.user_version).toBe(4);
    expect(index).toBeNull();
  });
});
