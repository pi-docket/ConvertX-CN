import { extname } from "node:path";
import { mkdir } from "node:fs/promises";
import {
  getConversionOutputFileName,
  mainConverter,
  validateConversionSelection,
} from "../converters/main";
import { MAX_CONVERT_PROCESS, MAX_FILES_PER_JOB } from "../helpers/env";
import { createTask, finishTask, startTask } from "../helpers/memoryLifecycle";
import { normalizeFiletype } from "../helpers/normalizeFiletype";
import { artifactService } from "./artifactService";
import { ACTOR_SCOPES, type Actor } from "./actor";
import { jobService, sanitizeError, type ConversionSummary } from "./jobService";

export interface ConversionRequest {
  actor: Actor;
  jobId: string | number;
  fileNames: string[];
  convertTo: string;
  converterName: string;
}

export interface ConversionExecutor {
  execute(request: {
    inputPath: string;
    fileType: string;
    convertTo: string;
    targetPath: string;
    converterName: string;
    userId: number;
    taskId: string;
  }): Promise<void>;
}

interface PlannedConversion {
  canonicalTarget: string;
  files: Array<{
    fileName: string;
    inputPath: string;
    outputFileName: string;
    targetPath: string;
  }>;
}

export class InProcessConversionExecutor implements ConversionExecutor {
  async execute(request: Parameters<ConversionExecutor["execute"]>[0]): Promise<void> {
    await mainConverter(
      request.inputPath,
      request.fileType,
      request.convertTo,
      request.targetPath,
      { userId: request.userId, taskId: request.taskId },
      request.converterName,
    );
  }
}

export function batchItems<T>(items: T[], size: number): T[][] {
  const safeSize = size > 0 ? size : Math.max(1, items.length);
  return Array.from({ length: Math.ceil(items.length / safeSize) }, (_, index) =>
    items.slice(index * safeSize, (index + 1) * safeSize),
  );
}

export class ConversionOrchestrator {
  constructor(private readonly executor: ConversionExecutor = new InProcessConversionExecutor()) {}

  submit(request: ConversionRequest): Promise<ConversionSummary> {
    const plan = this.createPlan(request);
    jobService.claim(request.actor, request.jobId, plan.files.length);
    return this.runClaimed(request, plan);
  }

  run(request: ConversionRequest): Promise<ConversionSummary> {
    return this.submit(request);
  }

  private createPlan(request: ConversionRequest): PlannedConversion {
    if (request.fileNames.length === 0 || request.fileNames.length > MAX_FILES_PER_JOB) {
      throw new Error(`A conversion job must contain between 1 and ${MAX_FILES_PER_JOB} files`);
    }
    const canonicalTarget = validateConversionSelection(
      request.fileNames,
      request.convertTo,
      request.converterName,
    );
    const usedOutputNames = new Set<string>();
    const files = request.fileNames.map((fileName) => {
      const inputPath = artifactService.uploadedFilePath(request.actor, request.jobId, fileName);
      const desiredName = getConversionOutputFileName(
        fileName,
        canonicalTarget,
        request.converterName,
      );
      let outputFileName = desiredName;
      let suffix = 2;
      while (usedOutputNames.has(outputFileName.toLocaleLowerCase())) {
        const extension = extname(desiredName);
        const stem = extension ? desiredName.slice(0, -extension.length) : desiredName;
        outputFileName = `${stem}-${suffix}${extension}`;
        suffix += 1;
      }
      usedOutputNames.add(outputFileName.toLocaleLowerCase());
      const executorFileName =
        request.converterName === "PDF Packager"
          ? outputFileName
          : outputFileName.replace(/\.tar$/i, "");
      const targetPath = artifactService.conversionTargetPath(
        request.actor,
        request.jobId,
        executorFileName,
      );
      return { fileName, inputPath, outputFileName, targetPath };
    });
    return { canonicalTarget, files };
  }

  private async runClaimed(
    request: ConversionRequest,
    plan: PlannedConversion,
  ): Promise<ConversionSummary> {
    let taskId: string | undefined;
    const summary: ConversionSummary = {
      total: plan.files.length,
      completed: 0,
      failed: 0,
      errors: [],
    };

    try {
      await mkdir(
        artifactService.outputRoot(request.actor, request.jobId, ACTOR_SCOPES.JOBS_CREATE),
        { recursive: true },
      );
      const task = createTask("conversion");
      taskId = task.taskId;
      startTask(taskId);
      for (const batch of batchItems(plan.files, MAX_CONVERT_PROCESS)) {
        const results = await Promise.allSettled(
          batch.map((file) =>
            this.convertFile(request, plan.canonicalTarget, file, taskId as string),
          ),
        );
        for (const result of results) {
          if (result.status === "fulfilled") summary.completed += 1;
          else {
            summary.failed += 1;
            summary.errors.push(sanitizeError(result.reason));
          }
        }
      }

      jobService.finish(request.actor, request.jobId, summary);
      if (taskId) await finishTask(taskId, summary.failed === 0 ? "completed" : "failed");
      return summary;
    } catch (error) {
      try {
        jobService.fail(request.actor, request.jobId, error);
      } catch (stateError) {
        console.error(
          `[Conversion] Could not persist failure for job ${request.jobId}`,
          stateError,
        );
      }
      if (taskId) await finishTask(taskId, "failed");
      throw error;
    }
  }

  private async convertFile(
    request: ConversionRequest,
    canonicalTarget: string,
    file: PlannedConversion["files"][number],
    taskId: string,
  ): Promise<void> {
    const fileRowId = jobService.createFile(
      request.actor,
      request.jobId,
      file.fileName,
      file.outputFileName,
    );
    try {
      const fileType = normalizeFiletype(file.fileName.split(".").pop() ?? "");
      await this.executor.execute({
        inputPath: file.inputPath,
        fileType,
        convertTo: canonicalTarget,
        targetPath: file.targetPath,
        converterName: request.converterName,
        userId: Number(request.actor.userId),
        taskId,
      });
      artifactService.validateOutput(
        request.actor,
        request.jobId,
        file.outputFileName,
        ACTOR_SCOPES.JOBS_CREATE,
      );
      jobService.finishFile(request.actor, request.jobId, fileRowId, "completed");
    } catch (error) {
      console.error(`[Conversion] Job ${request.jobId} file ${file.fileName} failed`, error);
      jobService.finishFile(request.actor, request.jobId, fileRowId, "failed", error);
      throw error;
    }
  }
}

export const conversionOrchestrator = new ConversionOrchestrator();
