import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { convert } from "../../src/converters/djvu";

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

test("DjVu invokes ddjvu with the selected format and verifies output", async () => {
  const dir = mkdtempSync(join(tmpdir(), "convertx-djvu-"));
  dirs.push(dir);
  const output = join(dir, "out.pdf");
  await expect(
    convert("input.djvu", "djvu", "pdf", output, undefined, (cmd, args, done) => {
      expect(cmd).toBe("ddjvu");
      expect(args).toEqual(["-format=pdf", "input.djvu", output]);
      writeFileSync(output, "%PDF-test");
      done(null, "", "");
    }),
  ).resolves.toBe("Done");
});

test("DjVu rejects a successful CLI exit that produced no PDF", async () => {
  const dir = mkdtempSync(join(tmpdir(), "convertx-djvu-"));
  dirs.push(dir);
  await expect(
    convert("input.djvu", "djvu", "pdf", join(dir, "missing.pdf"), undefined, (_cmd, _args, done) =>
      done(null, "", ""),
    ),
  ).rejects.toThrow("non-empty output");
});

test("DjVu propagates converter failures", async () => {
  await expect(
    convert("input.djvu", "djvu", "pdf", "unused.pdf", undefined, (_cmd, _args, done) =>
      done(new Error("invalid DjVu"), "", "broken input"),
    ),
  ).rejects.toThrow("broken input");
});
