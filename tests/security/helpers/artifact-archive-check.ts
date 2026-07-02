import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import * as tar from "tar";
import { webActor } from "../../../src/application/actor";
import { artifactService } from "../../../src/application/artifactService";
import { jobService } from "../../../src/application/jobService";
import db from "../../../src/db/db";

db.query("INSERT INTO users(email, password) VALUES (?, ?)").run(
  "archive-owner@example.invalid",
  "hash",
);
db.query("INSERT INTO users(email, password) VALUES (?, ?)").run(
  "archive-stranger@example.invalid",
  "hash",
);
const owner = webActor("1");
const stranger = webActor("2");
const jobId = jobService.create(owner);
jobService.prepare(owner, jobId, 2);
jobService.start(owner, jobId);
const completedId = jobService.createFile(owner, jobId, "good.txt", "good.pdf");
const failedId = jobService.createFile(owner, jobId, "bad.txt", "bad.pdf");
const outputRoot = artifactService.outputRoot(owner, jobId);
mkdirSync(outputRoot, { recursive: true });
writeFileSync(join(outputRoot, "good.pdf"), "valid artifact");
writeFileSync(join(outputRoot, "bad.pdf"), "failed artifact must not be published");
jobService.finishFile(owner, jobId, completedId, "completed");
jobService.finishFile(owner, jobId, failedId, "failed", new Error("conversion failed"));
jobService.finish(owner, jobId, {
  total: 2,
  completed: 1,
  failed: 1,
  errors: ["conversion failed"],
});

let strangerDenied = false;
try {
  artifactService.completedArtifactPath(stranger, jobId, "good.pdf");
} catch {
  strangerDenied = true;
}

let crossDeleteDenied = false;
try {
  artifactService.deleteJobArtifacts(stranger, jobId);
  jobService.delete(stranger, jobId);
} catch {
  crossDeleteDenied = true;
}
const ownerJobStillExists = jobService.getOwnedJob(owner, jobId) !== null;

const archive = await artifactService.createJobArchive(owner, jobId);
const entries: string[] = [];
await tar.list({
  file: archive,
  onentry(entry) {
    entries.push(entry.path);
  },
});
console.log(JSON.stringify({ entries, strangerDenied, crossDeleteDenied, ownerJobStillExists }));
