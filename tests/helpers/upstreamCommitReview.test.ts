import { afterEach, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const roots: string[] = [];
const script = resolve(import.meta.dir, "../../scripts/check-upstream-commits.sh");
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "convertx-upstream-review-"));
  roots.push(root);
  const git = (...args: string[]) => {
    const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
    if (result.status !== 0) throw new Error(result.stderr);
    return result.stdout.trim();
  };
  git("init", "-b", "local");
  git("config", "user.name", "Regression Test");
  git("config", "user.email", "test@example.invalid");
  git("commit", "--allow-empty", "-m", "common ancestor");
  git("checkout", "-b", "upstream");
  git("commit", "--allow-empty", "-m", "reviewed upstream improvement");
  const reviewedCommit = git("rev-parse", "HEAD");
  git("checkout", "local");
  git("commit", "--allow-empty", "-m", "local improvements and selective port");
  const manifest = join(root, "upstream-sync.json");
  writeFileSync(manifest, JSON.stringify({ reviewedCommit }));
  const check = () =>
    spawnSync("bash", [script, "upstream", manifest], { cwd: root, encoding: "utf8" });
  return { git, manifest, check };
}

test("selective ports do not report already reviewed commits despite divergent ancestry", () => {
  const { check } = fixture();
  const result = check();
  expect(result.status).toBe(0);
  expect(result.stdout).toContain("commit_count=0\nhas_updates=false");
});

test("counts actual new upstream commits after the checkpoint", () => {
  const { git, check } = fixture();
  git("checkout", "upstream");
  git("commit", "--allow-empty", "-m", "new useful improvement");
  git("checkout", "local");
  const result = check();
  expect(result.status).toBe(0);
  expect(result.stdout).toContain("commit_count=1\nhas_updates=true");
  expect(result.stdout).toContain("new useful improvement");
  expect(result.stdout).not.toContain("reviewed upstream improvement");
});

test("rejects a rewritten upstream history instead of pretending it is synchronized", () => {
  const { git, manifest, check } = fixture();
  writeFileSync(manifest, JSON.stringify({ reviewedCommit: git("rev-parse", "local") }));
  const result = check();
  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain("manual review is required");
});

test("rejects a missing checkpoint instead of falling back to the merge base", () => {
  const { manifest, check } = fixture();
  writeFileSync(manifest, "{}");
  expect(check().status).not.toBe(0);
});
