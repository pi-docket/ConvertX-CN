import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const standard = readFileSync("Dockerfile", "utf8");
const lite = readFileSync("Dockerfile.lite", "utf8");
const entrypoint = readFileSync("scripts/entrypoint.sh", "utf8");

describe("container runtime hardening", () => {
  test.each([
    ["standard", standard],
    ["lite", lite],
  ])("%s image installs a fixed non-root runtime", (_name, dockerfile) => {
    expect(dockerfile).toContain("--uid 10001");
    expect(dockerfile).toContain("gosu");
    expect(dockerfile).toContain("entrypoint.sh");
    expect(dockerfile).not.toContain("/app/certs/default.p12");
  });

  test.each([
    ["standard", standard],
    ["lite", lite],
  ])("%s runtime PATH includes administrative tools needed during startup", (_name, dockerfile) => {
    const runtimePath = [...dockerfile.matchAll(/^ENV PATH=(.+)$/gm)].at(-1)?.[1];
    expect(runtimePath).toBeDefined();
    const directories = runtimePath!.split(":");
    expect(directories).toContain("/usr/sbin");
    expect(directories).toContain("/usr/bin");
    expect(directories).toContain("/usr/local/bin");
  });

  test("entrypoint initializes only the data volume and then drops privileges", () => {
    expect(entrypoint).toContain('marker="$DATA_DIR/.permissions-v1"');
    expect(entrypoint).toContain('chown -R "$runtime_uid:$runtime_gid" "$DATA_DIR"');
    expect(entrypoint).toContain('exec gosu "$APP_USER"');
  });

  test("deployment certificate is persistent, protected and fingerprinted", () => {
    expect(entrypoint).toContain('CERT_DIR="$DATA_DIR/certs"');
    expect(entrypoint).toContain("PDF_SIGN_P12_PASSWORD_FILE");
    expect(entrypoint).toContain('chmod 600 "$PDF_SIGN_P12_PATH"');
    expect(entrypoint).toContain("-fingerprint -sha256");
  });
});
