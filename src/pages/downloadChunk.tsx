import { Elysia } from "elysia";
import { webActor } from "../application/actor";
import { artifactService } from "../application/artifactService";
import {
  createChunkDownloadHeaders,
  getChunk,
  getChunkDownloadInfo,
  shouldUseChunkedDownload,
} from "../transfer";
import { userService } from "./user";

function artifactPath(userId: string | number, jobId: string, fileName: string): string {
  return artifactService.completedArtifactPath(webActor(String(userId)), jobId, fileName);
}

export const downloadChunk = new Elysia()
  .use(userService)
  .get(
    "/download/:userId/:jobId/:fileName/info",
    ({ params, set, user }) => {
      try {
        const path = artifactPath(user.id, params.jobId, params.fileName);
        const info = getChunkDownloadInfo(path);
        if (!info) throw new Error("Artifact not found");
        return { ...info, use_chunked: shouldUseChunkedDownload(path) };
      } catch {
        set.status = 404;
        return { error: "File not found" };
      }
    },
    { auth: true },
  )
  .get(
    "/download/:userId/:jobId/:fileName/chunk/:chunkIndex",
    async ({ params, set, user }) => {
      try {
        const path = artifactPath(user.id, params.jobId, params.fileName);
        const info = getChunkDownloadInfo(path);
        const chunkIndex = Number.parseInt(params.chunkIndex, 10);
        if (!info || !Number.isSafeInteger(chunkIndex) || chunkIndex < 0) {
          throw new Error("Invalid chunk");
        }
        const chunkData = await getChunk(path, chunkIndex);
        if (!chunkData) throw new Error("Chunk not found");
        Object.assign(set.headers, createChunkDownloadHeaders(info, chunkIndex, chunkData));
        return new Response(chunkData);
      } catch {
        set.status = 404;
        return { error: "Chunk not found" };
      }
    },
    { auth: true },
  )
  .get(
    "/archive/:jobId/info",
    async ({ params, set, user }) => {
      try {
        const path = await artifactService.createJobArchive(webActor(user.id), params.jobId);
        const info = getChunkDownloadInfo(path);
        if (!info) throw new Error("Archive not found");
        return { ...info, use_chunked: shouldUseChunkedDownload(path) };
      } catch {
        set.status = 404;
        return { error: "Archive not found" };
      }
    },
    { auth: true },
  )
  .get(
    "/archive/:jobId/chunk/:chunkIndex",
    async ({ params, set, user }) => {
      try {
        const path = artifactService.archivePath(webActor(user.id), params.jobId);
        const info = getChunkDownloadInfo(path);
        const chunkIndex = Number.parseInt(params.chunkIndex, 10);
        if (!info || !Number.isSafeInteger(chunkIndex) || chunkIndex < 0) {
          throw new Error("Invalid chunk");
        }
        const chunkData = await getChunk(path, chunkIndex);
        if (!chunkData) throw new Error("Chunk not found");
        Object.assign(set.headers, createChunkDownloadHeaders(info, chunkIndex, chunkData));
        return new Response(chunkData);
      } catch {
        set.status = 404;
        return { error: "Chunk not found" };
      }
    },
    { auth: true },
  );
