import { randomUUID } from "node:crypto";
import { existsSync, lstatSync, realpathSync, renameSync, rmSync, statSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { outputDirPath, uploadsDirPath, isPathInside } from "../helpers/paths";
import { createTarArchive } from "../transfer/archiveManager";
import { ACTOR_SCOPES, actorCan, type Actor, type ActorScope } from "./actor";
import { jobService } from "./jobService";

export class ArtifactServiceError extends Error {
  constructor(
    public readonly code: "FORBIDDEN" | "INVALID_PATH" | "ARTIFACT_NOT_FOUND",
    message: string,
  ) {
    super(message);
  }
}

function ownedJobRoot(base: string, actor: Actor, jobId: string | number): string {
  const root = resolve(base, actor.userId, String(jobId));
  if (!isPathInside(base, root)) {
    throw new ArtifactServiceError("INVALID_PATH", "Invalid job path");
  }
  if (existsSync(root)) {
    if (lstatSync(root).isSymbolicLink()) {
      throw new ArtifactServiceError("INVALID_PATH", "Job root cannot be a symbolic link");
    }
    const realBase = realpathSync(base);
    const realRoot = realpathSync(root);
    if (!isPathInside(realBase, realRoot)) {
      throw new ArtifactServiceError(
        "INVALID_PATH",
        "Job root resolves outside its data directory",
      );
    }
  }
  return root;
}

export class ArtifactService {
  outputRoot(
    actor: Actor,
    jobId: string | number,
    requiredScope: ActorScope = ACTOR_SCOPES.ARTIFACTS_READ,
  ): string {
    jobService.requireOwnedJob(actor, jobId, requiredScope);
    return ownedJobRoot(outputDirPath, actor, jobId);
  }

  uploadRoot(
    actor: Actor,
    jobId: string | number,
    requiredScope: ActorScope = ACTOR_SCOPES.JOBS_CREATE,
  ): string {
    jobService.requireOwnedJob(actor, jobId, requiredScope);
    return ownedJobRoot(uploadsDirPath, actor, jobId);
  }

  artifactPath(
    actor: Actor,
    jobId: string | number,
    fileName: string,
    requiredScope: ActorScope = ACTOR_SCOPES.ARTIFACTS_READ,
  ): string {
    if (!actorCan(actor, requiredScope)) {
      throw new ArtifactServiceError("FORBIDDEN", `Missing ${requiredScope} scope`);
    }
    const root = this.outputRoot(actor, jobId, requiredScope);
    const candidate = resolve(root, fileName);
    if (!isPathInside(root, candidate) || candidate === root) {
      throw new ArtifactServiceError("INVALID_PATH", "Invalid artifact path");
    }
    return candidate;
  }

  completedArtifactPath(actor: Actor, jobId: string | number, fileName: string): string {
    const file = jobService
      .listFiles(actor, jobId, ACTOR_SCOPES.ARTIFACTS_READ)
      .find((entry) => entry.output_file_name === fileName && entry.status === "completed");
    if (!file) {
      throw new ArtifactServiceError("ARTIFACT_NOT_FOUND", "Artifact not found");
    }
    return this.validateOutput(actor, jobId, fileName, ACTOR_SCOPES.ARTIFACTS_READ);
  }

  deleteUpload(actor: Actor, jobId: string | number, fileName: string): void {
    const root = this.uploadRoot(actor, jobId, ACTOR_SCOPES.JOBS_CREATE);
    if (!fileName || basename(fileName) !== fileName) {
      throw new ArtifactServiceError("INVALID_PATH", "Invalid upload file name");
    }
    const candidate = resolve(root, fileName);
    if (!isPathInside(root, candidate) || candidate === root) {
      throw new ArtifactServiceError("INVALID_PATH", "Invalid upload path");
    }
    rmSync(candidate, { force: true });
  }

  async createJobArchive(actor: Actor, jobId: string | number): Promise<string> {
    const root = this.outputRoot(actor, jobId, ACTOR_SCOPES.ARTIFACTS_READ);
    const entries = jobService
      .listFiles(actor, jobId, ACTOR_SCOPES.ARTIFACTS_READ)
      .filter((file) => file.status === "completed")
      .map((file) => file.output_file_name)
      .filter((fileName) => {
        try {
          this.validateOutput(actor, jobId, fileName, ACTOR_SCOPES.ARTIFACTS_READ);
          return true;
        } catch {
          return false;
        }
      });
    if (entries.length === 0) {
      throw new ArtifactServiceError("ARTIFACT_NOT_FOUND", "No completed artifacts are available");
    }
    const archivePath = resolve(root, `converted_files_${jobId}.tar`);
    if (!isPathInside(root, archivePath)) {
      throw new ArtifactServiceError("INVALID_PATH", "Invalid archive path");
    }
    return createTarArchive(root, archivePath, { entries });
  }

  archivePath(actor: Actor, jobId: string | number): string {
    const root = this.outputRoot(actor, jobId, ACTOR_SCOPES.ARTIFACTS_READ);
    const path = resolve(root, `converted_files_${jobId}.tar`);
    if (!isPathInside(root, path) || !existsSync(path) || !statSync(path).isFile()) {
      throw new ArtifactServiceError("ARTIFACT_NOT_FOUND", "Archive not found");
    }
    return path;
  }

  validateOutput(
    actor: Actor,
    jobId: string | number,
    fileName: string,
    requiredScope: ActorScope = ACTOR_SCOPES.ARTIFACTS_READ,
  ): string {
    const path = this.artifactPath(actor, jobId, fileName, requiredScope);
    const root = this.outputRoot(actor, jobId, requiredScope);
    if (
      !existsSync(path) ||
      lstatSync(path).isSymbolicLink() ||
      !statSync(path).isFile() ||
      statSync(path).size <= 0 ||
      !isPathInside(realpathSync(root), realpathSync(path))
    ) {
      throw new ArtifactServiceError(
        "ARTIFACT_NOT_FOUND",
        `Expected output artifact was not created: ${fileName}`,
      );
    }
    return path;
  }

  uploadedFilePath(actor: Actor, jobId: string | number, fileName: string): string {
    const root = this.uploadRoot(actor, jobId, ACTOR_SCOPES.JOBS_CREATE);
    if (!fileName || basename(fileName) !== fileName) {
      throw new ArtifactServiceError("INVALID_PATH", "Invalid upload file name");
    }
    const path = resolve(root, fileName);
    if (
      !isPathInside(root, path) ||
      path === root ||
      !existsSync(path) ||
      lstatSync(path).isSymbolicLink() ||
      !statSync(path).isFile() ||
      !isPathInside(realpathSync(root), realpathSync(path))
    ) {
      throw new ArtifactServiceError("ARTIFACT_NOT_FOUND", `Uploaded file not found: ${fileName}`);
    }
    return path;
  }

  conversionTargetPath(actor: Actor, jobId: string | number, fileName: string): string {
    if (!fileName || basename(fileName) !== fileName) {
      throw new ArtifactServiceError("INVALID_PATH", "Invalid conversion output file name");
    }
    const root = this.outputRoot(actor, jobId, ACTOR_SCOPES.JOBS_CREATE);
    const path = resolve(root, fileName);
    if (!isPathInside(root, path) || path === root) {
      throw new ArtifactServiceError("INVALID_PATH", "Invalid conversion output path");
    }
    return path;
  }

  deleteJobArtifacts(actor: Actor, jobId: string | number): void {
    if (!actorCan(actor, ACTOR_SCOPES.JOBS_DELETE)) {
      throw new ArtifactServiceError("FORBIDDEN", "Missing jobs:delete scope");
    }
    jobService.requireOwnedJob(actor, jobId, ACTOR_SCOPES.JOBS_DELETE);
    for (const [base, root] of [
      [outputDirPath, ownedJobRoot(outputDirPath, actor, jobId)],
      [uploadsDirPath, ownedJobRoot(uploadsDirPath, actor, jobId)],
    ] as const) {
      if (root === resolve(base) || !isPathInside(base, root)) {
        throw new ArtifactServiceError("INVALID_PATH", "Refusing to delete an unsafe path");
      }
      rmSync(root, { recursive: true, force: true });
    }
  }

  deleteOwnedJob(actor: Actor, jobId: string | number): void {
    if (!actorCan(actor, ACTOR_SCOPES.JOBS_DELETE)) {
      throw new ArtifactServiceError("FORBIDDEN", "Missing jobs:delete scope");
    }
    jobService.requireOwnedJob(actor, jobId, ACTOR_SCOPES.JOBS_DELETE);
    const staged: Array<{ original: string; temporary: string }> = [];
    for (const [base, root, label] of [
      [outputDirPath, ownedJobRoot(outputDirPath, actor, jobId), "output"],
      [uploadsDirPath, ownedJobRoot(uploadsDirPath, actor, jobId), "upload"],
    ] as const) {
      if (root === resolve(base) || !isPathInside(base, root) || !existsSync(root)) continue;
      const temporary = resolve(
        dirname(root),
        `.deleting-${String(jobId)}-${label}-${randomUUID()}`,
      );
      if (!isPathInside(base, temporary)) {
        throw new ArtifactServiceError("INVALID_PATH", "Invalid deletion staging path");
      }
      renameSync(root, temporary);
      staged.push({ original: root, temporary });
    }

    try {
      jobService.delete(actor, jobId);
    } catch (error) {
      for (const entry of staged.reverse()) {
        if (existsSync(entry.temporary) && !existsSync(entry.original)) {
          renameSync(entry.temporary, entry.original);
        }
      }
      throw error;
    }
    for (const entry of staged) {
      try {
        rmSync(entry.temporary, { recursive: true, force: true });
      } catch (error) {
        console.error(`[Artifacts] Failed to remove staged deletion ${entry.temporary}`, error);
      }
    }
  }
}

export const artifactService = new ArtifactService();
