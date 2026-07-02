import {
  chmodSync,
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";
import { randomBytes } from "node:crypto";
import { JWT_SECRET_FILE } from "./env";

const MINIMUM_SECRET_LENGTH = 32;
const LOCK_WAIT_MS = 10;
const LOCK_TIMEOUT_MS = 5_000;
const STALE_LOCK_MS = 30_000;

function validate(secret: string, source: string): string {
  const value = secret.trim();
  if (value.length < MINIMUM_SECRET_LENGTH) {
    throw new Error(`${source} must contain at least ${MINIMUM_SECRET_LENGTH} characters`);
  }
  return value;
}

export function resolveJwtSecret(): string {
  if (process.env.JWT_SECRET) {
    return validate(process.env.JWT_SECRET, "JWT_SECRET");
  }

  mkdirSync(dirname(JWT_SECRET_FILE), { recursive: true, mode: 0o700 });
  if (existsSync(JWT_SECRET_FILE)) {
    chmodSync(JWT_SECRET_FILE, 0o600);
    return validate(readFileSync(JWT_SECRET_FILE, "utf8"), "JWT secret file");
  }

  const lockPath = `${JWT_SECRET_FILE}.lock`;
  const waitBuffer = new Int32Array(new SharedArrayBuffer(4));
  const deadline = Date.now() + LOCK_TIMEOUT_MS;
  let ownsLock = false;

  while (!ownsLock && !existsSync(JWT_SECRET_FILE)) {
    try {
      const lockFd = openSync(lockPath, "wx", 0o600);
      try {
        writeFileSync(lockFd, String(process.pid), { encoding: "utf8" });
      } finally {
        closeSync(lockFd);
      }
      ownsLock = true;
    } catch (error) {
      const code = error instanceof Error && "code" in error ? error.code : undefined;
      if (code !== "EEXIST") throw error;
      try {
        if (Date.now() - statSync(lockPath).mtimeMs > STALE_LOCK_MS) {
          rmSync(lockPath, { force: true });
          continue;
        }
      } catch {
        continue;
      }
      if (Date.now() >= deadline) {
        throw new Error(`Timed out waiting for JWT secret lock: ${lockPath}`);
      }
      Atomics.wait(waitBuffer, 0, 0, LOCK_WAIT_MS);
    }
  }

  if (!ownsLock) {
    chmodSync(JWT_SECRET_FILE, 0o600);
    return validate(readFileSync(JWT_SECRET_FILE, "utf8"), "JWT secret file");
  }

  const temporaryPath = `${JWT_SECRET_FILE}.${process.pid}.${randomBytes(8).toString("hex")}.tmp`;
  try {
    const fd = openSync(temporaryPath, "wx", 0o600);
    try {
      writeFileSync(fd, randomBytes(48).toString("base64"), { encoding: "utf8" });
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    renameSync(temporaryPath, JWT_SECRET_FILE);
  } finally {
    rmSync(temporaryPath, { force: true });
    rmSync(lockPath, { force: true });
  }

  chmodSync(JWT_SECRET_FILE, 0o600);
  return validate(readFileSync(JWT_SECRET_FILE, "utf8"), "JWT secret file");
}

export const JWT_SECRET = resolveJwtSecret();
