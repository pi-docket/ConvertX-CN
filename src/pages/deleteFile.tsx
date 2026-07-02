import { Elysia, t } from "elysia";
import { artifactService } from "../application/artifactService";
import { webActor } from "../application/actor";
import { verifyCsrf } from "../helpers/csrf";
import { userService } from "./user";

export const deleteFile = new Elysia().use(userService).post(
  "/delete",
  ({ body, request, cookie: { jobId, csrf }, user, set }) => {
    if (!jobId?.value) {
      set.status = 400;
      return { success: false, message: "No active job session" };
    }
    if (
      !verifyCsrf(
        request,
        body.csrf_token,
        typeof csrf?.value === "string" ? csrf.value : undefined,
      )
    ) {
      set.status = 403;
      return { success: false, message: "Invalid CSRF token or Origin" };
    }
    try {
      artifactService.deleteUpload(webActor(user.id), jobId.value, body.filename);
      return { success: true, message: "File deleted successfully." };
    } catch {
      set.status = 404;
      return { success: false, message: "File not found" };
    }
  },
  {
    body: t.Object({ filename: t.String(), csrf_token: t.String() }),
    auth: true,
  },
);
