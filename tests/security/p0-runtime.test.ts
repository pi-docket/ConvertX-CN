import { afterEach, describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const runtimeRoot = resolve("test-output-p0-runtime");

afterEach(() => {
  rmSync(runtimeRoot, { recursive: true, force: true });
});

function spawnImport(modulePath: string, dataDir: string) {
  return Bun.spawn({
    cmd: [process.execPath, "-e", `await import(${JSON.stringify(modulePath)})`],
    cwd: process.cwd(),
    env: { ...process.env, DATA_DIR: dataDir, JWT_SECRET: "" },
    stdout: "pipe",
    stderr: "pipe",
  });
}

describe("P0 runtime persistence and migrations", () => {
  test("rejects an invalid HTTP file-size limit during startup", async () => {
    const child = Bun.spawn({
      cmd: [process.execPath, "-e", 'await import("./src/helpers/env.ts")'],
      cwd: process.cwd(),
      env: { ...process.env, HTTP_ALLOWED_FILE_SIZE: "not-a-number" },
      stdout: "pipe",
      stderr: "pipe",
    });
    const stderr = await new Response(child.stderr).text();
    expect(await child.exited).not.toBe(0);
    expect(stderr).toContain("HTTP_ALLOWED_FILE_SIZE must be a positive integer");
  });

  test("atomically creates one reusable JWT secret under concurrent startup", async () => {
    const dataDir = resolve(runtimeRoot, "jwt");
    mkdirSync(dataDir, { recursive: true });
    const processes = Array.from({ length: 6 }, () =>
      Bun.spawn({
        cmd: [process.execPath, "tests/security/helpers/print-jwt-secret.ts"],
        cwd: process.cwd(),
        env: { ...process.env, DATA_DIR: dataDir, JWT_SECRET: "" },
        stdout: "pipe",
        stderr: "pipe",
      }),
    );
    const outputs = await Promise.all(processes.map((child) => new Response(child.stdout).text()));
    const exits = await Promise.all(processes.map((child) => child.exited));
    expect(exits).toEqual([0, 0, 0, 0, 0, 0]);

    const secretDir = resolve(dataDir, ".secrets");
    const secret = readFileSync(resolve(secretDir, "jwt-secret"), "utf8").trim();
    expect(secret.length).toBeGreaterThanOrEqual(32);
    expect(new Set(outputs.map((output) => output.trim()))).toEqual(new Set([secret]));
    expect(readdirSync(secretDir)).toEqual(["jwt-secret"]);

    const restart = spawnImport("./src/helpers/jwtSecret.ts", dataDir);
    expect(await restart.exited).toBe(0);
    expect(readFileSync(resolve(secretDir, "jwt-secret"), "utf8").trim()).toBe(secret);
  });

  test("upgrades legacy statuses in ordered schema version 4 migration", async () => {
    const dataDir = resolve(runtimeRoot, "migration");
    mkdirSync(dataDir, { recursive: true });
    const path = resolve(dataDir, "mydb.sqlite");
    const legacy = new Database(path, { create: true });
    legacy.exec(`
CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL, password TEXT NOT NULL);
CREATE TABLE jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, date_created TEXT NOT NULL,
  status TEXT DEFAULT 'not started', num_files INTEGER DEFAULT 0, error_message TEXT,
  started_at TEXT, completed_at TEXT
);
CREATE TABLE file_names (
  id INTEGER PRIMARY KEY AUTOINCREMENT, job_id INTEGER NOT NULL, file_name TEXT NOT NULL,
  output_file_name TEXT NOT NULL, status TEXT DEFAULT 'not started', error_message TEXT,
  started_at TEXT, completed_at TEXT
);
CREATE TABLE api_keys (
  id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, key_name TEXT NOT NULL,
  key_value TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  UNIQUE(user_id, key_name)
);
INSERT INTO users(email, password) VALUES ('owner@example.invalid', 'hash');
INSERT INTO jobs(user_id, date_created, status) VALUES (1, '2026-01-01', 'not started');
INSERT INTO file_names(job_id, file_name, output_file_name, status)
VALUES (1, 'input.txt', 'output.pdf', 'not started');
PRAGMA user_version = 3;`);
    legacy.close();

    const migration = spawnImport("./src/db/db.ts", dataDir);
    expect(await migration.exited).toBe(0);
    expect(existsSync(path)).toBe(true);

    const upgraded = new Database(path);
    const version = upgraded.query("PRAGMA user_version").get() as { user_version: number };
    const job = upgraded.query("SELECT status FROM jobs WHERE id = 1").get() as { status: string };
    const file = upgraded
      .query("SELECT status, error_message FROM file_names WHERE id = 1")
      .get() as { status: string; error_message: string };
    expect(version.user_version).toBe(5);
    expect(job.status).toBe("pending");
    expect(file.status).toBe("failed");
    expect(file.error_message).toContain("Legacy conversion");
    expect(() =>
      upgraded
        .query("INSERT INTO users(email, password) VALUES (?, ?)")
        .run("OWNER@example.invalid", "hash"),
    ).toThrow();
    upgraded.close();
  });

  test("archives only completed owner artifacts", async () => {
    const dataDir = resolve(runtimeRoot, "artifacts");
    mkdirSync(dataDir, { recursive: true });
    const child = Bun.spawn({
      cmd: [process.execPath, "tests/security/helpers/artifact-archive-check.ts"],
      cwd: process.cwd(),
      env: { ...process.env, DATA_DIR: dataDir, JWT_SECRET: "" },
      stdout: "pipe",
      stderr: "pipe",
    });
    const stdout = await new Response(child.stdout).text();
    const stderr = await new Response(child.stderr).text();
    expect(await child.exited).toBe(0);
    expect(stderr).toBe("");
    const result = JSON.parse(stdout.trim().split(/\r?\n/).at(-1) ?? "{}") as {
      entries: string[];
      strangerDenied: boolean;
      crossDeleteDenied: boolean;
      ownerJobStillExists: boolean;
    };
    expect(result.entries).toEqual(["good.pdf"]);
    expect(result.strangerDenied).toBe(true);
    expect(result.crossDeleteDenied).toBe(true);
    expect(result.ownerJobStillExists).toBe(true);
  });

  test("persists completed, partial and failed conversion outcomes per file", async () => {
    const dataDir = resolve(runtimeRoot, "conversion-state");
    mkdirSync(dataDir, { recursive: true });
    const child = Bun.spawn({
      cmd: [process.execPath, "tests/security/helpers/conversion-state-check.ts"],
      cwd: process.cwd(),
      env: { ...process.env, DATA_DIR: dataDir, JWT_SECRET: "" },
      stdout: "pipe",
      stderr: "pipe",
    });
    const stdout = await new Response(child.stdout).text();
    const stderr = await new Response(child.stderr).text();
    expect(await child.exited).toBe(0);
    expect(stderr).toContain("file fail.txt failed");
    expect(stderr).toContain("/private/converter/fail.txt exploded");
    const result = JSON.parse(stdout.trim().split(/\r?\n/).at(-1) ?? "{}") as {
      partial: {
        summary: { completed: number; failed: number };
        job: { status: string; started_at: string; completed_at: string };
        files: { status: string; error_message: string | null }[];
      };
      completed: { job: { status: string }; files: { status: string }[] };
      failed: { job: { status: string }; files: { status: string }[] };
    };

    expect(result.partial.summary).toMatchObject({ completed: 1, failed: 2 });
    expect(result.partial.job.status).toBe("partial");
    expect(result.partial.job.started_at).toBeTruthy();
    expect(result.partial.job.completed_at).toBeTruthy();
    expect(result.partial.files.map((file) => file.status).sort()).toEqual([
      "completed",
      "failed",
      "failed",
    ]);
    expect(
      result.partial.files
        .filter((file) => file.status === "failed")
        .every((file) => file.error_message && !file.error_message.includes("/private/")),
    ).toBe(true);
    expect(result.completed.job.status).toBe("completed");
    expect(result.completed.files.map((file) => file.status)).toEqual(["completed"]);
    expect(result.failed.job.status).toBe("failed");
    expect(result.failed.files.map((file) => file.status)).toEqual(["failed"]);
  });

  test("allows first setup but closes GET and POST registration afterward when disabled", async () => {
    const dataDir = resolve(runtimeRoot, "registration");
    mkdirSync(dataDir, { recursive: true });
    const child = Bun.spawn({
      cmd: [process.execPath, "tests/security/helpers/registration-check.ts"],
      cwd: process.cwd(),
      env: {
        ...process.env,
        ACCOUNT_REGISTRATION: "false",
        HTTP_ALLOWED: "false",
        DATA_DIR: dataDir,
        JWT_SECRET: "",
      },
      stdout: "pipe",
      stderr: "pipe",
    });
    const stdout = await new Response(child.stdout).text();
    const stderr = await new Response(child.stderr).text();
    expect(await child.exited).toBe(0);
    expect(stderr).toBe("");
    const result = JSON.parse(stdout.trim().split(/\r?\n/).at(-1) ?? "{}") as {
      initialStatus: number;
      csrfSecure: boolean;
      firstStatus: number;
      userCount: number;
      pageAfterSetupStatus: number;
      pageAfterSetupLocation: string;
      secondStatus: number;
      secondBody: string;
    };
    expect(result).toMatchObject({
      initialStatus: 200,
      csrfSecure: true,
      firstStatus: 302,
      userCount: 1,
      pageAfterSetupStatus: 302,
      pageAfterSetupLocation: "/login",
      secondStatus: 403,
    });
    expect(result.secondBody).toContain("Account registration is disabled");
  });
});
