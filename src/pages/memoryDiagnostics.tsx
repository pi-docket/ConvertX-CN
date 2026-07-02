import { Elysia, t } from "elysia";
import { verifyCsrf } from "../helpers/csrf";
import { memoryLifecycle, getMemoryReport, requestGC } from "../helpers/memoryLifecycle";
import { userService } from "./user";

const diagnosticAdminIds = new Set(
  (process.env.MEMORY_DIAGNOSTICS_ADMIN_USER_IDS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
);

function canMutateDiagnostics(userId: string | number): boolean {
  return diagnosticAdminIds.has(String(userId));
}

const csrfBody = t.Object({
  csrf_token: t.String({ minLength: 16, maxLength: 256 }),
});

export const memoryDiagnostics = new Elysia()
  .use(userService)
  .get("/api/memory/report", () => ({ success: true, data: getMemoryReport() }), { auth: true })
  .post(
    "/api/memory/gc",
    async ({ body, request, cookie: { csrf }, user, set }) => {
      if (
        !canMutateDiagnostics(user.id) ||
        !verifyCsrf(
          request,
          body.csrf_token,
          typeof csrf?.value === "string" ? csrf.value : undefined,
        )
      ) {
        set.status = 403;
        return { success: false, message: "Diagnostics administrator access required" };
      }
      const before = getMemoryReport();
      const gcTriggered = requestGC();
      await new Promise((resolve) => setTimeout(resolve, 100));
      const after = getMemoryReport();
      return {
        success: true,
        gcTriggered,
        before: before.memory.current,
        after: after.memory.current,
      };
    },
    { auth: true, body: csrfBody },
  )
  .post(
    "/api/memory/cleanup",
    async ({ body, request, cookie: { csrf }, user, set }) => {
      if (
        !canMutateDiagnostics(user.id) ||
        !verifyCsrf(
          request,
          body.csrf_token,
          typeof csrf?.value === "string" ? csrf.value : undefined,
        )
      ) {
        set.status = 403;
        return { success: false, message: "Diagnostics administrator access required" };
      }
      const before = getMemoryReport();
      await memoryLifecycle.performFullCleanup();
      await new Promise((resolve) => setTimeout(resolve, 100));
      return { success: true, before, after: getMemoryReport() };
    },
    { auth: true, body: csrfBody },
  )
  .get(
    "/api/memory/trend",
    () => {
      const report = getMemoryReport();
      return {
        success: true,
        trend: report.memory.trend,
        isNearBaseline: report.memory.isNearBaseline,
        currentMB: report.memory.current.heapUsedMB,
        baselineMB: report.memory.baselineMB,
        highWaterMarkMB: report.memory.highWaterMarkMB,
      };
    },
    { auth: true },
  )
  .get(
    "/api/memory/health",
    () => {
      const report = getMemoryReport();
      const heapUsagePercent =
        (report.memory.current.heapUsed / (report.memory.current.heapTotal || 1)) * 100;
      return {
        healthy:
          heapUsagePercent < 80 &&
          report.memory.trend !== "rising" &&
          report.tasks.activeTasks < 100,
        heapUsedMB: report.memory.current.heapUsedMB,
        heapUsagePercent: Math.round(heapUsagePercent),
        activeTasks: report.tasks.activeTasks,
        trend: report.memory.trend,
        timestamp: report.timestamp,
      };
    },
    { auth: true },
  );
