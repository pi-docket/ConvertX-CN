import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  ALLOWED_ARCHIVE_FORMAT,
  CHUNK_SIZE_BYTES,
  CHUNK_THRESHOLD_BYTES,
  FORBIDDEN_ARCHIVE_FORMATS,
} from "../../src/transfer/constants";
import {
  createTarArchive,
  getArchiveFileName,
  validateArchiveFormat,
} from "../../src/transfer/archiveManager";
import {
  getChunk,
  getChunkDownloadInfo,
  shouldUseChunkedDownload,
} from "../../src/transfer/downloadManager";
import { getTransferMode } from "../../src/transfer/types";

const testDir = resolve("test-output-transfer");

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
});

describe("transfer policy", () => {
  test("keeps the 10MB direct threshold and 5MB chunk size", () => {
    expect(CHUNK_THRESHOLD_BYTES).toBe(10 * 1024 * 1024);
    expect(CHUNK_SIZE_BYTES).toBe(5 * 1024 * 1024);
    expect(getTransferMode(CHUNK_THRESHOLD_BYTES, CHUNK_THRESHOLD_BYTES)).toBe("direct");
    expect(getTransferMode(CHUNK_THRESHOLD_BYTES + 1, CHUNK_THRESHOLD_BYTES)).toBe("chunked");
  });

  test("only publishes tar archives", () => {
    expect(ALLOWED_ARCHIVE_FORMAT).toBe(".tar");
    expect(FORBIDDEN_ARCHIVE_FORMATS).toEqual(
      expect.arrayContaining([".tar.gz", ".tgz", ".zip", ".gz"]),
    );
    expect(validateArchiveFormat("result.tar")).toBe(true);
    expect(validateArchiveFormat("result.zip")).toBe(false);
    expect(getArchiveFileName("result.tar.gz")).toBe("result.tar");
  });
});

describe("download and archive flow", () => {
  test("reads deterministic download chunks", async () => {
    mkdirSync(testDir, { recursive: true });
    const path = join(testDir, "sample.txt");
    writeFileSync(path, "ABCDEFGHIJ");
    const info = getChunkDownloadInfo(path);
    expect(info).toMatchObject({
      file_name: "sample.txt",
      total_size: 10,
      chunk_size: CHUNK_SIZE_BYTES,
    });
    expect((await getChunk(path, 0, 5))?.toString()).toBe("ABCDE");
    expect((await getChunk(path, 1, 5))?.toString()).toBe("FGHIJ");
    expect(shouldUseChunkedDownload(path)).toBe(false);
  });

  test("creates a downloadable tar without changing its format", async () => {
    const source = join(testDir, "source");
    mkdirSync(source, { recursive: true });
    writeFileSync(join(source, "document.txt"), "converted");
    const archive = await createTarArchive(source, join(testDir, "result.tar.gz"));
    expect(archive.endsWith(".tar")).toBe(true);
    expect(existsSync(archive)).toBe(true);
    expect(statSync(archive).size).toBeGreaterThan(0);
    expect(getChunkDownloadInfo(archive)?.file_name).toBe("result.tar");
  });
});
