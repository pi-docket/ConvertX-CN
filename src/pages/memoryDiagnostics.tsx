/**
 * ConvertX-CN 記憶體診斷 API
 *
 * 提供記憶體狀態監控和診斷功能
 * 用於驗證記憶體生命週期管理的效果
 */

import { Elysia } from "elysia";
import { userService } from "./user";
import {
  memoryLifecycle,
  getMemoryReport,
  requestGC,
} from "../helpers/memoryLifecycle";
import { WEBROOT } from "../helpers/env";

export const memoryDiagnostics = new Elysia()
  .use(userService)
  /**
   * 取得記憶體狀態報告
   * GET /api/memory/report
   */
  .get(
    "/api/memory/report",
    async () => {
      const report = getMemoryReport();
      return {
        success: true,
        data: report,
        description: {
          buffers: "追蹤中的 Buffer/ArrayBuffer 統計",
          tasks: "活動中的任務統計",
          memory: "Node.js 記憶體使用狀態",
        },
      };
    },
    { auth: true }
  )
  /**
   * 請求手動垃圾回收
   * POST /api/memory/gc
   *
   * 注意：需要使用 --expose-gc 啟動 Node.js
   */
  .post(
    "/api/memory/gc",
    async () => {
      const beforeReport = getMemoryReport();
      const gcSuccess = requestGC();

      // 等待一小段時間讓 GC 完成
      await new Promise((resolve) => setTimeout(resolve, 100));

      const afterReport = getMemoryReport();

      return {
        success: true,
        gcTriggered: gcSuccess,
        before: {
          heapUsedMB: beforeReport.memory.current.heapUsedMB,
          rssMB: beforeReport.memory.current.rssMB,
        },
        after: {
          heapUsedMB: afterReport.memory.current.heapUsedMB,
          rssMB: afterReport.memory.current.rssMB,
        },
        freedMB: beforeReport.memory.current.heapUsedMB - afterReport.memory.current.heapUsedMB,
        note: gcSuccess
          ? "GC 已觸發，記憶體可能已釋放"
          : "GC 未啟用，請使用 --expose-gc 啟動 Node.js",
      };
    },
    { auth: true }
  )
  /**
   * 執行完整清理
   * POST /api/memory/cleanup
   *
   * 清理所有任務和追蹤的資源
   */
  .post(
    "/api/memory/cleanup",
    async () => {
      const beforeReport = getMemoryReport();

      await memoryLifecycle.performFullCleanup();

      // 等待一小段時間
      await new Promise((resolve) => setTimeout(resolve, 100));

      const afterReport = getMemoryReport();

      return {
        success: true,
        before: {
          activeTasks: beforeReport.tasks.activeTasks,
          trackedBuffers: beforeReport.buffers.aliveCount,
          heapUsedMB: beforeReport.memory.current.heapUsedMB,
        },
        after: {
          activeTasks: afterReport.tasks.activeTasks,
          trackedBuffers: afterReport.buffers.aliveCount,
          heapUsedMB: afterReport.memory.current.heapUsedMB,
        },
        message: "完整清理已執行",
      };
    },
    { auth: true }
  )
  /**
   * 記憶體趨勢分析
   * GET /api/memory/trend
   */
  .get(
    "/api/memory/trend",
    async () => {
      const report = getMemoryReport();

      return {
        success: true,
        trend: report.memory.trend,
        isNearBaseline: report.memory.isNearBaseline,
        currentMB: report.memory.current.heapUsedMB,
        baselineMB: report.memory.baselineMB,
        highWaterMarkMB: report.memory.highWaterMarkMB,
        analysis:
          report.memory.trend === "rising"
            ? "⚠️ 記憶體正在上升，可能需要檢查是否有洩漏"
            : report.memory.trend === "falling"
              ? "✅ 記憶體正在下降，GC 正常運作"
              : report.memory.trend === "stable"
                ? "📊 記憶體穩定"
                : "❓ 樣本不足，無法判斷趨勢",
        recommendation: !report.memory.isNearBaseline
          ? "記憶體高於基線，建議執行 /api/memory/cleanup 或 /api/memory/gc"
          : "記憶體在正常範圍內",
      };
    },
    { auth: true }
  )
  /**
   * 記憶體健康檢查（簡化版，用於監控）
   * GET /api/memory/health
   */
  .get("/api/memory/health", async () => {
    const report = getMemoryReport();
    const heapUsagePercent =
      (report.memory.current.heapUsed / (report.memory.current.heapTotal || 1)) * 100;

    const isHealthy =
      heapUsagePercent < 80 &&
      report.memory.trend !== "rising" &&
      report.tasks.activeTasks < 100;

    return {
      healthy: isHealthy,
      heapUsedMB: report.memory.current.heapUsedMB,
      heapUsagePercent: Math.round(heapUsagePercent),
      activeTasks: report.tasks.activeTasks,
      trend: report.memory.trend,
      timestamp: report.timestamp,
    };
  });
