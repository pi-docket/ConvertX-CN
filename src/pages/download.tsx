import { Elysia } from "elysia";
import { webActor } from "../application/actor";
import { artifactService } from "../application/artifactService";
import { userService } from "./user";

export const download = new Elysia()
  .use(userService)
  .get(
    "/download/:userId/:jobId/:fileName",
    ({ params, set, user }) => {
      try {
        const filePath = artifactService.completedArtifactPath(
          webActor(user.id),
          params.jobId,
          params.fileName,
        );
        return Bun.file(filePath);
      } catch {
        set.status = 404;
        return { error: "File not found" };
      }
    },
    { auth: true },
  )
  .get(
    "/archive/:jobId",
    async ({ params, set, user }) => {
      try {
        const path = await artifactService.createJobArchive(webActor(user.id), params.jobId);
        return Bun.file(path);
      } catch {
        set.status = 404;
        return { error: "Archive not found" };
      }
    },
    { auth: true },
  );
