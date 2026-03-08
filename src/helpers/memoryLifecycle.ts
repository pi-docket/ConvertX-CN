/**
 * ConvertX-CN 後端記憶體生命週期管理器
 *
 * 三級記憶體管理策略（後端版本）：
 * - 等級一：確保所有資源可被 GC 回收（WeakRef, FinalizationRegistry）
 * - 等級二：任務結束時主動釋放資源（Explicit Cleanup Hooks）
 * - 等級三：任務隔離與硬回收（Process Isolation, Hard Teardown）
 *
 * ⚠️ 核心原則：
 * - 任務執行期間：記憶體無上限使用
 * - 任務結束後：所有可回收記憶體必須被釋放
 * - 禁止：memory cap / hard limit / 任務中斷
 * - 必須：lifecycle cleanup / 強制 teardown / context 隔離
 */

import { rmSync, existsSync } from "node:fs";

// ==================== 等級一：可回收性管理 ====================

/**
 * Buffer 追蹤器
 * 使用 WeakRef 追蹤大型 Buffer，確保可被 GC 回收
 */
class BufferTracker {
  private references: Map<
    string,
    {
      ref: WeakRef<Buffer | ArrayBuffer>;
      taskId: string | null;
      sizeBytes: number;
      description: string;
      createdAt: number;
    }
  > = new Map();
  private nextId = 0;
  private registry: FinalizationRegistry<string>;

  constructor() {
    // 使用 FinalizationRegistry 追蹤被 GC 回收的 Buffer
    this.registry = new FinalizationRegistry((id: string) => {
      this.references.delete(id);
      console.debug(`[MemoryLifecycle] Buffer finalized: ${id}`);
    });
  }

  /**
   * 追蹤 Buffer
   */
  track(data: Buffer | ArrayBuffer, taskId: string | null = null, description = ""): string {
    const id = `buffer_${++this.nextId}`;
    const sizeBytes = data instanceof Buffer ? data.byteLength : data.byteLength;

    this.references.set(id, {
      ref: new WeakRef(data),
      taskId,
      sizeBytes,
      description,
      createdAt: Date.now(),
    });

    // 註冊到 FinalizationRegistry
    this.registry.register(data, id);

    console.debug(
      `[MemoryLifecycle] Buffer tracked: ${description} (${(sizeBytes / 1024 / 1024).toFixed(2)} MB)`,
    );
    return id;
  }

  /**
   * 取消追蹤
   */
  untrack(id: string): void {
    this.references.delete(id);
  }

  /**
   * 清理已被 GC 回收的參考
   */
  cleanup(): number {
    let count = 0;
    for (const [id, info] of this.references) {
      if (info.ref.deref() === undefined) {
        this.references.delete(id);
        count++;
      }
    }
    if (count > 0) {
      console.debug(`[MemoryLifecycle] Cleaned up ${count} GC'd buffer references`);
    }
    return count;
  }

  /**
   * 取得統計資訊
   */
  getStats(): {
    aliveCount: number;
    aliveSizeMB: string;
    byTask: Record<string, number>;
  } {
    let aliveCount = 0;
    let aliveSizeBytes = 0;
    const byTask: Record<string, number> = {};

    for (const [, info] of this.references) {
      if (info.ref.deref() !== undefined) {
        aliveCount++;
        aliveSizeBytes += info.sizeBytes;

        const taskKey = info.taskId || "no_task";
        byTask[taskKey] = (byTask[taskKey] || 0) + 1;
      }
    }

    return {
      aliveCount,
      aliveSizeMB: (aliveSizeBytes / 1024 / 1024).toFixed(2),
      byTask,
    };
  }
}

// ==================== 等級二：任務生命週期管理 ====================

/**
 * 清理回調類型
 */
type CleanupCallback = () => void | Promise<void>;

/**
 * 任務上下文
 */
class TaskContext {
  readonly taskId: string;
  readonly taskType: string;
  readonly createdAt: number;
  completedAt: number | null = null;
  status: "pending" | "running" | "completed" | "failed" | "aborted" | "cleaned" = "pending";

  private bufferRefs: Set<string> = new Set();
  private tempFiles: Set<string> = new Set();
  private tempDirs: Set<string> = new Set();
  private timers: Set<ReturnType<typeof setTimeout>> = new Set();
  private intervals: Set<ReturnType<typeof setInterval>> = new Set();
  private cleanupCallbacks: CleanupCallback[] = [];
  private customResources: Map<string, unknown> = new Map();

  constructor(taskId: string, taskType: string) {
    this.taskId = taskId;
    this.taskType = taskType;
    this.createdAt = Date.now();
  }

  /**
   * 註冊 Buffer 參考
   */
  registerBuffer(bufferId: string): void {
    this.bufferRefs.add(bufferId);
  }

  /**
   * 註冊暫存檔案
   */
  registerTempFile(filePath: string): void {
    this.tempFiles.add(filePath);
  }

  /**
   * 註冊暫存目錄
   */
  registerTempDir(dirPath: string): void {
    this.tempDirs.add(dirPath);
  }

  /**
   * 註冊定時器
   */
  registerTimer(timerId: ReturnType<typeof setTimeout>): void {
    this.timers.add(timerId);
  }

  /**
   * 註冊間隔器
   */
  registerInterval(intervalId: ReturnType<typeof setInterval>): void {
    this.intervals.add(intervalId);
  }

  /**
   * 註冊清理回調
   */
  onCleanup(callback: CleanupCallback): void {
    this.cleanupCallbacks.push(callback);
  }

  /**
   * 註冊自訂資源
   */
  registerCustomResource(key: string, resource: unknown): void {
    this.customResources.set(key, resource);
  }

  /**
   * 執行完整清理
   */
  async cleanup(): Promise<void> {
    console.log(`[MemoryLifecycle] Cleaning up task ${this.taskId} (${this.taskType})`);

    // 1. 執行自訂清理回調
    for (const callback of this.cleanupCallbacks) {
      try {
        await callback();
      } catch (e) {
        console.warn(`[MemoryLifecycle] Cleanup callback error:`, e);
      }
    }
    this.cleanupCallbacks = [];

    // 2. 清除定時器
    for (const timerId of this.timers) {
      clearTimeout(timerId);
    }
    this.timers.clear();

    // 3. 清除間隔器
    for (const intervalId of this.intervals) {
      clearInterval(intervalId);
    }
    this.intervals.clear();

    // 4. 刪除暫存檔案
    for (const filePath of this.tempFiles) {
      try {
        if (existsSync(filePath)) {
          rmSync(filePath, { force: true });
          console.debug(`[MemoryLifecycle] Deleted temp file: ${filePath}`);
        }
      } catch (e) {
        console.warn(`[MemoryLifecycle] Failed to delete temp file:`, e);
      }
    }
    this.tempFiles.clear();

    // 5. 刪除暫存目錄
    for (const dirPath of this.tempDirs) {
      try {
        if (existsSync(dirPath)) {
          rmSync(dirPath, { recursive: true, force: true });
          console.debug(`[MemoryLifecycle] Deleted temp dir: ${dirPath}`);
        }
      } catch (e) {
        console.warn(`[MemoryLifecycle] Failed to delete temp dir:`, e);
      }
    }
    this.tempDirs.clear();

    // 6. 清除 Buffer 參考
    this.bufferRefs.clear();

    // 7. 清除自訂資源
    this.customResources.clear();

    this.status = "cleaned";
    this.completedAt = Date.now();
    console.log(`[MemoryLifecycle] Task ${this.taskId} cleanup complete`);
  }
}

/**
 * 任務管理器
 */
class TaskLifecycleManager {
  private tasks: Map<string, TaskContext> = new Map();
  private completedTasks: Map<string, TaskContext> = new Map();
  private nextTaskId = 0;
  private cleanupInterval: ReturnType<typeof setInterval>;

  constructor() {
    // 定期清理已完成任務的參考（每 10 分鐘）
    this.cleanupInterval = setInterval(
      () => {
        this.cleanupCompletedTasks();
      },
      10 * 60 * 1000,
    );
  }

  /**
   * 建立新任務上下文
   */
  createTask(taskType: string): TaskContext {
    const taskId = `task_${++this.nextTaskId}_${Date.now()}`;
    const context = new TaskContext(taskId, taskType);
    this.tasks.set(taskId, context);
    console.log(`[MemoryLifecycle] Task created: ${taskId} (${taskType})`);
    return context;
  }

  /**
   * 取得任務上下文
   */
  getTask(taskId: string): TaskContext | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * 標記任務開始
   */
  startTask(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (task) {
      task.status = "running";
    }
  }

  /**
   * 完成任務並清理
   */
  async finishTask(
    taskId: string,
    status: "completed" | "failed" | "aborted" = "completed",
  ): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) return;

    task.status = status;

    // 執行清理
    await task.cleanup();

    // 從活動任務移除
    this.tasks.delete(taskId);

    // 短暫保留用於除錯
    this.completedTasks.set(taskId, task);

    console.log(`[MemoryLifecycle] Task finished: ${taskId} (${status})`);
  }

  /**
   * 清理過期的已完成任務
   * @param maxAgeMs - 最大保留時間，預設 1 小時
   */
  cleanupCompletedTasks(maxAgeMs: number = 60 * 60 * 1000): void {
    const now = Date.now();
    let count = 0;

    for (const [taskId, task] of this.completedTasks) {
      // 使用任務完成時間（如果有）或建立時間
      const completedAt = task.completedAt || task.createdAt;
      if (now - completedAt > maxAgeMs) {
        this.completedTasks.delete(taskId);
        count++;
      }
    }

    if (count > 0) {
      console.debug(`[MemoryLifecycle] Cleaned up ${count} completed task references`);
    }
  }

  /**
   * 取得已完成任務的 ID 集合
   */
  getCompletedTaskIds(): Set<string> {
    return new Set(this.completedTasks.keys());
  }

  /**
   * 強制清理所有任務
   */
  async forceCleanupAll(): Promise<void> {
    console.warn(`[MemoryLifecycle] Force cleaning all ${this.tasks.size} tasks`);

    for (const [, task] of this.tasks) {
      await task.cleanup();
    }

    this.tasks.clear();
    this.completedTasks.clear();
  }

  /**
   * 取得統計資訊
   */
  getStats(): {
    activeTasks: number;
    completedTasksInCache: number;
    activeByType: Record<string, number>;
  } {
    const activeByType: Record<string, number> = {};
    for (const task of this.tasks.values()) {
      activeByType[task.taskType] = (activeByType[task.taskType] || 0) + 1;
    }

    return {
      activeTasks: this.tasks.size,
      completedTasksInCache: this.completedTasks.size,
      activeByType,
    };
  }

  /**
   * 銷毀管理器
   */
  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.forceCleanupAll();
  }
}

// ==================== 等級三：記憶體監控與硬回收 ====================

/**
 * 記憶體資訊
 */
interface MemoryInfo {
  rss: number;
  heapTotal: number;
  heapUsed: number;
  external: number;
  arrayBuffers: number;
  rssMB: number;
  heapUsedMB: number;
  heapTotalMB: number;
}

/**
 * 記憶體監控器
 */
class MemoryMonitor {
  private isMonitoring = false;
  private monitorInterval: ReturnType<typeof setInterval> | null = null;
  private highWaterMark = 0;
  private baselineMemory = 0;
  private memoryHistory: Array<{ timestamp: number; heapUsed: number }> = [];
  private maxHistoryLength = 60;
  private onHighMemoryCallbacks: Array<(memoryInfo: MemoryInfo) => void> = [];

  /**
   * 取得目前記憶體狀態
   */
  getMemoryInfo(): MemoryInfo {
    const mem = process.memoryUsage();
    return {
      rss: mem.rss,
      heapTotal: mem.heapTotal,
      heapUsed: mem.heapUsed,
      external: mem.external,
      arrayBuffers: mem.arrayBuffers,
      rssMB: Math.round(mem.rss / 1024 / 1024),
      heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
      heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
    };
  }

  /**
   * 開始監控
   */
  startMonitoring(intervalMs = 10000): void {
    if (this.isMonitoring) return;

    const initialMemory = this.getMemoryInfo();
    this.baselineMemory = initialMemory.heapUsed;

    this.isMonitoring = true;
    this.monitorInterval = setInterval(() => {
      this.recordMemorySample();
    }, intervalMs);

    console.log(`[MemoryLifecycle] Memory monitoring started (interval: ${intervalMs}ms)`);
  }

  /**
   * 停止監控
   */
  stopMonitoring(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
    this.isMonitoring = false;
    console.log("[MemoryLifecycle] Memory monitoring stopped");
  }

  /**
   * 記錄記憶體樣本
   * 僅用於診斷與統計，不觸發任何破壞性清理動作
   */
  private recordMemorySample(): void {
    const info = this.getMemoryInfo();

    this.memoryHistory.push({
      timestamp: Date.now(),
      heapUsed: info.heapUsed,
    });

    // 保持歷史長度
    if (this.memoryHistory.length > this.maxHistoryLength) {
      this.memoryHistory.shift();
    }

    // 更新高水位
    if (info.heapUsed > this.highWaterMark) {
      this.highWaterMark = info.heapUsed;
    }

    // 使用 RSS 作為記憶體壓力指標（比 heapUsed/heapTotal 更可靠）
    // Bun 的 heapUsed 可能超過 heapTotal，造成誤判
    // 僅在 RSS 超過 512MB 時發出診斷警告（不觸發清理）
    const RSS_WARNING_THRESHOLD_MB = 512;
    if (info.rssMB > RSS_WARNING_THRESHOLD_MB) {
      this.triggerHighMemoryWarning(info);
    }
  }

  /**
   * 觸發高記憶體警告
   * 僅用於診斷記錄，不執行破壞性清理
   */
  private triggerHighMemoryWarning(info: MemoryInfo): void {
    console.debug(
      `[MemoryLifecycle] Memory diagnostic: RSS=${info.rssMB}MB, heap=${info.heapUsedMB}MB/${info.heapTotalMB}MB`,
    );

    for (const callback of this.onHighMemoryCallbacks) {
      try {
        callback(info);
      } catch (e) {
        console.warn("[MemoryLifecycle] High memory callback error:", e);
      }
    }
  }

  /**
   * 註冊高記憶體回調
   */
  onHighMemory(callback: (memoryInfo: MemoryInfo) => void): void {
    this.onHighMemoryCallbacks.push(callback);
  }

  /**
   * 檢查記憶體是否已回落到基線
   */
  isMemoryNearBaseline(tolerancePercent = 150): boolean {
    const info = this.getMemoryInfo();
    if (this.baselineMemory === 0) return true;

    const ratio = info.heapUsed / this.baselineMemory;
    return ratio <= tolerancePercent / 100;
  }

  /**
   * 取得記憶體趨勢
   */
  getMemoryTrend(): "rising" | "stable" | "falling" | "unknown" {
    if (this.memoryHistory.length < 5) return "unknown";

    const recent = this.memoryHistory.slice(-5);
    const firstItem = recent[0];
    const lastItem = recent[recent.length - 1];

    if (!firstItem || !lastItem) return "unknown";

    const first = firstItem.heapUsed;
    const last = lastItem.heapUsed;
    const diff = last - first;
    const threshold = first * 0.1; // 10% 變化視為顯著

    if (diff > threshold) return "rising";
    if (diff < -threshold) return "falling";
    return "stable";
  }

  /**
   * 請求垃圾回收
   */
  requestGarbageCollection(): boolean {
    if (typeof global.gc === "function") {
      console.log("[MemoryLifecycle] Requesting garbage collection");
      global.gc();
      return true;
    }
    console.debug("[MemoryLifecycle] GC not exposed. Run with --expose-gc to enable manual GC.");
    return false;
  }

  /**
   * 取得統計資訊
   */
  getStats(): {
    current: MemoryInfo;
    baselineMB: number;
    highWaterMarkMB: number;
    trend: string;
    isNearBaseline: boolean;
    sampleCount: number;
  } {
    return {
      current: this.getMemoryInfo(),
      baselineMB: Math.round(this.baselineMemory / 1024 / 1024),
      highWaterMarkMB: Math.round(this.highWaterMark / 1024 / 1024),
      trend: this.getMemoryTrend(),
      isNearBaseline: this.isMemoryNearBaseline(),
      sampleCount: this.memoryHistory.length,
    };
  }
}

// ==================== 全域記憶體生命週期管理器 ====================

/**
 * 全域記憶體生命週期管理器
 */
class MemoryLifecycleManager {
  private bufferTracker: BufferTracker;
  private taskManager: TaskLifecycleManager;
  private memoryMonitor: MemoryMonitor;
  private maintenanceInterval: ReturnType<typeof setInterval>;

  constructor() {
    this.bufferTracker = new BufferTracker();
    this.taskManager = new TaskLifecycleManager();
    this.memoryMonitor = new MemoryMonitor();

    // 診斷用記憶體監控回調（僅在無 active task 時執行非破壞性清理）
    this.memoryMonitor.onHighMemory((info) => {
      this.performSafeIdleCleanup(info);
    });

    // 定期維護
    this.maintenanceInterval = setInterval(
      () => {
        this.performMaintenance();
      },
      5 * 60 * 1000,
    ); // 每 5 分鐘
  }

  // ==================== 等級一 API ====================

  /**
   * 追蹤 Buffer
   */
  trackBuffer(data: Buffer | ArrayBuffer, taskId: string | null = null, description = ""): string {
    const id = this.bufferTracker.track(data, taskId, description);

    if (taskId) {
      const task = this.taskManager.getTask(taskId);
      if (task) {
        task.registerBuffer(id);
      }
    }

    return id;
  }

  // ==================== 等級二 API ====================

  /**
   * 建立任務上下文
   */
  createTask(taskType: string): TaskContext {
    return this.taskManager.createTask(taskType);
  }

  /**
   * 取得任務上下文
   */
  getTask(taskId: string): TaskContext | undefined {
    return this.taskManager.getTask(taskId);
  }

  /**
   * 開始任務
   */
  startTask(taskId: string): void {
    this.taskManager.startTask(taskId);
  }

  /**
   * 完成任務並清理所有資源
   */
  async finishTask(
    taskId: string,
    status: "completed" | "failed" | "aborted" = "completed",
  ): Promise<void> {
    await this.taskManager.finishTask(taskId, status);
    this.bufferTracker.cleanup();
  }

  // ==================== 等級三 API ====================

  /**
   * 開始記憶體監控
   */
  startMemoryMonitoring(): void {
    this.memoryMonitor.startMonitoring();
  }

  /**
   * 停止記憶體監控
   */
  stopMemoryMonitoring(): void {
    this.memoryMonitor.stopMonitoring();
  }

  /**
   * 安全的閒置清理（僅在無 active conversion task 時執行）
   *
   * 設計原則：
   * - 有 active conversion task 時：完全不執行任何清理
   * - 無 active task 時：僅清理已完成任務的殘留資源和已被 GC 回收的 buffer
   * - 絕不清理 running/pending 狀態的任務資源
   */
  private performSafeIdleCleanup(memoryInfo: MemoryInfo): void {
    const taskStats = this.taskManager.getStats();
    const activeTasks = taskStats.activeTasks;

    if (activeTasks > 0) {
      console.debug(
        `[MemoryLifecycle] Skipping idle cleanup: ${activeTasks} active task(s) ` +
          `(${JSON.stringify(taskStats.activeByType)}). ` +
          `RSS=${memoryInfo.rssMB}MB, heap=${memoryInfo.heapUsedMB}MB/${memoryInfo.heapTotalMB}MB`,
      );
      return;
    }

    console.debug(
      `[MemoryLifecycle] Performing safe idle cleanup (no active tasks). ` +
        `RSS=${memoryInfo.rssMB}MB`,
    );

    // 僅清理已被 GC 回收的 buffer 參考
    this.bufferTracker.cleanup();

    // 清理已完成的任務快取
    this.taskManager.cleanupCompletedTasks();

    // 請求 GC（僅在無 active task 時）
    this.memoryMonitor.requestGarbageCollection();
  }

  /**
   * 執行緊急清理（已棄用，保留介面相容）
   * @deprecated 請使用 performSafeIdleCleanup
   */
  performEmergencyCleanup(_memoryInfo: MemoryInfo): void {
    this.performSafeIdleCleanup(_memoryInfo);
  }

  /**
   * 執行定期維護
   */
  performMaintenance(): void {
    console.debug("[MemoryLifecycle] Performing scheduled maintenance");

    // 清理已被 GC 的 Buffer 參考
    this.bufferTracker.cleanup();

    // 清理已完成的任務快取
    this.taskManager.cleanupCompletedTasks();

    // 輸出統計
    const stats = this.getFullReport();
    console.debug(
      `[MemoryLifecycle] Stats: ${stats.memory.current.heapUsedMB}MB heap, ` +
        `${stats.tasks.activeTasks} active tasks, ` +
        `${stats.buffers.aliveCount} tracked buffers`,
    );
  }

  /**
   * 請求垃圾回收
   */
  requestGarbageCollection(): boolean {
    return this.memoryMonitor.requestGarbageCollection();
  }

  /**
   * 執行完整清理
   */
  async performFullCleanup(): Promise<void> {
    console.log("[MemoryLifecycle] Performing full cleanup");

    // 清理所有任務
    await this.taskManager.forceCleanupAll();

    // 清理 Buffer 追蹤
    this.bufferTracker.cleanup();

    // 請求 GC
    this.memoryMonitor.requestGarbageCollection();
  }

  // ==================== 診斷 API ====================

  /**
   * 取得完整狀態報告
   */
  getFullReport(): {
    buffers: ReturnType<BufferTracker["getStats"]>;
    tasks: ReturnType<TaskLifecycleManager["getStats"]>;
    memory: ReturnType<MemoryMonitor["getStats"]>;
    timestamp: string;
  } {
    return {
      buffers: this.bufferTracker.getStats(),
      tasks: this.taskManager.getStats(),
      memory: this.memoryMonitor.getStats(),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 輸出診斷報告
   */
  printDiagnostics(): ReturnType<MemoryLifecycleManager["getFullReport"]> {
    const report = this.getFullReport();
    console.log("[MemoryLifecycle] Diagnostics Report:");
    console.log("  Buffers:", JSON.stringify(report.buffers));
    console.log("  Tasks:", JSON.stringify(report.tasks));
    console.log("  Memory:", JSON.stringify(report.memory));
    return report;
  }

  /**
   * 銷毀管理器
   */
  destroy(): void {
    this.stopMemoryMonitoring();
    clearInterval(this.maintenanceInterval);
    this.performFullCleanup();
  }
}

// ==================== 全域實例 ====================

// 建立全域實例
export const memoryLifecycle = new MemoryLifecycleManager();

// 啟動記憶體監控
memoryLifecycle.startMemoryMonitoring();

// 進程退出時清理
process.on("beforeExit", () => {
  memoryLifecycle.performFullCleanup();
});

process.on("SIGTERM", () => {
  memoryLifecycle.destroy();
  process.exit(0);
});

process.on("SIGINT", () => {
  memoryLifecycle.destroy();
  process.exit(0);
});

// 導出類型和函數
export { TaskContext, MemoryInfo };

// 便捷函數
export const createTask = (taskType: string): TaskContext => memoryLifecycle.createTask(taskType);

export const startTask = (taskId: string): void => memoryLifecycle.startTask(taskId);

export const finishTask = (
  taskId: string,
  status: "completed" | "failed" | "aborted" = "completed",
): Promise<void> => memoryLifecycle.finishTask(taskId, status);

export const getMemoryReport = (): ReturnType<MemoryLifecycleManager["getFullReport"]> =>
  memoryLifecycle.getFullReport();

export const requestGC = (): boolean => memoryLifecycle.requestGarbageCollection();

console.log("[MemoryLifecycle] Backend module loaded. Memory monitoring active.");
