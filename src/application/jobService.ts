import db from "../db/db";
import { Filename, Jobs } from "../db/types";
import { ACTOR_SCOPES, actorCan, type Actor, type ActorScope } from "./actor";

export type JobStatus = "pending" | "processing" | "completed" | "partial" | "failed";
export type FileStatus = "processing" | "completed" | "failed";

export interface ConversionSummary {
  total: number;
  completed: number;
  failed: number;
  errors: string[];
}

export class JobServiceError extends Error {
  constructor(
    public readonly code: "FORBIDDEN" | "JOB_NOT_FOUND" | "INVALID_TRANSITION",
    message: string,
  ) {
    super(message);
  }
}

const allowedTransitions: Record<string, readonly JobStatus[]> = {
  pending: ["processing", "failed"],
  processing: ["completed", "partial", "failed"],
  completed: [],
  partial: [],
  failed: [],
};

export function sanitizeError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  return raw
    .replaceAll(process.cwd(), "<workdir>")
    .replace(/(?:[A-Za-z]:)?[\\/](?:[^\s:]+[\\/])+[^\s:]*/g, "<path>")
    .replace(/\b(Bearer)\s+[^\s,;]+/gi, "$1 [REDACTED]")
    .replace(
      /(\b(?:api[_-]?key|access[_-]?token|token|password|secret|authorization)\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi,
      "$1[REDACTED]",
    )
    .replace(
      /(--(?:api[_-]?key|access[_-]?token|token|password|secret)\s+)(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi,
      "$1[REDACTED]",
    )
    .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, "[REDACTED]")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, 500);
}

export class JobService {
  create(actor: Actor): number {
    if (!actorCan(actor, ACTOR_SCOPES.JOBS_CREATE)) {
      throw new JobServiceError("FORBIDDEN", "Missing jobs:create scope");
    }
    const result = db
      .query("INSERT INTO jobs (user_id, date_created, status) VALUES (?, ?, 'pending')")
      .run(actor.userId, new Date().toISOString());
    return Number(result.lastInsertRowid);
  }

  getOwnedJob(actor: Actor, jobId: string | number): Jobs | null {
    if (!actorCan(actor, ACTOR_SCOPES.JOBS_READ)) {
      throw new JobServiceError("FORBIDDEN", "Missing jobs:read scope");
    }
    return (
      db
        .query("SELECT * FROM jobs WHERE id = ? AND user_id = ?")
        .as(Jobs)
        .get(jobId, actor.userId) ?? null
    );
  }

  listOwnedJobs(actor: Actor): Jobs[] {
    if (!actorCan(actor, ACTOR_SCOPES.JOBS_READ)) {
      throw new JobServiceError("FORBIDDEN", "Missing jobs:read scope");
    }
    return db
      .query("SELECT * FROM jobs WHERE user_id = ? ORDER BY id DESC")
      .as(Jobs)
      .all(actor.userId);
  }

  requireOwnedJob(
    actor: Actor,
    jobId: string | number,
    requiredScope: ActorScope = ACTOR_SCOPES.JOBS_READ,
  ): Jobs {
    if (!actorCan(actor, requiredScope)) {
      throw new JobServiceError("FORBIDDEN", `Missing ${requiredScope} scope`);
    }
    const job =
      db
        .query("SELECT * FROM jobs WHERE id = ? AND user_id = ?")
        .as(Jobs)
        .get(jobId, actor.userId) ?? null;
    if (!job) throw new JobServiceError("JOB_NOT_FOUND", "Job not found");
    return job;
  }

  prepare(actor: Actor, jobId: string | number, numFiles: number): void {
    if (!actorCan(actor, ACTOR_SCOPES.JOBS_CREATE)) {
      throw new JobServiceError("FORBIDDEN", "Missing jobs:create scope");
    }
    const job = this.requireOwnedJob(actor, jobId, ACTOR_SCOPES.JOBS_CREATE);
    if (job.status !== "pending") {
      throw new JobServiceError("INVALID_TRANSITION", `Cannot prepare job from ${job.status}`);
    }
    const result = db
      .query(
        "UPDATE jobs SET num_files = ?, status = 'pending', error_message = NULL, started_at = NULL, completed_at = NULL WHERE id = ? AND user_id = ? AND status = 'pending'",
      )
      .run(numFiles, jobId, actor.userId);
    if (result.changes !== 1) {
      throw new JobServiceError("INVALID_TRANSITION", "Job changed while it was being prepared");
    }
  }

  claim(actor: Actor, jobId: string | number, numFiles: number): void {
    if (!actorCan(actor, ACTOR_SCOPES.JOBS_CREATE)) {
      throw new JobServiceError("FORBIDDEN", "Missing jobs:create scope");
    }
    const now = new Date().toISOString();
    const result = db
      .query(
        `UPDATE jobs
         SET num_files = ?, status = 'processing', error_message = NULL,
             started_at = ?, completed_at = NULL
         WHERE id = ? AND user_id = ? AND status = 'pending'`,
      )
      .run(numFiles, now, jobId, actor.userId);
    if (result.changes === 1) return;

    const job = this.requireOwnedJob(actor, jobId, ACTOR_SCOPES.JOBS_CREATE);
    throw new JobServiceError("INVALID_TRANSITION", `Cannot claim job from ${job.status}`);
  }

  start(actor: Actor, jobId: string | number): void {
    this.transition(actor, jobId, "processing", {
      startedAt: new Date().toISOString(),
      completedAt: null,
      errorMessage: null,
    });
  }

  finish(actor: Actor, jobId: string | number, summary: ConversionSummary): JobStatus {
    const status: JobStatus =
      summary.failed === 0 ? "completed" : summary.completed === 0 ? "failed" : "partial";
    const errorMessage =
      summary.failed > 0
        ? sanitizeError(
            `${summary.failed} of ${summary.total} files failed. ${summary.errors.join(" ")}`,
          )
        : null;
    this.transition(actor, jobId, status, {
      completedAt: new Date().toISOString(),
      errorMessage,
    });
    return status;
  }

  fail(actor: Actor, jobId: string | number, error: unknown): void {
    const job = this.requireOwnedJob(actor, jobId, ACTOR_SCOPES.JOBS_CREATE);
    if (["completed", "partial", "failed"].includes(job.status)) return;
    this.transition(actor, jobId, "failed", {
      completedAt: new Date().toISOString(),
      errorMessage: sanitizeError(error),
    });
  }

  transition(
    actor: Actor,
    jobId: string | number,
    next: JobStatus,
    fields: {
      startedAt?: string | null;
      completedAt?: string | null;
      errorMessage?: string | null;
    } = {},
  ): void {
    const job = this.requireOwnedJob(actor, jobId, ACTOR_SCOPES.JOBS_CREATE);
    const allowed = allowedTransitions[job.status] ?? [];
    if (job.status !== next && !allowed.includes(next)) {
      throw new JobServiceError(
        "INVALID_TRANSITION",
        `Cannot transition job from ${job.status} to ${next}`,
      );
    }
    const result = db
      .query(
        `UPDATE jobs SET status = ?, started_at = COALESCE(?, started_at), completed_at = ?, error_message = ? WHERE id = ? AND user_id = ? AND status = ?`,
      )
      .run(
        next,
        fields.startedAt ?? null,
        fields.completedAt ?? null,
        fields.errorMessage ?? null,
        jobId,
        actor.userId,
        job.status,
      );
    if (result.changes !== 1) {
      throw new JobServiceError("INVALID_TRANSITION", "Job status changed concurrently");
    }
  }

  createFile(
    actor: Actor,
    jobId: string | number,
    fileName: string,
    outputFileName: string,
  ): number {
    const job = this.requireOwnedJob(actor, jobId, ACTOR_SCOPES.JOBS_CREATE);
    if (job.status !== "processing") {
      throw new JobServiceError("INVALID_TRANSITION", "Files can only start in a processing job");
    }
    const result = db
      .query(
        "INSERT INTO file_names (job_id, file_name, output_file_name, status, error_message, started_at, completed_at) VALUES (?, ?, ?, 'processing', NULL, ?, NULL)",
      )
      .run(jobId, fileName, outputFileName, new Date().toISOString());
    return Number(result.lastInsertRowid);
  }

  finishFile(
    actor: Actor,
    jobId: string | number,
    fileId: number,
    status: FileStatus,
    error?: unknown,
  ): void {
    this.requireOwnedJob(actor, jobId, ACTOR_SCOPES.JOBS_CREATE);
    const result = db
      .query(
        "UPDATE file_names SET status = ?, error_message = ?, completed_at = ? WHERE id = ? AND job_id = ? AND status = 'processing'",
      )
      .run(
        status,
        status === "failed" ? sanitizeError(error) : null,
        new Date().toISOString(),
        fileId,
        jobId,
      );
    if (result.changes !== 1) {
      throw new JobServiceError("INVALID_TRANSITION", "File is not in processing state");
    }
  }

  listFiles(
    actor: Actor,
    jobId: string | number,
    requiredScope: ActorScope = ACTOR_SCOPES.JOBS_READ,
  ): Filename[] {
    this.requireOwnedJob(actor, jobId, requiredScope);
    return db.query("SELECT * FROM file_names WHERE job_id = ?").as(Filename).all(jobId);
  }

  delete(actor: Actor, jobId: string | number): void {
    if (!actorCan(actor, ACTOR_SCOPES.JOBS_DELETE)) {
      throw new JobServiceError("FORBIDDEN", "Missing jobs:delete scope");
    }
    this.requireOwnedJob(actor, jobId, ACTOR_SCOPES.JOBS_DELETE);
    const transaction = db.transaction(() => {
      db.query("DELETE FROM file_names WHERE job_id = ?").run(jobId);
      db.query("DELETE FROM jobs WHERE id = ? AND user_id = ?").run(jobId, actor.userId);
    });
    transaction();
  }
}

export const jobService = new JobService();
