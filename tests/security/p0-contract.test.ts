import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const frontend = readFileSync("public/script.js", "utf8");
const uploadRoute = readFileSync("src/pages/upload.tsx", "utf8");
const downloadRoute = readFileSync("src/pages/download.tsx", "utf8");
const deleteFileRoute = readFileSync("src/pages/deleteFile.tsx", "utf8");
const entrypoint = readFileSync("scripts/entrypoint.sh", "utf8");
const appEntry = readFileSync("src/index.tsx", "utf8");
const converterPicker = readFileSync("src/pages/chooseConverter.tsx", "utf8");

describe("P0 adapter contracts", () => {
  test("direct upload requires the initialized upload id", () => {
    expect(uploadRoute).toContain("body.upload_id");
    expect(uploadRoute).toContain("uploadService.direct");
    expect(frontend).toContain('formData.append("upload_id", session.upload_id)');
  });

  test("frontend supports retry, abort, and synchronized format reset", () => {
    expect(frontend).toContain("retryUpload");
    expect(frontend).toContain("state.controller?.abort()");
    expect(frontend).toContain("state.xhr?.abort()");
    expect(frontend).toContain('convertToElement.value = ""');
    expect(frontend).toContain('candidate.setAttribute("aria-selected", "false")');
  });

  test("destructive file deletion uses CSRF and artifact ownership", () => {
    expect(deleteFileRoute).toContain("verifyCsrf");
    expect(deleteFileRoute).toContain("artifactService.deleteUpload");
    expect(deleteFileRoute).not.toContain("path.join");
  });

  test("download routes do not assemble or expose filesystem paths", () => {
    expect(downloadRoute).toContain("artifactService.completedArtifactPath");
    expect(downloadRoute).toContain("artifactService.createJobArchive");
    expect(downloadRoute).not.toContain("outputDir");
    expect(downloadRoute).not.toContain("path:");
  });

  test("signing certificate is validated after dropping privileges", () => {
    const dropIndex = entrypoint.indexOf('exec gosu "$APP_USER"');
    const runtimeValidationIndex = entrypoint.lastIndexOf("validate_signing");
    expect(dropIndex).toBeGreaterThan(-1);
    expect(runtimeValidationIndex).toBeGreaterThan(dropIndex);
    expect(entrypoint).toContain("not readable by runtime user");
    expect(entrypoint).toContain("signing.key.tmp");
    expect(entrypoint).toContain("trap 'rm -f");
  });

  test("dynamically filtered signed formats retain the self-signed identity notice", () => {
    expect(converterPicker).toContain("本部署自簽憑證，不代表 CA 身份認證");
    expect(converterPicker).toContain("PDF_SIGN_SELF_SIGNED");
  });

  test("future REST adapter is reserved but not mounted", () => {
    expect(appEntry).not.toContain(".use(rasApi)");
    expect(appEntry).not.toContain('from "./pages/rasApi"');
  });
});
