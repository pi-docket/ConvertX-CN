import { basename } from "node:path";
import { mkdirSync } from "node:fs";
import db from "../../../src/db/db";
import type { Actor } from "../../../src/application/actor";
import {
  ConversionOrchestrator,
  type ConversionExecutor,
} from "../../../src/application/conversionOrchestrator";
import { jobService } from "../../../src/application/jobService";
import { artifactService } from "../../../src/application/artifactService";
import { ACTOR_SCOPES } from "../../../src/application/actor";

db.query("INSERT INTO users (email, password) VALUES (?, ?)").run(
  "conversion-owner@example.invalid",
  "hash",
);

const actor: Actor = { userId: "1", scopes: new Set(["*"]) };
const executor: ConversionExecutor = {
  async execute(request) {
    const input = basename(request.inputPath);
    if (input.startsWith("fail")) throw new Error(`/private/converter/${input} exploded`);
    if (input.startsWith("missing")) return;
    await Bun.write(request.targetPath, `converted ${input}`);
  },
};
const orchestrator = new ConversionOrchestrator(executor);

async function execute(fileNames: string[]) {
  const jobId = jobService.create(actor);
  const uploadRoot = artifactService.uploadRoot(actor, jobId, ACTOR_SCOPES.JOBS_CREATE);
  mkdirSync(uploadRoot, { recursive: true });
  await Promise.all(
    fileNames.map((fileName) => Bun.write(`${uploadRoot}/${fileName}`, `source ${fileName}`)),
  );
  const summary = await orchestrator.run({
    actor,
    jobId,
    fileNames,
    convertTo: "pdf",
    converterName: "libreoffice",
  });
  return {
    summary,
    job: jobService.requireOwnedJob(actor, jobId),
    files: jobService.listFiles(actor, jobId),
  };
}

const partial = await execute(["good.txt", "fail.txt", "missing.txt"]);
const completed = await execute(["good-again.txt"]);
const failed = await execute(["fail-again.txt"]);

process.stdout.write(`${JSON.stringify({ partial, completed, failed })}\n`);
process.exit(0);
