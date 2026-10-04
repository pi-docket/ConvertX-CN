import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const standard = readFileSync("Dockerfile", "utf8");
const lite = readFileSync("Dockerfile.lite", "utf8");
const entrypoint = readFileSync("scripts/entrypoint.sh", "utf8");
const ffmpegInstallation = standard.split("ARG FFMPEG_VERSION=")[1]?.split("\n\n# 4.9")[0];

function runFfmpegInstallation(architecture: string, aptFails = false, executableFails = false) {
  if (!ffmpegInstallation) throw new Error("FFmpeg Docker installation block not found");
  const command = ffmpegInstallation
    .slice(ffmpegInstallation.indexOf("RUN ") + 4)
    .replaceAll("apt-get", "mock_apt_get");
  return Bun.spawnSync([
    "/bin/sh",
    "-c",
    `uname() { echo '${architecture}'; }
     mock_apt_get() { echo "APT $*"; case "$*" in *' ffmpeg') return ${aptFails ? 1 : 0};; esac; }
     rm() { :; }
     curl() { return 28; }
     ffmpeg() { echo 'ffmpeg version test'; return ${executableFails ? 1 : 0}; }
     ffprobe() { echo 'ffprobe version test'; }
     ${command}`,
  ]);
}

describe("container runtime hardening", () => {
  test.each(["x86_64", "aarch64"])(
    "%s uses Debian FFmpeg when the static download times out",
    (architecture) => {
      const result = runFfmpegInstallation(architecture);
      expect(result.exitCode, result.stderr.toString()).toBe(0);
      expect(result.stdout.toString()).toContain("APT install -y --no-install-recommends ffmpeg");
      expect(result.stdout.toString()).toContain("ffprobe version test");
    },
  );

  test("failed Debian fallback fails the build", () => {
    const result = runFfmpegInstallation("x86_64", true);
    expect(result.exitCode).not.toBe(0);
    expect(result.stdout.toString()).not.toContain("安裝完成");
  });

  test("a present but broken FFmpeg executable fails the build", () => {
    const result = runFfmpegInstallation("x86_64", false, true);
    expect(result.exitCode).not.toBe(0);
    expect(result.stdout.toString()).not.toContain("安裝完成");
  });

  test("LibreOffice download failures stop the build instead of running dependency repair", () => {
    const installation = standard.match(/RUN set -ex[^]*?(?=\n\n# 4\.12)/)?.[0];
    const libreOffice = installation?.slice(installation.lastIndexOf("RUN set -ex"));
    expect(libreOffice).toBeDefined();
    const result = Bun.spawnSync([
      "/bin/sh",
      "-c",
      `mock_apt_get() { echo "APT $*"; }
       rm() { :; }
       curl() { return 22; }
       ${libreOffice!.replace(/^RUN /, "").replaceAll("apt-get", "mock_apt_get")}`,
    ]);
    expect(result.exitCode, result.stderr.toString()).toBe(22);
    expect(result.stdout.toString()).not.toContain("APT -f install");
    expect(result.stdout.toString()).not.toContain("安裝完成");
  });

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
