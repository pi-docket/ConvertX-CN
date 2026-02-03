/**
 * ConvertX-CN 記憶體生命週期管理器
 *
 * 三級記憶體管理策略：
 * - 等級一：確保所有資源可被 GC 回收（Garbage-Collectable）
 * - 等級二：任務結束時主動釋放資源（Explicit Cleanup）
 * - 等級三：任務隔離與硬回收（Hard Teardown / Isolation）
 *
 * ⚠️ 核心原則：
 * - 任務執行期間：記憶體無上限使用
 * - 任務結束後：所有可回收記憶體必須被釋放
 * - 禁止：memory cap / hard limit / 任務中斷
 * - 必須：lifecycle cleanup / 強制 teardown / context 隔離
 */

// @ts-check

// ==================== 等級一：可回收性管理 ====================

/**
 * Object URL 追蹤器
 * 追蹤所有建立的 Object URL，確保在任務結束時可以全部釋放
 */
class ObjectURLTracker {
  constructor() {
    /** @type {Map<string, {url: string, taskId: string|null, createdAt: number, description: string}>} */
    this.urls = new Map();
    /** @type {Map<string, Set<string>>} */
    this.taskUrls = new Map(); // taskId -> Set<url>
  }

  /**
   * 建立並追蹤 Object URL
   * @param {Blob|File|MediaSource} object
   * @param {string|null} taskId - 關聯的任務 ID
   * @param {string} description - 描述（用於除錯）
   * @returns {string}
   */
  create(object, taskId = null, description = "") {
    const url = URL.createObjectURL(object);
    this.urls.set(url, {
      url,
      taskId,
      createdAt: Date.now(),
      description,
    });

    if (taskId) {
      if (!this.taskUrls.has(taskId)) {
        this.taskUrls.set(taskId, new Set());
      }
      const taskUrlSet = this.taskUrls.get(taskId);
      if (taskUrlSet) {
        taskUrlSet.add(url);
      }
    }

    console.debug(`[MemoryLifecycle] ObjectURL created: ${description || url}`);
    return url;
  }

  /**
   * 釋放單個 Object URL
   * @param {string} url
   */
  revoke(url) {
    const info = this.urls.get(url);
    if (info) {
      URL.revokeObjectURL(url);
      this.urls.delete(url);

      if (info.taskId && this.taskUrls.has(info.taskId)) {
        const taskUrlSet = this.taskUrls.get(info.taskId);
        if (taskUrlSet) {
          taskUrlSet.delete(url);
        }
      }

      console.debug(`[MemoryLifecycle] ObjectURL revoked: ${info.description || url}`);
    }
  }

  /**
   * 釋放特定任務的所有 Object URL
   * @param {string} taskId
   * @returns {number} 釋放的數量
   */
  revokeByTask(taskId) {
    const urls = this.taskUrls.get(taskId);
    if (!urls) return 0;

    let count = 0;
    for (const url of urls) {
      URL.revokeObjectURL(url);
      this.urls.delete(url);
      count++;
    }

    this.taskUrls.delete(taskId);
    console.log(`[MemoryLifecycle] Revoked ${count} ObjectURLs for task ${taskId}`);
    return count;
  }

  /**
   * 釋放過期的 Object URL
   * 只釋放【無關聯任務】或【關聯任務已完成】的 URL
   * @param {number} maxAgeMs - 無任務關聯的 URL 最大存活時間（毫秒），預設 24 小時
   * @param {Set<string>|null} completedTaskIds - 已完成的任務 ID 集合
   * @returns {number} 釋放的數量
   */
  revokeExpired(maxAgeMs = 24 * 60 * 60 * 1000, completedTaskIds = null) {
    const now = Date.now();
    let count = 0;

    for (const [url, info] of this.urls) {
      // 有關聯任務的 URL：只有當任務已完成才清理
      if (info.taskId) {
        if (completedTaskIds && completedTaskIds.has(info.taskId)) {
          this.revoke(url);
          count++;
        }
        // 任務仍在執行中，不清理（無論多久）
        continue;
      }

      // 無任務關聯的 URL：超過 maxAgeMs 才清理
      if (now - info.createdAt > maxAgeMs) {
        this.revoke(url);
        count++;
      }
    }

    if (count > 0) {
      console.log(`[MemoryLifecycle] Revoked ${count} expired ObjectURLs`);
    }
    return count;
  }

  /**
   * 釋放所有 Object URL
   * @returns {number}
   */
  revokeAll() {
    const count = this.urls.size;
    for (const url of this.urls.keys()) {
      URL.revokeObjectURL(url);
    }
    this.urls.clear();
    this.taskUrls.clear();

    if (count > 0) {
      console.log(`[MemoryLifecycle] Revoked all ${count} ObjectURLs`);
    }
    return count;
  }

  /**
   * 取得統計資訊
   */
  getStats() {
    return {
      totalUrls: this.urls.size,
      taskCount: this.taskUrls.size,
      urlsByTask: Object.fromEntries(
        Array.from(this.taskUrls.entries()).map(([k, v]) => [k, v.size]),
      ),
    };
  }
}

/**
 * Blob/ArrayBuffer 參考追蹤器
 * 追蹤大型二進位資料的參考，確保可被釋放
 */
class BlobReferenceTracker {
  constructor() {
    /** @type {Map<string, {ref: WeakRef<Blob|ArrayBuffer>, taskId: string|null, sizeBytes: number, description: string}>} */
    this.references = new Map();
    this.nextId = 0;
  }

  /**
   * 追蹤 Blob 或 ArrayBuffer
   * @param {Blob|ArrayBuffer} data
   * @param {string|null} taskId
   * @param {string} description
   * @returns {string} 追蹤 ID
   */
  track(data, taskId = null, description = "") {
    const id = `blob_${++this.nextId}`;
    const sizeBytes = data instanceof Blob ? data.size : data.byteLength;

    // 使用 WeakRef 避免阻止 GC
    this.references.set(id, {
      ref: new WeakRef(data),
      taskId,
      sizeBytes,
      description,
    });

    console.debug(
      `[MemoryLifecycle] Blob tracked: ${description} (${(sizeBytes / 1024 / 1024).toFixed(2)} MB)`,
    );
    return id;
  }

  /**
   * 取消追蹤
   * @param {string} id
   */
  untrack(id) {
    this.references.delete(id);
  }

  /**
   * 清理已被 GC 回收的參考
   * @returns {number} 清理的數量
   */
  cleanup() {
    let count = 0;
    for (const [id, info] of this.references) {
      if (info.ref.deref() === undefined) {
        this.references.delete(id);
        count++;
      }
    }
    if (count > 0) {
      console.debug(`[MemoryLifecycle] Cleaned up ${count} GC'd blob references`);
    }
    return count;
  }

  /**
   * 取得仍存活的參考統計
   */
  getStats() {
    let aliveCount = 0;
    let aliveSizeBytes = 0;
    /** @type {Record<string, number>} */
    const byTask = {};

    for (const [id, info] of this.references) {
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
 * 任務上下文
 * 封裝單個任務的所有資源
 */
class TaskContext {
  /**
   * @param {string} taskId
   * @param {string} taskType - 任務類型（upload, convert, download）
   */
  constructor(taskId, taskType) {
    this.taskId = taskId;
    this.taskType = taskType;
    this.createdAt = Date.now();
    this.status = "pending"; // pending, running, completed, failed, aborted

    /** @type {Set<string>} */
    this.objectUrls = new Set();
    /** @type {Set<string>} */
    this.blobRefs = new Set();
    /** @type {Array<{element: HTMLElement, handler: EventListener, event: string}>} */
    this.eventListeners = [];
    /** @type {Set<number>} */
    this.timers = new Set();
    /** @type {Set<number>} */
    this.intervals = new Set();
    /** @type {Set<Worker>} */
    this.workers = new Set();
    /** @type {Map<string, any>} */
    this.customResources = new Map();
    /** @type {Array<() => void|Promise<void>>} */
    this.cleanupCallbacks = [];
  }

  /**
   * 註冊 Object URL
   * @param {string} url
   */
  registerObjectUrl(url) {
    this.objectUrls.add(url);
  }

  /**
   * 註冊事件監聽器（用於自動清理）
   * @param {HTMLElement} element
   * @param {string} event
   * @param {EventListener} handler
   */
  registerEventListener(element, event, handler) {
    element.addEventListener(event, handler);
    this.eventListeners.push({ element, event, handler });
  }

  /**
   * 註冊定時器
   * @param {number} timerId
   */
  registerTimer(timerId) {
    this.timers.add(timerId);
  }

  /**
   * 註冊間隔器
   * @param {number} intervalId
   */
  registerInterval(intervalId) {
    this.intervals.add(intervalId);
  }

  /**
   * 註冊 Worker
   * @param {Worker} worker
   */
  registerWorker(worker) {
    this.workers.add(worker);
  }

  /**
   * 註冊自訂資源
   * @param {string} key
   * @param {any} resource
   */
  registerCustomResource(key, resource) {
    this.customResources.set(key, resource);
  }

  /**
   * 註冊清理回調
   * @param {() => void|Promise<void>} callback
   */
  onCleanup(callback) {
    this.cleanupCallbacks.push(callback);
  }

  /**
   * 執行完整清理
   */
  async cleanup() {
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

    // 2. 釋放 Object URLs
    for (const url of this.objectUrls) {
      try {
        URL.revokeObjectURL(url);
      } catch (e) {
        console.warn(`[MemoryLifecycle] Failed to revoke URL:`, e);
      }
    }
    this.objectUrls.clear();

    // 3. 移除事件監聽器
    for (const { element, event, handler } of this.eventListeners) {
      try {
        element.removeEventListener(event, handler);
      } catch (e) {
        console.warn(`[MemoryLifecycle] Failed to remove listener:`, e);
      }
    }
    this.eventListeners = [];

    // 4. 清除定時器
    for (const timerId of this.timers) {
      clearTimeout(timerId);
    }
    this.timers.clear();

    // 5. 清除間隔器
    for (const intervalId of this.intervals) {
      clearInterval(intervalId);
    }
    this.intervals.clear();

    // 6. 終止 Workers（等級三：硬回收）
    for (const worker of this.workers) {
      try {
        worker.terminate();
      } catch (e) {
        console.warn(`[MemoryLifecycle] Failed to terminate worker:`, e);
      }
    }
    this.workers.clear();

    // 7. 清除自訂資源
    this.customResources.clear();

    this.status = "cleaned";
    this.completedAt = Date.now();
    console.log(`[MemoryLifecycle] Task ${this.taskId} cleanup complete`);
  }
}

/**
 * 任務管理器
 * 管理所有任務的生命週期
 */
class TaskLifecycleManager {
  constructor() {
    /** @type {Map<string, TaskContext>} */
    this.tasks = new Map();
    /** @type {Map<string, TaskContext>} */
    this.completedTasks = new Map(); // 短暫保留已完成任務用於除錯
    this.nextTaskId = 0;

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
   * @param {string} taskType
   * @returns {TaskContext}
   */
  createTask(taskType) {
    const taskId = `task_${++this.nextTaskId}_${Date.now()}`;
    const context = new TaskContext(taskId, taskType);
    this.tasks.set(taskId, context);
    console.log(`[MemoryLifecycle] Task created: ${taskId} (${taskType})`);
    return context;
  }

  /**
   * 取得任務上下文
   * @param {string} taskId
   * @returns {TaskContext|undefined}
   */
  getTask(taskId) {
    return this.tasks.get(taskId);
  }

  /**
   * 標記任務開始
   * @param {string} taskId
   */
  startTask(taskId) {
    const task = this.tasks.get(taskId);
    if (task) {
      task.status = "running";
    }
  }

  /**
   * 完成任務並清理
   * @param {string} taskId
   * @param {"completed"|"failed"|"aborted"} status
   */
  async finishTask(taskId, status = "completed") {
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
   * @param {number} maxAgeMs - 最大保留時間，預設 1 小時
   */
  cleanupCompletedTasks(maxAgeMs = 60 * 60 * 1000) {
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
   * @returns {Set<string>}
   */
  getCompletedTaskIds() {
    return new Set(this.completedTasks.keys());
  }

  /**
   * 強制清理所有任務（緊急用）
   */
  async forceCleanupAll() {
    console.warn(`[MemoryLifecycle] Force cleaning all ${this.tasks.size} tasks`);

    for (const [taskId, task] of this.tasks) {
      await task.cleanup();
    }

    this.tasks.clear();
    this.completedTasks.clear();
  }

  /**
   * 取得統計資訊
   */
  getStats() {
    /** @type {Record<string, number>} */
    const activeByType = {};
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
  destroy() {
    clearInterval(this.cleanupInterval);
    this.forceCleanupAll();
  }
}

// ==================== 等級三：記憶體監控與硬回收 ====================

/**
 * 記憶體監控器
 * 監控記憶體使用情況並在必要時觸發硬回收
 */
class MemoryMonitor {
  constructor() {
    this.isMonitoring = false;
    this.monitorInterval = null;
    this.highWaterMark = 0;
    this.baselineMemory = 0;

    /** @type {Array<{timestamp: number, usedJSHeapSize: number}>} */
    this.memoryHistory = [];
    this.maxHistoryLength = 60; // 保留最近 60 個樣本

    /** @type {Array<(memoryInfo: MemoryInfo) => void>} */
    this.onHighMemoryCallbacks = [];
  }

  /**
   * @typedef {Object} MemoryInfo
   * @property {number} usedJSHeapSize
   * @property {number} totalJSHeapSize
   * @property {number} jsHeapSizeLimit
   * @property {number} usedMB
   * @property {number} totalMB
   * @property {number} limitMB
   * @property {number} usagePercent
   */

  /**
   * 取得目前記憶體狀態
   * @returns {MemoryInfo|null}
   */
  getMemoryInfo() {
    // @ts-ignore - performance.memory is non-standard but available in Chrome
    const memory = typeof performance !== "undefined" ? performance.memory : null;
    if (memory) {
      return {
        usedJSHeapSize: memory.usedJSHeapSize,
        totalJSHeapSize: memory.totalJSHeapSize,
        jsHeapSizeLimit: memory.jsHeapSizeLimit,
        usedMB: Math.round(memory.usedJSHeapSize / 1024 / 1024),
        totalMB: Math.round(memory.totalJSHeapSize / 1024 / 1024),
        limitMB: Math.round(memory.jsHeapSizeLimit / 1024 / 1024),
        usagePercent: Math.round((memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100),
      };
    }
    return null;
  }

  /**
   * 開始監控
   * @param {number} intervalMs - 監控間隔（毫秒）
   */
  startMonitoring(intervalMs = 10000) {
    if (this.isMonitoring) return;

    const initialMemory = this.getMemoryInfo();
    if (initialMemory) {
      this.baselineMemory = initialMemory.usedJSHeapSize;
    }

    this.isMonitoring = true;
    this.monitorInterval = setInterval(() => {
      this.recordMemorySample();
    }, intervalMs);

    console.log(`[MemoryLifecycle] Memory monitoring started (interval: ${intervalMs}ms)`);
  }

  /**
   * 停止監控
   */
  stopMonitoring() {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
    this.isMonitoring = false;
    console.log("[MemoryLifecycle] Memory monitoring stopped");
  }

  /**
   * 記錄記憶體樣本
   */
  recordMemorySample() {
    const info = this.getMemoryInfo();
    if (!info) return;

    this.memoryHistory.push({
      timestamp: Date.now(),
      usedJSHeapSize: info.usedJSHeapSize,
    });

    // 保持歷史長度
    if (this.memoryHistory.length > this.maxHistoryLength) {
      this.memoryHistory.shift();
    }

    // 更新高水位
    if (info.usedJSHeapSize > this.highWaterMark) {
      this.highWaterMark = info.usedJSHeapSize;
    }

    // 檢查是否需要觸發高記憶體警告
    // 注意：這不是限制，只是通知，讓系統可以主動清理
    if (info.usagePercent > 70) {
      this.triggerHighMemoryWarning(info);
    }
  }

  /**
   * 觸發高記憶體警告
   * @param {MemoryInfo} info
   */
  triggerHighMemoryWarning(info) {
    console.warn(
      `[MemoryLifecycle] High memory usage detected: ${info.usedMB}MB (${info.usagePercent}%)`,
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
   * @param {(memoryInfo: MemoryInfo) => void} callback
   */
  onHighMemory(callback) {
    this.onHighMemoryCallbacks.push(callback);
  }

  /**
   * 檢查記憶體是否已回落到基線
   * @param {number} tolerancePercent - 容許百分比
   * @returns {boolean}
   */
  isMemoryNearBaseline(tolerancePercent = 150) {
    const info = this.getMemoryInfo();
    if (!info || this.baselineMemory === 0) return true;

    const ratio = info.usedJSHeapSize / this.baselineMemory;
    return ratio <= tolerancePercent / 100;
  }

  /**
   * 取得記憶體趨勢
   * @returns {"rising"|"stable"|"falling"|"unknown"}
   */
  getMemoryTrend() {
    if (this.memoryHistory.length < 5) return "unknown";

    const recent = this.memoryHistory.slice(-5);
    const first = recent[0].usedJSHeapSize;
    const last = recent[recent.length - 1].usedJSHeapSize;
    const diff = last - first;
    const threshold = first * 0.1; // 10% 變化視為顯著

    if (diff > threshold) return "rising";
    if (diff < -threshold) return "falling";
    return "stable";
  }

  /**
   * 取得統計資訊
   */
  getStats() {
    const info = this.getMemoryInfo();
    return {
      current: info,
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
 * 整合所有等級的記憶體管理功能
 */
class MemoryLifecycleManager {
  constructor() {
    // 等級一：資源追蹤
    this.objectURLTracker = new ObjectURLTracker();
    this.blobTracker = new BlobReferenceTracker();

    // 等級二：任務生命週期
    this.taskManager = new TaskLifecycleManager();

    // 等級三：記憶體監控
    this.memoryMonitor = new MemoryMonitor();

    // 設置高記憶體時的自動清理
    this.memoryMonitor.onHighMemory((info) => {
      this.performEmergencyCleanup(info);
    });

    // 定期清理過期資源
    this.maintenanceInterval = setInterval(
      () => {
        this.performMaintenance();
      },
      5 * 60 * 1000,
    ); // 每 5 分鐘

    console.log("[MemoryLifecycle] Memory Lifecycle Manager initialized");
  }

  // ==================== 等級一 API ====================

  /**
   * 建立追蹤的 Object URL
   * @param {Blob|File|MediaSource} object
   * @param {string|null} taskId
   * @param {string} description
   * @returns {string}
   */
  createObjectURL(object, taskId = null, description = "") {
    const url = this.objectURLTracker.create(object, taskId, description);

    // 如果有任務上下文，也註冊到任務
    if (taskId) {
      const task = this.taskManager.getTask(taskId);
      if (task) {
        task.registerObjectUrl(url);
      }
    }

    return url;
  }

  /**
   * 釋放 Object URL
   * @param {string} url
   */
  revokeObjectURL(url) {
    this.objectURLTracker.revoke(url);
  }

  /**
   * 追蹤 Blob/ArrayBuffer
   * @param {Blob|ArrayBuffer} data
   * @param {string|null} taskId
   * @param {string} description
   * @returns {string}
   */
  trackBlob(data, taskId = null, description = "") {
    const id = this.blobTracker.track(data, taskId, description);

    if (taskId) {
      const task = this.taskManager.getTask(taskId);
      if (task) {
        task.blobRefs.add(id);
      }
    }

    return id;
  }

  // ==================== 等級二 API ====================

  /**
   * 建立任務上下文
   * @param {string} taskType
   * @returns {TaskContext}
   */
  createTask(taskType) {
    return this.taskManager.createTask(taskType);
  }

  /**
   * 開始任務
   * @param {string} taskId
   */
  startTask(taskId) {
    this.taskManager.startTask(taskId);
  }

  /**
   * 完成任務並清理所有資源
   * @param {string} taskId
   * @param {"completed"|"failed"|"aborted"} status
   */
  async finishTask(taskId, status = "completed") {
    // 先釋放該任務的 Object URLs
    this.objectURLTracker.revokeByTask(taskId);

    // 然後清理任務上下文
    await this.taskManager.finishTask(taskId, status);

    // 清理已被 GC 的 Blob 參考
    this.blobTracker.cleanup();
  }

  // ==================== 等級三 API ====================

  /**
   * 開始記憶體監控
   */
  startMemoryMonitoring() {
    this.memoryMonitor.startMonitoring();
  }

  /**
   * 停止記憶體監控
   */
  stopMemoryMonitoring() {
    this.memoryMonitor.stopMonitoring();
  }

  /**
   * 執行緊急清理（高記憶體時自動觸發）
   * ⚠️ 重要：只清理已完成任務的資源，不影響執行中的任務
   * @param {object} memoryInfo
   */
  performEmergencyCleanup(memoryInfo) {
    console.warn("[MemoryLifecycle] Performing emergency cleanup due to high memory");

    // 取得已完成任務的 ID
    const completedTaskIds = this.taskManager.getCompletedTaskIds();

    // 1. 只釋放已完成任務的 Object URLs（不影響執行中任務）
    this.objectURLTracker.revokeExpired(24 * 60 * 60 * 1000, completedTaskIds);

    // 2. 清理已被 GC 的 Blob 參考
    this.blobTracker.cleanup();

    // 3. 清理已完成的任務快取（縮短保留時間到 10 分鐘）
    this.taskManager.cleanupCompletedTasks(10 * 60 * 1000);

    // 4. 請求 GC（如果可用）
    this.requestGarbageCollection();

    console.log(
      `[MemoryLifecycle] Emergency cleanup complete. Active tasks: ${this.taskManager.tasks.size}`,
    );
  }

  /**
   * 執行定期維護
   * ⚠️ 重要：只清理已完成任務的資源，執行中的任務不受影響（即使超過 24 小時）
   */
  performMaintenance() {
    console.debug("[MemoryLifecycle] Performing scheduled maintenance");

    // 取得已完成任務的 ID
    const completedTaskIds = this.taskManager.getCompletedTaskIds();

    // 只釋放【無任務關聯且超過 24 小時】或【任務已完成】的 Object URLs
    this.objectURLTracker.revokeExpired(24 * 60 * 60 * 1000, completedTaskIds);

    // 清理已被 GC 的 Blob 參考
    this.blobTracker.cleanup();

    // 清理已完成的任務快取（保留 1 小時）
    this.taskManager.cleanupCompletedTasks();

    console.debug(
      `[MemoryLifecycle] Maintenance complete. Active tasks: ${this.taskManager.tasks.size}`,
    );
  }

  /**
   * 請求垃圾回收（如果可用）
   */
  requestGarbageCollection() {
    // @ts-ignore - gc() is only available with --expose-gc flag
    if (typeof gc === "function") {
      console.log("[MemoryLifecycle] Requesting garbage collection");
      gc();
    }
  }

  /**
   * 執行完整清理（用於頁面卸載或重置）
   */
  async performFullCleanup() {
    console.log("[MemoryLifecycle] Performing full cleanup");

    // 清理所有任務
    await this.taskManager.forceCleanupAll();

    // 釋放所有 Object URLs
    this.objectURLTracker.revokeAll();

    // 清理 Blob 追蹤
    this.blobTracker.cleanup();

    // 請求 GC
    this.requestGarbageCollection();
  }

  // ==================== 診斷 API ====================

  /**
   * 取得完整狀態報告
   */
  getFullReport() {
    return {
      objectURLs: this.objectURLTracker.getStats(),
      blobs: this.blobTracker.getStats(),
      tasks: this.taskManager.getStats(),
      memory: this.memoryMonitor.getStats(),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 輸出診斷報告到控制台
   */
  printDiagnostics() {
    const report = this.getFullReport();
    console.group("[MemoryLifecycle] Diagnostics Report");
    console.log("Object URLs:", report.objectURLs);
    console.log("Blob References:", report.blobs);
    console.log("Tasks:", report.tasks);
    console.log("Memory:", report.memory);
    console.groupEnd();
    return report;
  }

  /**
   * 銷毀管理器
   */
  destroy() {
    this.stopMemoryMonitoring();
    clearInterval(this.maintenanceInterval);
    this.performFullCleanup();
  }
}

// ==================== 全域實例 ====================

// 建立全域實例
const memoryLifecycle = new MemoryLifecycleManager();

// 頁面卸載時清理
window.addEventListener("beforeunload", () => {
  memoryLifecycle.performFullCleanup();
});

// 頁面隱藏時（切換標籤）執行輕量清理
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    memoryLifecycle.performMaintenance();
  }
});

// 自動開始記憶體監控
memoryLifecycle.startMemoryMonitoring();

// 導出全域 API
// @ts-ignore - Dynamic window property assignment
window.MemoryLifecycle = memoryLifecycle;

// 便捷函數
/**
 * @param {Blob|File|MediaSource} object
 * @param {string|null} [taskId]
 * @param {string} [description]
 * @returns {string}
 */
// @ts-ignore - Dynamic window property assignment
window.createTrackedObjectURL = (object, taskId, description) =>
  memoryLifecycle.createObjectURL(object, taskId, description);

/**
 * @param {string} url
 */
// @ts-ignore - Dynamic window property assignment
window.revokeTrackedObjectURL = (url) => memoryLifecycle.revokeObjectURL(url);

/**
 * @param {string} taskType
 * @returns {TaskContext}
 */
// @ts-ignore - Dynamic window property assignment
window.createMemoryTask = (taskType) => memoryLifecycle.createTask(taskType);

/**
 * @param {string} taskId
 * @param {"completed"|"failed"|"aborted"} [status]
 */
// @ts-ignore - Dynamic window property assignment
window.finishMemoryTask = (taskId, status) => memoryLifecycle.finishTask(taskId, status);

// @ts-ignore - Dynamic window property assignment
window.getMemoryDiagnostics = () => memoryLifecycle.printDiagnostics();

console.log("[MemoryLifecycle] Module loaded. Use window.MemoryLifecycle for access.");
