import { afterEach, beforeAll, describe, expect, test } from "bun:test";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

const runtimeRoot = resolve(tmpdir(), `convertx-entrypoint-runtime-${process.pid}`);
const entrypoint = resolve("scripts/entrypoint.sh");
const bash = process.platform === "win32" ? "C:\\Program Files\\Git\\bin\\bash.exe" : "/bin/sh";

function shellPath(path: string): string {
  if (process.platform !== "win32") return path.replaceAll("\\", "/");
  const normalized = path.replaceAll("\\", "/");
  const match = /^([A-Za-z]):\/(.*)$/.exec(normalized);
  if (!match) throw new Error(`Cannot translate path for shell: ${path}`);
  return `/${match[1]?.toLowerCase()}/${match[2]}`;
}

async function writeExecutable(path: string, contents: string): Promise<void> {
  await Bun.write(path, contents);
  chmodSync(path, 0o755);
}

async function createFakeRuntime(root: string): Promise<string> {
  const bin = resolve(root, "bin");
  mkdirSync(bin, { recursive: true });
  await writeExecutable(
    resolve(bin, "id"),
    `#!/bin/sh
if [ "\${FAKE_NONROOT:-}" = "1" ]; then
  printf '10001\\n'
else
  printf '0\\n'
fi
`,
  );
  await writeExecutable(
    resolve(bin, "chown"),
    `#!/bin/sh
printf '%s\\n' "$*" >> "$CHOWN_CAPTURE"
`,
  );
  await writeExecutable(
    resolve(bin, "gosu"),
    `#!/bin/sh
[ "$1" = "convertx" ] || exit 90
shift
FAKE_NONROOT=1
export FAKE_NONROOT
exec "$@"
`,
  );
  await writeExecutable(resolve(bin, "python3"), "#!/bin/sh\nexit 0\n");
  await writeExecutable(
    resolve(bin, "bun"),
    `#!/bin/sh
printf '%s|%s|%s|%s|%s\\n' \
  "$(id -u)" \
  "$PDF_SIGN_SELF_SIGNED" \
  "$PDF_SIGN_P12_PATH" \
  "$PDF_SIGN_P12_PASSWORD_FILE" \
  "$PDF_SIGNING_AVAILABLE" > "$ENTRYPOINT_CAPTURE"
`,
  );
  return bin;
}

async function runEntrypoint(
  root: string,
  extraEnv: Record<string, string> = {},
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const bin = await createFakeRuntime(root);
  const data = resolve(root, "data");
  const capture = resolve(root, "runtime.txt");
  const chownCapture = resolve(root, "chown.txt");
  mkdirSync(data, { recursive: true });
  const child = Bun.spawn({
    cmd: [
      bash,
      "--noprofile",
      "--norc",
      "-c",
      'PATH="$1:$PATH"; export PATH; exec "$2"',
      "entrypoint-runtime-test",
      shellPath(bin),
      shellPath(entrypoint),
    ],
    cwd: process.cwd(),
    env: {
      ...process.env,
      DATA_DIR: shellPath(data),
      PDF_SIGN_SCRIPT_PATH: shellPath(resolve("scripts/pdf_sign.py")),
      ENTRYPOINT_CAPTURE: shellPath(capture),
      CHOWN_CAPTURE: shellPath(chownCapture),
      ...(process.platform === "win32" ? { MSYS2_ARG_CONV_EXCL: "/CN=" } : {}),
      ...extraEnv,
    },
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  return { exitCode, stdout, stderr };
}

beforeAll(() => {
  if (!existsSync(bash)) {
    throw new Error(`A POSIX shell is required to validate scripts/entrypoint.sh: ${bash}`);
  }
});

afterEach(() => {
  rmSync(runtimeRoot, { recursive: true, force: true });
});

describe("container entrypoint runtime behavior", () => {
  test("creates one persistent deployment certificate and starts as uid 10001", async () => {
    const root = resolve(runtimeRoot, "generated");
    const first = await runEntrypoint(root);
    expect(first.exitCode, JSON.stringify(first)).toBe(0);
    expect(first.stdout.toLowerCase()).toContain("sha256 fingerprint=");
    expect(first.stdout).toContain("self-signed certificate");

    const data = resolve(root, "data");
    const p12 = resolve(data, "certs", "signing.p12");
    const password = resolve(data, "certs", "signing.password");
    const certificate = resolve(data, "certs", "signing.crt");
    const marker = resolve(data, ".permissions-v1");
    expect([p12, password, certificate, marker].every(existsSync)).toBe(true);
    expect(readFileSync(resolve(root, "runtime.txt"), "utf8")).toContain("10001|true|");
    expect(readFileSync(resolve(root, "runtime.txt"), "utf8").trim()).toEndWith("|true");

    const firstP12 = readFileSync(p12);
    const firstPassword = readFileSync(password, "utf8");
    const firstModified = statSync(p12).mtimeMs;
    const second = await runEntrypoint(root);
    expect(second.exitCode).toBe(0);
    expect(readFileSync(p12)).toEqual(firstP12);
    expect(readFileSync(password, "utf8")).toBe(firstPassword);
    expect(statSync(p12).mtimeMs).toBe(firstModified);

    writeFileSync(certificate, "interrupted certificate update");
    const repaired = await runEntrypoint(root);
    expect(repaired.exitCode).toBe(0);
    expect(readFileSync(p12)).not.toEqual(firstP12);
    expect(readFileSync(certificate, "utf8")).toContain("BEGIN CERTIFICATE");
  });

  test("prefers the password file and accepts a valid custom P12", async () => {
    const root = resolve(runtimeRoot, "password-file");
    const generated = await runEntrypoint(root);
    expect(generated.exitCode, JSON.stringify(generated)).toBe(0);
    const p12 = resolve(root, "data", "certs", "signing.p12");
    const password = resolve(root, "data", "certs", "signing.password");

    const custom = await runEntrypoint(root, {
      PDF_SIGN_P12_PATH: shellPath(p12),
      PDF_SIGN_P12_PASSWORD_FILE: shellPath(password),
      PDF_SIGN_P12_PASSWORD: "intentionally-wrong",
    });
    expect(custom.exitCode).toBe(0);
    const capture = readFileSync(resolve(root, "runtime.txt"), "utf8");
    expect(capture).toContain("10001|false|");
    expect(capture.trim()).toEndWith("|true");
  });

  test("fails closed for an invalid custom P12 without generating a fallback", async () => {
    const root = resolve(runtimeRoot, "invalid-custom");
    mkdirSync(root, { recursive: true });
    const custom = resolve(root, "invalid.p12");
    writeFileSync(custom, "not a PKCS12 file");

    const result = await runEntrypoint(root, {
      PDF_SIGN_P12_PATH: shellPath(custom),
      PDF_SIGN_P12_PASSWORD: "wrong",
    });
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("certificate validation failed");
    expect(existsSync(resolve(root, "data", "certs", "signing.p12"))).toBe(false);
    expect(existsSync(resolve(root, "runtime.txt"))).toBe(false);
  });
});
