import { afterEach, beforeEach, test, expect } from "bun:test";
import { convert } from "../../src/converters/inkscape";
import type { ExecFileException } from "node:child_process";
import { ExecFileFn } from "../../src/converters/types";

import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let testDir: string;
let inputPath: string;
let outputPath: string;
beforeEach(() => {
  testDir = mkdtempSync(join(tmpdir(), "convertx-inkscape-test-"));
  inputPath = join(testDir, "input.svg");
  outputPath = join(testDir, "output.png");
  writeFileSync(inputPath, '<svg xmlns="http://www.w3.org/2000/svg"/>');
});
afterEach(() => rmSync(testDir, { recursive: true, force: true }));

// Inkscape 測試
// 使用 xvfb-run 包裝 Inkscape 命令，確保在無 DISPLAY 環境下也能運作
// xvfb-run -a --server-args="-screen 0 1024x768x24" inkscape input.svg --export-type=png --export-filename=output.png

test("convert uses correct xvfb-run wrapped arguments", async () => {
  let capturedCmd = "";
  let capturedArgs: string[] = [];

  const mockExecFile: ExecFileFn = (
    cmd: string,
    args: string[],
    callback: (err: ExecFileException | null, stdout: string, stderr: string) => void,
  ) => {
    capturedCmd = cmd;
    capturedArgs = args;
    writeFileSync(outputPath, "PNG output");
    callback(null, "Conversion complete", "");
  };

  await convert(inputPath, "svg", "png", outputPath, undefined, mockExecFile);

  expect(capturedCmd).toBe("xvfb-run");
  expect(capturedArgs).toEqual([
    "-a",
    "--server-args=-screen 0 1024x768x24",
    "inkscape",
    inputPath,
    "--export-type=png",
    `--export-filename=${outputPath}`,
  ]);
});

test("convert resolves when inkscape succeeds", async () => {
  const mockExecFile: ExecFileFn = (
    cmd: string,
    _args: string[],
    callback: (err: ExecFileException | null, stdout: string, stderr: string) => void,
  ) => {
    if (cmd === "xvfb-run") {
      writeFileSync(outputPath, "PNG output");
      callback(null, "Conversion complete", "");
    }
  };

  const result = await convert(inputPath, "svg", "png", outputPath, undefined, mockExecFile);
  expect(result).toBe("Done");
});

test("convert rejects when inkscape fails", async () => {
  const mockExecFile: ExecFileFn = (
    cmd: string,
    _args: string[],
    callback: (err: ExecFileException | null, stdout: string, stderr: string) => void,
  ) => {
    if (cmd === "xvfb-run") {
      callback(new Error("inkscape failed"), "", "");
    }
  };

  await expect(
    convert(inputPath, "svg", "png", outputPath, undefined, mockExecFile),
  ).rejects.toMatch(/error:/);
});

test("convert logs stdout when present", async () => {
  const originalConsoleLog = console.log;
  let loggedMessage = "";
  console.log = (msg: string) => {
    if (msg.startsWith("stdout:")) {
      loggedMessage = msg;
    }
  };

  const mockExecFile: ExecFileFn = (
    cmd: string,
    _args: string[],
    callback: (err: ExecFileException | null, stdout: string, stderr: string) => void,
  ) => {
    if (cmd === "xvfb-run") {
      writeFileSync(outputPath, "PNG output");
      callback(null, "Fake stdout", "");
    }
  };

  await convert(inputPath, "svg", "png", outputPath, undefined, mockExecFile);
  console.log = originalConsoleLog;

  expect(loggedMessage).toBe("stdout: Fake stdout");
});

test("convert logs stderr when present (non-fatal warning)", async () => {
  const originalConsoleLog = console.log;
  let loggedMessage = "";
  console.log = (msg: string) => {
    if (msg.startsWith("stderr:")) {
      loggedMessage = msg;
    }
  };

  const mockExecFile: ExecFileFn = (
    cmd: string,
    _args: string[],
    callback: (err: ExecFileException | null, stdout: string, stderr: string) => void,
  ) => {
    if (cmd === "xvfb-run") {
      // Inkscape 經常輸出警告到 stderr，但轉換仍成功
      writeFileSync(outputPath, "PNG output");
      callback(null, "", "Some warning message");
    }
  };

  await convert(inputPath, "svg", "png", outputPath, undefined, mockExecFile);
  console.log = originalConsoleLog;

  expect(loggedMessage).toBe("stderr: Some warning message");
});

test.skip("dummy - required to trigger test detection", () => {});

test("rejects missing input even when a stale output exists", async () => {
  rmSync(inputPath);
  writeFileSync(outputPath, "stale output");
  let invoked = false;
  const mockExecFile: ExecFileFn = () => {
    invoked = true;
  };
  await expect(
    convert(inputPath, "svg", "png", outputPath, undefined, mockExecFile),
  ).rejects.toMatch(/error:/);
  expect(invoked).toBe(false);
});

for (const outputKind of ["missing", "empty", "directory"] as const) {
  test(`rejects zero-exit conversion with ${outputKind} output`, async () => {
    const mockExecFile: ExecFileFn = (_cmd, _args, callback) => {
      if (outputKind === "empty") writeFileSync(outputPath, "");
      if (outputKind === "directory") mkdirSync(outputPath);
      callback(null, "", "");
    };
    await expect(
      convert(inputPath, "svg", "png", outputPath, undefined, mockExecFile),
    ).rejects.toMatch(/error:/);
  });
}
