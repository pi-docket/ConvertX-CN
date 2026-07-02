import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Actor } from "../../src/application/actor";
import { UploadService, UploadServiceError } from "../../src/application/uploadService";
import { CHUNK_SIZE_BYTES, CHUNK_THRESHOLD_BYTES } from "../../src/transfer/constants";

const testRoot = resolve("test-output-upload-service");
const owner: Actor = { userId: "owner", scopes: new Set(["*"]) };
const stranger: Actor = { userId: "stranger", scopes: new Set(["*"]) };
let service: UploadService;

beforeEach(() => {
  rmSync(testRoot, { recursive: true, force: true });
  mkdirSync(testRoot, { recursive: true });
  service = new UploadService({
    uploadRoot(actor, jobId) {
      if (actor.userId !== owner.userId || jobId !== "job-1") {
        throw new Error("Job not found");
      }
      return testRoot;
    },
  });
});

afterEach(() => {
  service.sessions.destroy();
  rmSync(testRoot, { recursive: true, force: true });
});

describe("UploadService session binding", () => {
  test("requires a server session for direct upload and consumes it once", async () => {
    const session = service.initialize(owner, "job-1", "report.txt", 5);
    expect(session.mode).toBe("direct");
    expect(session.upload_id).toMatch(/^[0-9a-f-]{36}$/i);

    await expect(
      service.direct(owner, "job-1", crypto.randomUUID(), new File(["hello"], "report.txt")),
    ).rejects.toMatchObject({ code: "UPLOAD_NOT_FOUND", status: 404 });

    await expect(
      service.direct(owner, "job-1", session.upload_id, new File(["hello"], "report.txt")),
    ).resolves.toMatchObject({ success: true });
    expect(existsSync(resolve(testRoot, "report.txt"))).toBe(true);

    await expect(
      service.direct(owner, "job-1", session.upload_id, new File(["hello"], "report.txt")),
    ).rejects.toMatchObject({ code: "UPLOAD_NOT_FOUND", status: 404 });
  });

  test("binds direct metadata and upload ownership", async () => {
    const session = service.initialize(owner, "job-1", "report.txt", 5);
    await expect(
      service.direct(owner, "job-1", session.upload_id, new File(["four"], "report.txt")),
    ).rejects.toMatchObject({ code: "INVALID_FILE_SIZE" });
    await expect(
      service.direct(stranger, "job-1", session.upload_id, new File(["hello"], "report.txt")),
    ).rejects.toBeInstanceOf(Error);
  });

  test("reserves a file name until its upload session is consumed or cancelled", async () => {
    const first = service.initialize(owner, "job-1", "report.txt", 5);

    expect(() => service.initialize(owner, "job-1", "report.txt", 5)).toThrow(
      expect.objectContaining<Partial<UploadServiceError>>({
        code: "DUPLICATE_FILE_NAME",
        status: 409,
      }),
    );

    service.cancel(owner, "job-1", first.upload_id);
    const replacement = service.initialize(owner, "job-1", "report.txt", 5);
    await service.direct(owner, "job-1", replacement.upload_id, new File(["hello"], "report.txt"));

    expect(() => service.initialize(owner, "job-1", "report.txt", 5)).toThrow(
      expect.objectContaining<Partial<UploadServiceError>>({
        code: "DUPLICATE_FILE_NAME",
        status: 409,
      }),
    );
  });

  test("uses a case-insensitive filesystem reservation across service instances", () => {
    const first = service.initialize(owner, "job-1", "Report.txt", 5);
    const secondService = new UploadService({
      uploadRoot(actor, jobId) {
        if (actor.userId !== owner.userId || jobId !== "job-1") throw new Error("Job not found");
        return testRoot;
      },
    });
    try {
      expect(() => secondService.initialize(owner, "job-1", "report.TXT", 5)).toThrow(
        expect.objectContaining<Partial<UploadServiceError>>({
          code: "DUPLICATE_FILE_NAME",
          status: 409,
        }),
      );
    } finally {
      service.cancel(owner, "job-1", first.upload_id);
      secondService.sessions.destroy();
    }
  });

  test("rejects duplicate chunks and removes cancelled sessions", async () => {
    const session = service.initialize(owner, "job-1", "large.bin", CHUNK_THRESHOLD_BYTES + 1);
    expect(session.mode).toBe("chunked");
    const firstChunk = new Blob([new Uint8Array(CHUNK_SIZE_BYTES)]);
    await service.chunk(owner, "job-1", session.upload_id, 0, firstChunk);
    await expect(service.chunk(owner, "job-1", session.upload_id, 0, firstChunk)).rejects.toEqual(
      expect.objectContaining<Partial<UploadServiceError>>({
        code: "DUPLICATE_CHUNK",
        status: 409,
      }),
    );
    service.cancel(owner, "job-1", session.upload_id);
    expect(service.sessions.get(owner, "job-1", session.upload_id)).toBeUndefined();
  });

  test("rejects invalid chunk indexes and exact-size mismatches", async () => {
    const session = service.initialize(owner, "job-1", "large.bin", CHUNK_THRESHOLD_BYTES + 1);
    const fullChunk = new Blob([new Uint8Array(CHUNK_SIZE_BYTES)]);
    await expect(
      service.chunk(owner, "job-1", session.upload_id, -1, fullChunk),
    ).rejects.toMatchObject({ code: "INVALID_CHUNK", status: 400 });
    await expect(
      service.chunk(owner, "job-1", session.upload_id, 0, new Blob(["too short"])),
    ).rejects.toMatchObject({ code: "INVALID_CHUNK", status: 400 });
    await expect(
      service.chunk(owner, "job-1", session.upload_id, session.total_chunks, fullChunk),
    ).rejects.toMatchObject({ code: "INVALID_CHUNK", status: 400 });
  });

  test("does not complete with a missing chunk and merges the exact complete set", async () => {
    const totalSize = CHUNK_THRESHOLD_BYTES + 1;
    const session = service.initialize(owner, "job-1", "large.bin", totalSize);
    const fullChunk = new Blob([new Uint8Array(CHUNK_SIZE_BYTES)]);

    const first = await service.chunk(owner, "job-1", session.upload_id, 0, fullChunk);
    const last = await service.chunk(owner, "job-1", session.upload_id, 2, new Blob(["x"]));
    expect(first.completed).toBe(false);
    expect(last.completed).toBe(false);
    expect(existsSync(resolve(testRoot, "large.bin"))).toBe(false);

    const completed = await service.chunk(owner, "job-1", session.upload_id, 1, fullChunk);
    expect(completed.completed).toBe(true);
    expect(statSync(resolve(testRoot, "large.bin")).size).toBe(totalSize);
    expect(service.sessions.get(owner, "job-1", session.upload_id)).toBeUndefined();
  });

  test("refuses recursive cleanup when a session temp directory escapes its root", () => {
    const sentinel = resolve(testRoot, "keep.txt");
    writeFileSync(sentinel, "keep");
    const info = service.initialize(owner, "job-1", "report.txt", 5);
    const session = service.sessions.get(owner, "job-1", info.upload_id);
    expect(session).toBeDefined();
    if (!session) throw new Error("Expected upload session");
    session.temp_dir = testRoot;

    expect(() => service.cancel(owner, "job-1", info.upload_id)).toThrow(
      expect.objectContaining<Partial<UploadServiceError>>({ code: "UNSAFE_PATH" }),
    );
    expect(readFileSync(sentinel, "utf8")).toBe("keep");
  });
});
