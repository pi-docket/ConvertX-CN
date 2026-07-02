/**
 * Contents.CN Chunk 上傳 API
 *
 * 處理大檔的分段上傳
 */

import { Elysia, t } from "elysia";
import { webActor } from "../application/actor";
import { uploadService, UploadServiceError } from "../application/uploadService";
import { userService } from "./user";
import { verifyCsrf } from "../helpers/csrf";

function uploadError(error: unknown, set: { status?: number | string }) {
  if (error instanceof UploadServiceError) {
    set.status = error.status;
    return { success: false, code: error.code, message: error.message };
  }
  console.error("Chunk upload failed:", error);
  set.status = 500;
  return { success: false, code: "UPLOAD_FAILED", message: "Upload failed" };
}

export const uploadChunk = new Elysia().use(userService).post(
  "/upload-chunk",
  async ({ body, user, cookie: { jobId }, set }) => {
    if (!jobId?.value) {
      set.status = 400;
      return { success: false, code: "NO_ACTIVE_JOB", message: "No active job session" };
    }

    // 取得 chunk 資料
    try {
      const result = await uploadService.chunk(
        webActor(user.id),
        jobId.value,
        body.upload_id,
        Number(body.chunk_index),
        body.chunk,
      );
      const { file_path: _filePath, ...response } = result;
      return response;
    } catch (error) {
      return uploadError(error, set);
    }
  },
  {
    body: t.Object(
      {
        upload_id: t.String(),
        chunk_index: t.String(),
        chunk: t.File(),
      },
      { additionalProperties: false },
    ),
    auth: true,
  },
);

/**
 * 取得上傳資訊（用於前端判斷是否需要 chunk 上傳）
 */
export const uploadInfo = new Elysia().use(userService).post(
  "/upload-info",
  async ({ body, user, cookie: { jobId }, set }) => {
    if (!jobId?.value) {
      set.status = 400;
      return { success: false, code: "NO_ACTIVE_JOB", message: "No active job session" };
    }
    try {
      return uploadService.initialize(
        webActor(user.id),
        jobId.value,
        body.file_name,
        Number(body.file_size),
      );
    } catch (error) {
      return uploadError(error, set);
    }
  },
  {
    body: t.Object(
      {
        file_size: t.Number({ minimum: 0 }),
        file_name: t.String(),
      },
      { additionalProperties: false },
    ),
    auth: true,
  },
);

export const uploadCancel = new Elysia().use(userService).post(
  "/upload-cancel",
  ({ body, request, user, cookie: { jobId, csrf }, set }) => {
    if (!jobId?.value) {
      set.status = 400;
      return { success: false, code: "NO_ACTIVE_JOB", message: "No active job session" };
    }
    if (
      !verifyCsrf(
        request,
        body.csrf_token,
        typeof csrf?.value === "string" ? csrf.value : undefined,
      )
    ) {
      set.status = 403;
      return { success: false, code: "INVALID_CSRF", message: "Invalid CSRF token or Origin" };
    }
    uploadService.cancel(webActor(user.id), jobId.value, body.upload_id);
    return { success: true };
  },
  {
    body: t.Object(
      { upload_id: t.String(), csrf_token: t.String() },
      { additionalProperties: false },
    ),
    auth: true,
  },
);
