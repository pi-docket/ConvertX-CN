import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { ACTOR_SCOPES, type Actor } from "../../../src/application/actor";
import { artifactService } from "../../../src/application/artifactService";
import {
  ConversionOrchestrator,
  type ConversionExecutor,
} from "../../../src/application/conversionOrchestrator";
import { JobServiceError, jobService } from "../../../src/application/jobService";
import db from "../../../src/db/db";

db.query("INSERT INTO users(email, password) VALUES (?, ?)").run(
  "concurrent-owner@example.invalid",
  "hash",
);
const actor: Actor = { userId: "1", scopes: new Set(["*"]) };
const jobId = jobService.create(actor);
const uploadRoot = artifactService.uploadRoot(actor, jobId);
mkdirSync(uploadRoot, { recursive: true });
await Bun.write(join(uploadRoot, "source.txt"), "source");

let release!: () => void;
const gate = new Promise<void>((resolve) => {
  release = resolve;
});
const executor: ConversionExecutor = {
  async execute(request) {
    await gate;
    await Bun.write(request.targetPath, "converted");
  },
};
const orchestrator = new ConversionOrchestrator(executor);
const request = {
  actor,
  jobId,
  fileNames: ["source.txt"],
  convertTo: "pdf",
  converterName: "libreoffice",
};

const first = orchestrator.submit(request);
let duplicateCode = "";
try {
  orchestrator.submit(request);
} catch (error) {
  duplicateCode = error instanceof JobServiceError ? error.code : "UNKNOWN";
}
const statusDuringFirst = jobService.requireOwnedJob(actor, jobId).status;
release();
await first;
const finalStatus = jobService.requireOwnedJob(actor, jobId).status;
const artifactReader: Actor = {
  userId: "1",
  scopes: new Set([ACTOR_SCOPES.ARTIFACTS_READ]),
};
const artifactReadWorks = Boolean(
  artifactService.completedArtifactPath(artifactReader, jobId, "source.pdf"),
);
const creator: Actor = {
  userId: "1",
  scopes: new Set([ACTOR_SCOPES.JOBS_CREATE]),
};
const creatorJobId = jobService.create(creator);
const createScopeUploadWorks = Boolean(artifactService.uploadRoot(creator, creatorJobId));
const reader: Actor = {
  userId: "1",
  scopes: new Set([ACTOR_SCOPES.JOBS_READ]),
};
let readScopeDeleteDenied = false;
try {
  artifactService.deleteUpload(reader, creatorJobId, "not-present.txt");
} catch {
  readScopeDeleteDenied = true;
}
const collisionJobId = jobService.create(actor);
const collisionUploadRoot = artifactService.uploadRoot(actor, collisionJobId);
mkdirSync(collisionUploadRoot, { recursive: true });
await Bun.write(join(collisionUploadRoot, "same.txt"), "text source");
await Bun.write(join(collisionUploadRoot, "same.doc"), "document source");
await orchestrator.run({
  actor,
  jobId: collisionJobId,
  fileNames: ["same.txt", "same.doc"],
  convertTo: "pdf",
  converterName: "libreoffice",
});
const collisionOutputs = jobService
  .listFiles(actor, collisionJobId)
  .map((file) => file.output_file_name)
  .sort();

process.stdout.write(
  `${JSON.stringify({
    duplicateCode,
    statusDuringFirst,
    finalStatus,
    artifactReadWorks,
    createScopeUploadWorks,
    readScopeDeleteDenied,
    collisionOutputs,
  })}\n`,
);
process.exit(0);
