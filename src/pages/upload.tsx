import { Elysia, t } from "elysia";
import { webActor } from "../application/actor";
import { uploadService, UploadServiceError } from "../application/uploadService";
import { userService } from "./user";

export const upload = new Elysia().use(userService).post(
  "/upload",
  async ({ body, user, cookie: { jobId }, set }) => {
    if (!jobId?.value) {
      set.status = 400;
      return { success: false, code: "NO_ACTIVE_JOB", message: "No active job session" };
    }

    try {
      const actor = webActor(user.id);
      const files = Array.isArray(body.file) ? body.file : [body.file];
      const uploaded: string[] = [];
      for (const file of files) {
        const result = await uploadService.direct(actor, jobId.value, body.upload_id, file);
        uploaded.push(file.name);
        if (!result.success) {
          throw new UploadServiceError("INVALID_FILE_SIZE", result.message);
        }
      }
      return { success: true, message: "Files uploaded successfully.", files: uploaded };
    } catch (error) {
      if (error instanceof UploadServiceError) {
        set.status = error.status;
        return { success: false, code: error.code, message: error.message };
      }
      console.error("Direct upload failed:", error);
      set.status = 500;
      return { success: false, code: "UPLOAD_FAILED", message: "Upload failed" };
    }
  },
  {
    body: t.Object({ upload_id: t.String(), file: t.File() }, { additionalProperties: false }),
    auth: true,
  },
);
