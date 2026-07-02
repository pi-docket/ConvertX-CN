import { createHash, randomUUID } from "node:crypto";
import {
  closeSync,
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  openSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
} from "node:fs";
import { once } from "node:events";
import { basename, resolve } from "node:path";
import sanitize from "sanitize-filename";
import { HTTP_ALLOWED_FILE_SIZE, MAX_UPLOAD_SESSIONS_PER_USER } from "../helpers/env";
import { isPathInside } from "../helpers/paths";
import {
  CHUNK_SIZE_BYTES,
  CHUNK_TEMP_DIR,
  CHUNK_THRESHOLD_BYTES,
  UPLOAD_SESSION_TIMEOUT_MS,
} from "../transfer/constants";
import type {
  ChunkUploadResponse,
  DirectUploadResponse,
  TransferMode,
  UploadSession,
} from "../transfer/types";
import type { Actor } from "./actor";
import { artifactService } from "./artifactService";

export class UploadServiceError extends Error {
  constructor(
    public readonly code:
      | "INVALID_FILE_NAME"
      | "INVALID_FILE_SIZE"
      | "FILE_TOO_LARGE"
      | "DIRECT_UPLOAD_REQUIRED"
      | "CHUNK_UPLOAD_REQUIRED"
      | "DUPLICATE_FILE_NAME"
      | "DUPLICATE_CHUNK"
      | "UPLOAD_IN_PROGRESS"
      | "UPLOAD_NOT_FOUND"
      | "INVALID_CHUNK"
      | "UNSAFE_PATH",
    message: string,
    public readonly status = 400,
  ) {
    super(message);
  }
}

export interface UploadSessionInfo {
  success: true;
  mode: TransferMode;
  chunk_size: number;
  total_chunks: number;
  upload_id: string;
  file_name: string;
  max_file_size: number;
}

function sessionKey(userId: string, jobId: string, uploadId: string): string {
  return `${userId}:${jobId}:${uploadId}`;
}

export function validateFileName(fileName: string): string {
  const trimmed = fileName.trim();
  if (!trimmed || basename(trimmed) !== trimmed || /[\\/]/.test(trimmed)) {
    throw new UploadServiceError("INVALID_FILE_NAME", "File name must be a single path component");
  }
  const safe = sanitize(trimmed);
  if (!safe || safe !== trimmed || safe === "." || safe === "..") {
    throw new UploadServiceError("INVALID_FILE_NAME", "File name is empty or unsupported");
  }
  return safe;
}

export function validateFileSize(fileSize: number): number {
  if (!Number.isSafeInteger(fileSize) || fileSize < 0) {
    throw new UploadServiceError("INVALID_FILE_SIZE", "File size must be a non-negative integer");
  }
  if (fileSize > HTTP_ALLOWED_FILE_SIZE) {
    throw new UploadServiceError(
      "FILE_TOO_LARGE",
      `File exceeds the ${HTTP_ALLOWED_FILE_SIZE} byte limit`,
      413,
    );
  }
  return fileSize;
}

class UploadSessionStore {
  private readonly sessions = new Map<string, UploadSession>();
  private readonly cleanupInterval: ReturnType<typeof setInterval>;

  constructor() {
    this.cleanupInterval = setInterval(() => this.cleanupExpired(), 5 * 60 * 1000);
    this.cleanupInterval.unref?.();
  }

  put(session: UploadSession): void {
    this.sessions.set(sessionKey(session.user_id, session.job_id, session.upload_id), session);
  }

  hasFileReservation(actor: Actor, jobId: string, fileName: string): boolean {
    return [...this.sessions.values()].some(
      (session) =>
        session.user_id === actor.userId &&
        session.job_id === jobId &&
        session.file_name.toLocaleLowerCase() === fileName.toLocaleLowerCase(),
    );
  }

  countForUser(actor: Actor): number {
    return [...this.sessions.values()].filter((session) => session.user_id === actor.userId).length;
  }

  get(actor: Actor, jobId: string, uploadId: string): UploadSession | undefined {
    return this.sessions.get(sessionKey(actor.userId, jobId, uploadId));
  }

  remove(session: UploadSession): void {
    try {
      this.safeRemoveTemp(session);
      this.safeRemoveReservation(session);
    } finally {
      this.sessions.delete(sessionKey(session.user_id, session.job_id, session.upload_id));
    }
  }

  mark(session: UploadSession, chunkIndex: number): void {
    session.pending_chunks?.delete(chunkIndex);
    session.received_chunks.add(chunkIndex);
  }

  claimChunk(session: UploadSession, chunkIndex: number): void {
    session.pending_chunks ??= new Set();
    if (session.received_chunks.has(chunkIndex) || session.pending_chunks.has(chunkIndex)) {
      throw new UploadServiceError("DUPLICATE_CHUNK", "Chunk was already received", 409);
    }
    session.pending_chunks.add(chunkIndex);
  }

  releaseChunk(session: UploadSession, chunkIndex: number): void {
    session.pending_chunks?.delete(chunkIndex);
  }

  claimDirect(session: UploadSession): void {
    if (session.active) {
      throw new UploadServiceError("UPLOAD_IN_PROGRESS", "Upload session is already in use", 409);
    }
    session.active = true;
  }

  releaseDirect(session: UploadSession): void {
    session.active = false;
  }

  complete(session: UploadSession): boolean {
    if (session.received_chunks.size !== session.total_chunks) return false;
    for (let index = 0; index < session.total_chunks; index += 1) {
      if (!session.received_chunks.has(index)) return false;
    }
    return true;
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
  }

  private cleanupExpired(): void {
    const now = Date.now();
    for (const session of this.sessions.values()) {
      if (now - session.created_at.getTime() > UPLOAD_SESSION_TIMEOUT_MS) {
        this.remove(session);
      }
    }
  }

  private safeRemoveTemp(session: UploadSession): void {
    const tempRoot = resolve(session.temp_root);
    const tempDir = resolve(session.temp_dir);
    if (tempDir === tempRoot || !isPathInside(tempRoot, tempDir)) {
      throw new UploadServiceError("UNSAFE_PATH", "Refusing to remove an unsafe upload path");
    }
    rmSync(tempDir, { recursive: true, force: true });
  }

  private safeRemoveReservation(session: UploadSession): void {
    if (!session.reservation_path || !session.reservation_root) return;
    const reservationRoot = resolve(session.reservation_root);
    const reservationPath = resolve(session.reservation_path);
    if (reservationPath === reservationRoot || !isPathInside(reservationRoot, reservationPath)) {
      throw new UploadServiceError("UNSAFE_PATH", "Refusing to remove an unsafe reservation");
    }
    rmSync(reservationPath, { force: true });
  }
}

export class UploadService {
  readonly sessions = new UploadSessionStore();
  constructor(
    private readonly artifacts: Pick<typeof artifactService, "uploadRoot"> = artifactService,
  ) {}

  initialize(
    actor: Actor,
    jobId: string,
    rawFileName: string,
    rawFileSize: number,
  ): UploadSessionInfo {
    const fileName = validateFileName(rawFileName);
    const fileSize = validateFileSize(rawFileSize);
    const targetRoot = this.artifacts.uploadRoot(actor, jobId);
    mkdirSync(targetRoot, { recursive: true });
    if (this.sessions.countForUser(actor) >= MAX_UPLOAD_SESSIONS_PER_USER) {
      throw new UploadServiceError("UPLOAD_IN_PROGRESS", "Too many active upload sessions", 429);
    }

    const targetPath = resolve(targetRoot, fileName);
    if (!isPathInside(targetRoot, targetPath) || targetPath === targetRoot) {
      throw new UploadServiceError("UNSAFE_PATH", "Invalid upload target");
    }
    if (
      existsSync(targetPath) ||
      readdirSync(targetRoot).some(
        (entry) => entry.toLocaleLowerCase() === fileName.toLocaleLowerCase(),
      )
    ) {
      throw new UploadServiceError(
        "DUPLICATE_FILE_NAME",
        "A file with this name already exists in the job",
        409,
      );
    }
    if (this.sessions.hasFileReservation(actor, jobId, fileName)) {
      throw new UploadServiceError(
        "DUPLICATE_FILE_NAME",
        "A file with this name is already being uploaded to the job",
        409,
      );
    }

    const mode: TransferMode = fileSize <= CHUNK_THRESHOLD_BYTES ? "direct" : "chunked";
    const totalChunks = mode === "chunked" ? Math.ceil(fileSize / CHUNK_SIZE_BYTES) : 1;
    const uploadId = randomUUID();
    const tempRoot = resolve(targetRoot, CHUNK_TEMP_DIR);
    const tempDir = resolve(tempRoot, uploadId);
    if (!isPathInside(tempRoot, tempDir) || tempDir === tempRoot) {
      throw new UploadServiceError("UNSAFE_PATH", "Invalid upload session path");
    }
    const reservationRoot = resolve(targetRoot, ".upload-reservations");
    mkdirSync(reservationRoot, { recursive: true });
    for (const entry of readdirSync(reservationRoot)) {
      const stalePath = resolve(reservationRoot, entry);
      try {
        if (
          isPathInside(reservationRoot, stalePath) &&
          Date.now() - statSync(stalePath).mtimeMs > UPLOAD_SESSION_TIMEOUT_MS
        ) {
          rmSync(stalePath, { force: true });
        }
      } catch {
        // Another process may have removed the stale reservation first.
      }
    }
    const reservationName = createHash("sha256").update(fileName.toLocaleLowerCase()).digest("hex");
    const reservationPath = resolve(reservationRoot, reservationName);
    if (!isPathInside(reservationRoot, reservationPath)) {
      throw new UploadServiceError("UNSAFE_PATH", "Invalid upload reservation path");
    }
    let reservationHandle: number;
    try {
      reservationHandle = openSync(reservationPath, "wx", 0o600);
      closeSync(reservationHandle);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") {
        throw new UploadServiceError(
          "DUPLICATE_FILE_NAME",
          "A file with this name is already being uploaded to the job",
          409,
        );
      }
      throw error;
    }

    try {
      mkdirSync(tempDir, { recursive: true });
      const session: UploadSession = {
        upload_id: uploadId,
        mode,
        user_id: actor.userId,
        job_id: jobId,
        file_name: fileName,
        total_size: fileSize,
        total_chunks: totalChunks,
        received_chunks: new Set(),
        pending_chunks: new Set(),
        created_at: new Date(),
        temp_root: tempRoot,
        temp_dir: tempDir,
        reservation_root: reservationRoot,
        reservation_path: reservationPath,
      };
      this.sessions.put(session);
    } catch (error) {
      rmSync(reservationPath, { force: true });
      rmSync(tempDir, { recursive: true, force: true });
      throw error;
    }

    return {
      success: true,
      mode,
      chunk_size: CHUNK_SIZE_BYTES,
      total_chunks: totalChunks,
      upload_id: uploadId,
      file_name: fileName,
      max_file_size: HTTP_ALLOWED_FILE_SIZE,
    };
  }

  async direct(
    actor: Actor,
    jobId: string,
    uploadId: string,
    file: File,
  ): Promise<DirectUploadResponse> {
    const session = this.requireSession(actor, jobId, uploadId, "direct");
    const fileName = validateFileName(file.name);
    if (fileName !== session.file_name || file.size !== session.total_size) {
      throw new UploadServiceError(
        "INVALID_FILE_SIZE",
        "Uploaded file does not match the initialized upload session",
      );
    }
    const targetRoot = this.artifacts.uploadRoot(actor, jobId);
    mkdirSync(targetRoot, { recursive: true });
    const targetPath = resolve(targetRoot, fileName);
    if (!isPathInside(targetRoot, targetPath) || targetPath === targetRoot) {
      throw new UploadServiceError("UNSAFE_PATH", "Invalid upload target");
    }
    if (existsSync(targetPath)) {
      throw new UploadServiceError(
        "DUPLICATE_FILE_NAME",
        "A file with this name already exists in the job",
        409,
      );
    }
    const partialPath = resolve(targetRoot, `.${session.upload_id}.part`);
    if (!isPathInside(targetRoot, partialPath)) {
      throw new UploadServiceError("UNSAFE_PATH", "Invalid direct upload path");
    }
    this.sessions.claimDirect(session);
    try {
      await Bun.write(partialPath, file);
      if (statSync(partialPath).size !== session.total_size) {
        throw new UploadServiceError("INVALID_FILE_SIZE", "Uploaded file size is incomplete");
      }
      this.publishPartial(partialPath, targetPath);
      this.sessions.remove(session);
      return { success: true, message: "File uploaded successfully.", file_path: targetPath };
    } catch (error) {
      rmSync(partialPath, { force: true });
      this.sessions.releaseDirect(session);
      throw error;
    }
  }

  cancel(actor: Actor, jobId: string, uploadId: string): void {
    const session = this.sessions.get(actor, jobId, uploadId);
    if (!session) return;
    this.sessions.remove(session);
  }

  async chunk(
    actor: Actor,
    jobId: string,
    uploadId: string,
    chunkIndex: number,
    chunk: Blob,
  ): Promise<ChunkUploadResponse> {
    const session = this.requireSession(actor, jobId, uploadId, "chunked");
    if (!Number.isSafeInteger(chunkIndex) || chunkIndex < 0 || chunkIndex >= session.total_chunks) {
      throw new UploadServiceError("INVALID_CHUNK", "Chunk index is out of range");
    }

    const finalChunkSize = session.total_size - CHUNK_SIZE_BYTES * (session.total_chunks - 1);
    const expectedSize =
      chunkIndex === session.total_chunks - 1 ? finalChunkSize : CHUNK_SIZE_BYTES;
    if (chunk.size !== expectedSize) {
      throw new UploadServiceError(
        "INVALID_CHUNK",
        `Chunk size mismatch: expected ${expectedSize}, received ${chunk.size}`,
      );
    }

    const chunkPath = resolve(session.temp_dir, `chunk_${chunkIndex.toString().padStart(6, "0")}`);
    if (!isPathInside(session.temp_dir, chunkPath)) {
      throw new UploadServiceError("UNSAFE_PATH", "Invalid chunk path");
    }
    this.sessions.claimChunk(session, chunkIndex);
    try {
      await Bun.write(chunkPath, chunk);
      this.sessions.mark(session, chunkIndex);
    } catch (error) {
      this.sessions.releaseChunk(session, chunkIndex);
      rmSync(chunkPath, { force: true });
      throw error;
    }

    if (!this.sessions.complete(session)) {
      return {
        success: true,
        message: `Chunk ${chunkIndex + 1}/${session.total_chunks} received.`,
        received_chunks: [...session.received_chunks].sort((a, b) => a - b),
        completed: false,
      };
    }

    const finalPath = await this.merge(session, this.artifacts.uploadRoot(actor, jobId));
    this.sessions.remove(session);
    return {
      success: true,
      message: "Upload completed and merged successfully.",
      received_chunks: Array.from({ length: session.total_chunks }, (_, index) => index),
      completed: true,
      file_path: finalPath,
    };
  }

  private requireSession(
    actor: Actor,
    jobId: string,
    uploadId: string,
    mode: TransferMode,
  ): UploadSession {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uploadId)) {
      throw new UploadServiceError("UPLOAD_NOT_FOUND", "Upload session not found", 404);
    }
    const session = this.sessions.get(actor, jobId, uploadId);
    if (!session) throw new UploadServiceError("UPLOAD_NOT_FOUND", "Upload session not found", 404);
    if (session.mode !== mode) {
      throw new UploadServiceError(
        mode === "direct" ? "CHUNK_UPLOAD_REQUIRED" : "DIRECT_UPLOAD_REQUIRED",
        `Upload session requires ${session.mode} transport`,
      );
    }
    return session;
  }

  private async merge(session: UploadSession, targetRoot: string): Promise<string> {
    const targetPath = resolve(targetRoot, session.file_name);
    const partialPath = resolve(targetRoot, `.${session.upload_id}.part`);
    if (!isPathInside(targetRoot, targetPath) || !isPathInside(targetRoot, partialPath)) {
      throw new UploadServiceError("UNSAFE_PATH", "Invalid merge target");
    }
    if (existsSync(targetPath)) {
      throw new UploadServiceError(
        "DUPLICATE_FILE_NAME",
        "A file with this name already exists in the job",
        409,
      );
    }

    const chunkFiles = readdirSync(session.temp_dir)
      .filter((name) => /^chunk_\d{6}$/.test(name))
      .sort();
    if (chunkFiles.length !== session.total_chunks) {
      throw new UploadServiceError("INVALID_CHUNK", "Upload is missing one or more chunks");
    }

    const output = createWriteStream(partialPath, { flags: "wx" });
    try {
      for (const chunkFile of chunkFiles) {
        const chunkPath = resolve(session.temp_dir, chunkFile);
        if (!isPathInside(session.temp_dir, chunkPath)) {
          throw new UploadServiceError("UNSAFE_PATH", "Invalid chunk path");
        }
        for await (const data of createReadStream(chunkPath)) {
          if (!output.write(data)) await once(output, "drain");
        }
      }
      output.end();
      await once(output, "finish");
      if (statSync(partialPath).size !== session.total_size) {
        throw new UploadServiceError(
          "INVALID_CHUNK",
          "Merged file size does not match upload metadata",
        );
      }
      this.publishPartial(partialPath, targetPath);
      return targetPath;
    } catch (error) {
      output.destroy();
      rmSync(partialPath, { force: true });
      throw error;
    }
  }

  private publishPartial(partialPath: string, targetPath: string): void {
    if (existsSync(targetPath)) {
      throw new UploadServiceError(
        "DUPLICATE_FILE_NAME",
        "A file with this name already exists in the job",
        409,
      );
    }
    renameSync(partialPath, targetPath);
  }
}

export const uploadService = new UploadService();
