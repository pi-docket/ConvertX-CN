import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { convert, properties } from "../../src/converters/babeldoc";
import type { ExecFileException } from "node:child_process";
import { type ExecFileFn } from "../../src/converters/types";
import { mkdirSync, existsSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { join, dirname, basename } from "node:path";

test.skip("dummy - required to trigger test detection", () => {});

describe("BabelDOC converter properties", () => {
  test("should expose expected formats", () => {
    expect(properties.from.document).toContain("pdf");
    expect(properties.to.document).toContain("pdf-en");
    expect(properties.to.document).toContain("md-zh");
    expect(properties.to.document).toContain("html-ja");
    expect(properties.outputMode).toBe("archive");
  });
});

describe("BabelDOC converter - config based CLI", () => {
  const testDir = "./test-output-babeldoc";
  const testInputFile = join(testDir, "input.pdf");

  beforeEach(() => {
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }
    writeFileSync(testInputFile, "%PDF-1.4\n%Test PDF content");
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  test("should invoke babeldoc with --files --output -c and no legacy secret flags", async () => {
    let babeldocArgs: string[] = [];
    let configContent = "";

    const mockExecFile: ExecFileFn = (
      cmd: string,
      args: string[],
      callback: (err: ExecFileException | null, stdout: string, stderr: string) => void,
    ) => {
      if (cmd === "pdftotext") {
        callback(
          null,
          "This is a comprehensive test PDF with more than enough text content to ensure OCR is skipped. The text length is intentionally long to exceed the scanned PDF threshold used by detection logic and keep tests deterministic.",
          "",
        );
        return;
      }

      if (cmd === "babeldoc") {
        babeldocArgs = args;

        const configIndex = args.indexOf("-c");
        const outputIndex = args.indexOf("--output");
        const filesIndex = args.indexOf("--files");

        expect(configIndex).toBeGreaterThan(-1);
        expect(outputIndex).toBeGreaterThan(-1);
        expect(filesIndex).toBeGreaterThan(-1);

        const configPath = args[configIndex + 1] as string;
        const outputDir = args[outputIndex + 1] as string;
        const inputPath = args[filesIndex + 1] as string;

        expect(existsSync(configPath)).toBe(true);
        configContent = readFileSync(configPath, "utf8");

        const inputBase = basename(inputPath, ".pdf");
        writeFileSync(join(outputDir, `${inputBase}-mono.pdf`), "%PDF-1.4\n%Translated content");

        callback(null, "Translation complete", "");
        return;
      }

      if (cmd === "tar") {
        expect(args[0]).toBe("-cf");
        callback(null, "Archive created", "");
      }
    };

    const targetPath = join(testDir, "output.tar");
    await convert(
      testInputFile,
      "pdf",
      "pdf-zh",
      targetPath,
      {
        _babeldocGetApiKey: async () => "test-api-key",
      },
      mockExecFile,
    );

    expect(babeldocArgs).toContain("--files");
    expect(babeldocArgs).toContain("--output");
    expect(babeldocArgs).toContain("-c");

    expect(babeldocArgs).not.toContain("--openai-api-key");
    expect(babeldocArgs).not.toContain("--openai-base-url");
    expect(babeldocArgs).not.toContain("--model");
    expect(babeldocArgs).not.toContain("--lang-out");

    expect(configContent).toContain("model:");
    expect(configContent).toContain("provider: openai");
    expect(configContent).toContain("model: 'tencent/Hunyuan-MT-7B'");
    expect(configContent).toContain("base_url: 'https://api.siliconflow.cn/v1'");
    expect(configContent).toContain("api_key: 'test-api-key'");
    expect(configContent).toContain("translation:");
    expect(configContent).toContain("target_lang: 'zh-cn'");
  });

  test("should map zh-TW to zh-tw in generated config", async () => {
    let configContent = "";

    const mockExecFile: ExecFileFn = (
      cmd: string,
      args: string[],
      callback: (err: ExecFileException | null, stdout: string, stderr: string) => void,
    ) => {
      if (cmd === "pdftotext") {
        callback(
          null,
          "This is a comprehensive test PDF with more than enough text content to ensure OCR is skipped. The text length is intentionally long to exceed the scanned PDF threshold used by detection logic and keep tests deterministic.",
          "",
        );
        return;
      }

      if (cmd === "babeldoc") {
        const configPath = args[args.indexOf("-c") + 1] as string;
        const outputDir = args[args.indexOf("--output") + 1] as string;
        const inputPath = args[args.indexOf("--files") + 1] as string;
        configContent = readFileSync(configPath, "utf8");

        const inputBase = basename(inputPath, ".pdf");
        writeFileSync(join(outputDir, `${inputBase}-mono.pdf`), "%PDF-1.4\n%Translated content");
        callback(null, "Translation complete", "");
        return;
      }

      if (cmd === "tar") {
        callback(null, "Archive created", "");
      }
    };

    await convert(
      testInputFile,
      "pdf",
      "pdf-zh-TW",
      join(testDir, "output-zhtw.tar"),
      {
        _babeldocGetApiKey: async () => "test-api-key",
      },
      mockExecFile,
    );

    expect(configContent).toContain("target_lang: 'zh-tw'");
  });

  test("should delete temp config file after success", async () => {
    let configPath = "";

    const mockExecFile: ExecFileFn = (
      cmd: string,
      args: string[],
      callback: (err: ExecFileException | null, stdout: string, stderr: string) => void,
    ) => {
      if (cmd === "pdftotext") {
        callback(
          null,
          "This is a comprehensive test PDF with more than enough text content to ensure OCR is skipped. The text length is intentionally long to exceed the scanned PDF threshold used by detection logic and keep tests deterministic.",
          "",
        );
        return;
      }

      if (cmd === "babeldoc") {
        configPath = args[args.indexOf("-c") + 1] as string;
        const outputDir = args[args.indexOf("--output") + 1] as string;
        const inputPath = args[args.indexOf("--files") + 1] as string;
        const inputBase = basename(inputPath, ".pdf");

        expect(existsSync(configPath)).toBe(true);
        writeFileSync(join(outputDir, `${inputBase}-mono.pdf`), "%PDF-1.4\n%Translated content");
        callback(null, "Translation complete", "");
        return;
      }

      if (cmd === "tar") {
        callback(null, "Archive created", "");
      }
    };

    await convert(
      testInputFile,
      "pdf",
      "pdf-en",
      join(testDir, "output-en.tar"),
      {
        _babeldocGetApiKey: async () => "test-api-key",
      },
      mockExecFile,
    );

    expect(configPath.length).toBeGreaterThan(0);
    expect(existsSync(configPath)).toBe(false);
  });

  test("should delete temp config file when babeldoc fails", async () => {
    let configPath = "";

    const mockExecFile: ExecFileFn = (
      cmd: string,
      args: string[],
      callback: (err: ExecFileException | null, stdout: string, stderr: string) => void,
    ) => {
      if (cmd === "pdftotext") {
        callback(
          null,
          "This is a comprehensive test PDF with more than enough text content to ensure OCR is skipped. The text length is intentionally long to exceed the scanned PDF threshold used by detection logic and keep tests deterministic.",
          "",
        );
        return;
      }

      if (cmd === "babeldoc") {
        configPath = args[args.indexOf("-c") + 1] as string;
        expect(existsSync(configPath)).toBe(true);

        const error = new Error("Translation failed") as ExecFileException;
        error.code = 1;
        callback(error, "", "translation failure");
      }
    };

    await expect(
      convert(
        testInputFile,
        "pdf",
        "pdf-ja",
        join(testDir, "output-ja.tar"),
        {
          _babeldocGetApiKey: async () => "test-api-key",
        },
        mockExecFile,
      ),
    ).rejects.toThrow("BabelDOC translation failed");

    expect(configPath.length).toBeGreaterThan(0);
    expect(existsSync(configPath)).toBe(false);
  });

  test("should ensure output directory exists before babeldoc run", async () => {
    let outputDirFromArgs = "";

    const nestedTargetPath = join(testDir, "nested", "deep", "output.tar");

    const mockExecFile: ExecFileFn = (
      cmd: string,
      args: string[],
      callback: (err: ExecFileException | null, stdout: string, stderr: string) => void,
    ) => {
      if (cmd === "pdftotext") {
        callback(
          null,
          "This is a comprehensive test PDF with more than enough text content to ensure OCR is skipped. The text length is intentionally long to exceed the scanned PDF threshold used by detection logic and keep tests deterministic.",
          "",
        );
        return;
      }

      if (cmd === "babeldoc") {
        outputDirFromArgs = args[args.indexOf("--output") + 1] as string;
        expect(existsSync(outputDirFromArgs)).toBe(true);

        const inputPath = args[args.indexOf("--files") + 1] as string;
        const inputBase = basename(inputPath, ".pdf");
        writeFileSync(join(outputDirFromArgs, `${inputBase}-mono.pdf`), "%PDF-1.4\n%Translated content");
        callback(null, "Translation complete", "");
        return;
      }

      if (cmd === "tar") {
        callback(null, "Archive created", "");
      }
    };

    await convert(
      testInputFile,
      "pdf",
      "pdf-fr",
      nestedTargetPath,
      {
        _babeldocGetApiKey: async () => "test-api-key",
      },
      mockExecFile,
    );

    expect(outputDirFromArgs.length).toBeGreaterThan(0);
    expect(outputDirFromArgs.startsWith(dirname(nestedTargetPath))).toBe(true);
  });
});
