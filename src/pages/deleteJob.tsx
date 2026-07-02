import { Elysia, t } from "elysia";
import { artifactService } from "../application/artifactService";
import { webActor } from "../application/actor";
import { verifyCsrf } from "../helpers/csrf";
import { WEBROOT } from "../helpers/env";
import { userService } from "./user";

function removeJob(userId: string, jobId: string): void {
  artifactService.deleteOwnedJob(webActor(userId), jobId);
}

export const deleteJob = new Elysia()
  .use(userService)
  .get("/delete/:jobId", ({ set }) => {
    set.status = 405;
    set.headers.allow = "POST";
    return { success: false, message: "Use POST to delete a job" };
  })
  .post(
    "/delete/:jobId",
    ({ params, body, request, cookie: { csrf }, user, redirect, set }) => {
      if (
        !verifyCsrf(
          request,
          body.csrfToken,
          typeof csrf?.value === "string" ? csrf.value : undefined,
        )
      ) {
        set.status = 403;
        return { success: false, message: "Invalid CSRF token or Origin" };
      }
      try {
        removeJob(String(user.id), params.jobId);
      } catch {
        return redirect(`${WEBROOT}/history?delete=failed`, 303);
      }
      return redirect(`${WEBROOT}/history`, 303);
    },
    { auth: true, body: t.Object({ csrfToken: t.String() }) },
  )
  .post(
    "/delete-multiple",
    ({ body, request, cookie: { csrf }, user, set }) => {
      if (
        !verifyCsrf(
          request,
          body.csrfToken,
          typeof csrf?.value === "string" ? csrf.value : undefined,
        )
      ) {
        set.status = 403;
        return { success: false, message: "Invalid CSRF token or Origin" };
      }
      if (body.jobIds.length === 0) {
        set.status = 400;
        return { success: false, message: "Invalid job IDs provided" };
      }

      const results = { success: [] as string[], failed: [] as string[] };
      for (const jobId of body.jobIds) {
        try {
          removeJob(String(user.id), jobId);
          results.success.push(jobId);
        } catch {
          results.failed.push(jobId);
        }
      }
      return {
        success: results.failed.length === 0,
        deleted: results.success.length,
        failed: results.failed.length,
        details: results,
      };
    },
    {
      auth: true,
      body: t.Object({ jobIds: t.Array(t.String(), { maxItems: 100 }), csrfToken: t.String() }),
    },
  );
