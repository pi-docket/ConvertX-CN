import { Elysia, t } from "elysia";
import sanitize from "sanitize-filename";
import { conversionOrchestrator } from "../application/conversionOrchestrator";
import { webActor } from "../application/actor";
import { JobServiceError, jobService } from "../application/jobService";
import { MAX_FILES_PER_JOB, WEBROOT } from "../helpers/env";
import { inferenceService } from "../inference";
import { userService } from "./user";

function parseFileNames(value: string): string[] {
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed) || parsed.length === 0 || parsed.length > MAX_FILES_PER_JOB) {
    throw new Error(`Between 1 and ${MAX_FILES_PER_JOB} uploaded files are required`);
  }
  const names = parsed.map((name) => {
    if (typeof name !== "string" || !name || sanitize(name) !== name)
      throw new Error("Invalid uploaded file name");
    return name;
  });
  if (new Set(names).size !== names.length) throw new Error("Duplicate uploaded file name");
  return names;
}

export const convert = new Elysia().use(userService).post(
  "/convert",
  async ({ body, redirect, user, cookie: { jobId }, set }) => {
    if (!jobId?.value) return redirect(`${WEBROOT}/`, 302);
    const actor = webActor(String(user.id));
    if (!jobService.getOwnedJob(actor, jobId.value)) return redirect(`${WEBROOT}/`, 302);

    const [rawTarget, converterName] = body.convert_to.split(",");
    const convertTo = rawTarget?.trim() ?? "";
    if (!convertTo || !converterName) return redirect(`${WEBROOT}/`, 302);

    let fileNames: string[];
    try {
      fileNames = parseFileNames(body.file_names);
    } catch {
      return redirect(`${WEBROOT}/`, 302);
    }

    const conversionStartTime = Date.now();
    const inputExt = fileNames[0]?.split(".").pop()?.toLowerCase() ?? "";
    let conversion: ReturnType<typeof conversionOrchestrator.submit>;
    try {
      conversion = conversionOrchestrator.submit({
        actor,
        jobId: jobId.value,
        fileNames,
        convertTo,
        converterName,
      });
    } catch (error) {
      set.status =
        error instanceof JobServiceError && error.code === "INVALID_TRANSITION" ? 409 : 400;
      return {
        success: false,
        error:
          set.status === 409
            ? "This conversion job has already been submitted"
            : "Invalid conversion request",
      };
    }
    void conversion
      .then((summary) => {
        inferenceService.logConversion({
          userId: Number(user.id),
          inputExt,
          searchedFormat: convertTo,
          selectedEngine: converterName,
          success: summary.failed === 0,
          durationMs: Date.now() - conversionStartTime,
        });
      })
      .catch((error: unknown) => {
        console.error(`[Conversion] Job ${jobId.value} failed`, error);
        inferenceService.logConversion({
          userId: Number(user.id),
          inputExt,
          searchedFormat: convertTo,
          selectedEngine: converterName,
          success: false,
          durationMs: Date.now() - conversionStartTime,
        });
      });

    return redirect(`${WEBROOT}/results/${jobId.value}`, 302);
  },
  {
    body: t.Object({
      convert_to: t.String({ minLength: 3, maxLength: 512 }),
      file_names: t.String({ minLength: 2, maxLength: 64 * 1024 }),
    }),
    auth: true,
  },
);
