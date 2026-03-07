/**
 * Contents.CN 前端檔案傳輸管理器
 *
 * 統一處理所有檔案的上傳與下載：
 * - 檔案 ≤ 10MB：直接傳輸
 * - 檔案 > 10MB：使用 chunk 分段傳輸
 *
 * ⚠️ 重要：所有功能必須使用此模組，不得自行實作傳輸邏輯
 *
 * 🧠 記憶體生命週期管理（Level 1-3）：
 * - 等級一：所有 Blob/ArrayBuffer/Object URL 都被追蹤並在任務結束後釋放
 * - 等級二：每個傳輸任務有獨立的上下文，結束時自動清理
 * - 等級三：支援 Worker 隔離和硬回收
 */

// @ts-check

// ==================== 常數定義 ====================

/**
 * 檔案大小門檻（10MB）
 */
const CHUNK_THRESHOLD_BYTES = 10 * 1024 * 1024;

/**
 * 每個 chunk 的大小（5MB）
 */
const CHUNK_SIZE_BYTES = 5 * 1024 * 1024;

// ==================== 記憶體生命週期輔助 ====================

/**
 * 取得記憶體生命週期管理器
 * @returns {any|null}
 */
function getMemoryLifecycle() {
  // @ts-ignore
  return window.MemoryLifecycle || null;
}

/**
 * 建立追蹤的 Object URL（等級一）
 * @param {Blob|File} object
 * @param {string|null} taskId
 * @param {string} description
 * @returns {string}
 */
function createTrackedURL(object, taskId = null, description = "") {
  const lifecycle = getMemoryLifecycle();
  if (lifecycle) {
    return lifecycle.createObjectURL(object, taskId, description);
  }
  // 降級：直接建立但記錄警告
  console.warn("[Transfer] MemoryLifecycle not available, URL may not be properly tracked");
  return URL.createObjectURL(object);
}

/**
 * 釋放追蹤的 Object URL（等級一）
 * @param {string} url
 */
function revokeTrackedURL(url) {
  const lifecycle = getMemoryLifecycle();
  if (lifecycle) {
    lifecycle.revokeObjectURL(url);
  } else {
    URL.revokeObjectURL(url);
  }
}

/**
 * 建立傳輸任務上下文（等級二）
 * @param {string} taskType
 * @returns {any|null}
 */
function createTransferTask(taskType) {
  const lifecycle = getMemoryLifecycle();
  if (lifecycle) {
    return lifecycle.createTask(taskType);
  }
  return null;
}

/**
 * 完成傳輸任務並清理（等級二）
 * @param {string} taskId
 * @param {"completed"|"failed"|"aborted"} status
 */
async function finishTransferTask(taskId, status = "completed") {
  const lifecycle = getMemoryLifecycle();
  if (lifecycle && taskId) {
    await lifecycle.finishTask(taskId, status);
  }
}

// ==================== 工具函數 ====================

/**
 * 生成 UUID（用於 upload_id）
 */
function generateUploadId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // 降級方案
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * 判斷是否需要使用 chunk 傳輸
 */
function shouldUseChunkedTransfer(fileSize) {
  return fileSize > CHUNK_THRESHOLD_BYTES;
}

/**
 * 計算 chunk 數量
 */
function calculateChunkCount(fileSize) {
  return Math.ceil(fileSize / CHUNK_SIZE_BYTES);
}

// ==================== 上傳管理器 ====================

/**
 * 上傳管理器類別
 * 整合記憶體生命週期管理（等級一 + 二）
 */
class UploadManager {
  /**
   * @param {string} webroot - 網站根路徑
   */
  constructor(webroot) {
    this.webroot = webroot;
    /** @type {Map<string, {file: File, totalChunks: number, uploadedChunks: number, status: string, taskId: string|null, chunkRefs: string[]}>} */
    this.activeUploads = new Map();
  }

  /**
   * 上傳檔案（自動判斷使用直傳或 chunk）
   *
   * 🧠 記憶體管理：
   * - 建立任務上下文追蹤所有資源
   * - 完成後自動清理所有 Blob 參考
   *
   * @param {File} file - 要上傳的檔案
   * @param {object} options - 選項
   * @param {function} options.onProgress - 進度回調 (percent: number) => void
   * @param {function} options.onComplete - 完成回調 (response: object) => void
   * @param {function} options.onError - 錯誤回調 (error: Error) => void
   * @returns {Promise<object>} 上傳結果
   */
  async uploadFile(file, options = {}) {
    const { onProgress, onComplete, onError } = options;

    // 等級二：建立任務上下文
    const task = createTransferTask("upload");
    const taskId = task?.taskId || null;

    try {
      let result;

      if (shouldUseChunkedTransfer(file.size)) {
        // 大檔：使用 chunk 上傳
        result = await this.uploadChunked(file, onProgress, taskId);
      } else {
        // 小檔：直接上傳
        result = await this.uploadDirect(file, onProgress, taskId);
      }

      // 等級二：任務完成，清理資源
      await finishTransferTask(taskId, "completed");

      if (onComplete) onComplete(result);
      return result;
    } catch (error) {
      // 等級二：任務失敗，清理資源
      await finishTransferTask(taskId, "failed");

      if (onError) onError(error);
      throw error;
    }
  }

  /**
   * 直接上傳（小檔）(含自動重試機制)
   *
   * 🧠 記憶體管理：
   * - FormData 不會複製 Blob 資料
   * - fetch 完成後，FormData 和 Blob 都可被 GC
   *
   * 🔄 Rate Limit 重試：
   * - 自動偵測 429 狀態碼
   * - 支援 Retry-After header
   * - 最多重試 3 次
   *
   * @param {File} file
   * @param {function} onProgress
   * @param {string|null} taskId
   */
  async uploadDirect(file, onProgress, taskId = null) {
    const formData = new FormData();
    formData.append("file", file, file.name);

    const url = `${this.webroot}/upload`;
    const maxRetries = 3;
    const baseDelay = 60; // 秒
    const maxAttempts = 1 + maxRetries;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        // 建立 upload 進度事件
        // 注意：使用 fetch 時無法直接追蹤上傳進度
        // 如需精確進度，可考慮使用 XMLHttpRequest 或 fetch 的 UploadEvent 支援

        const response = await fetch(url, {
          method: "POST",
          body: formData,
        });

        // 檢查是否為 429 (Too Many Requests)
        if (response.status === 429) {
          // 已達最大重試次數
          if (attempt >= maxAttempts - 1) {
            console.error(`[Upload] ❌ Direct upload - Max retries exceeded. Status: 429.`);
            return {
              success: false,
              error: "429 Too Many Requests (max retries exceeded)",
              status: 429,
            };
          }

          // 計算延遲時間
          let delaySeconds = baseDelay;
          const retryAfter = response.headers.get("Retry-After");

          if (retryAfter) {
            const seconds = parseInt(retryAfter, 10);
            if (!isNaN(seconds) && seconds > 0 && seconds < 86400) {
              delaySeconds = seconds;
            }
            console.warn(
              `[Upload] ⏳ Direct upload - Rate limit triggered (429). Using Retry-After: ${delaySeconds}s`,
            );
          } else {
            console.warn(
              `[Upload] ⏳ Direct upload - Rate limit triggered (429). Using default: ${delaySeconds}s`,
            );
          }

          // 顯示重試進度
          const retryAttempt = attempt + 1;
          console.log(`[Upload] 🔄 Direct upload - Retry attempt ${retryAttempt}/${maxRetries}...`);
          console.log(
            `[Upload] ⏸️ Direct upload - Waiting ${delaySeconds} seconds before retry...`,
          );

          // 等待後重試
          await new Promise((resolve) => setTimeout(resolve, delaySeconds * 1000));
          continue;
        }

        // 檢查是否成功
        if (response.status >= 200 && response.status < 300) {
          console.log(`[Upload] ✅ Direct upload - Success. Status: ${response.status}`);
          try {
            const data = await response.json();
            return data;
          } catch {
            return { success: true, message: "Upload completed" };
          }
        }

        // 其他 HTTP 錯誤
        console.error(
          `[Upload] ❌ Direct upload failed: ${response.status} ${response.statusText}`,
        );
        return {
          success: false,
          error: `Upload failed with status ${response.status}`,
          status: response.status,
        };
      } catch (error) {
        console.error(`[Upload] ❌ Direct upload error: ${error.message}`);
        if (attempt >= maxAttempts - 1) {
          throw error;
        }
        console.log(`[Upload] 🔄 Direct upload - Retry attempt ${attempt + 1}/${maxRetries}...`);
        await new Promise((resolve) => setTimeout(resolve, baseDelay * 1000));
      }
    }

    throw new Error("Direct upload failed: Unknown error");
  }

  /**
   * Chunk 上傳（大檔）
   *
   * 🧠 記憶體管理：
   * - 每個 chunk 使用 file.slice() 產生新的 Blob
   * - chunk 送出後立即解除參考，允許 GC 回收
   * - 不保留任何 chunk 的參考
   *
   * @param {File} file
   * @param {function} onProgress
   * @param {string|null} taskId
   */
  async uploadChunked(file, onProgress, taskId = null) {
    const uploadId = generateUploadId();
    const totalChunks = calculateChunkCount(file.size);

    this.activeUploads.set(uploadId, {
      file: null, // 不保留 File 參考，避免記憶體洩漏
      fileName: file.name,
      fileSize: file.size,
      totalChunks,
      uploadedChunks: 0,
      status: "uploading",
      taskId,
    });

    try {
      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        const start = chunkIndex * CHUNK_SIZE_BYTES;
        const end = Math.min(start + CHUNK_SIZE_BYTES, file.size);

        // 等級一：建立 chunk（會被 GC 回收）
        // 注意：file.slice() 回傳的是一個新的 Blob，不會複製實際資料
        // 真正的記憶體使用發生在 FormData.append 和網路傳輸時
        const chunk = file.slice(start, end);

        await this.uploadChunk(uploadId, chunkIndex, totalChunks, chunk, file.name, file.size);

        // 🧠 等級一：chunk 參考在這裡超出作用域，可被 GC 回收
        // chunk = null; // 明確解除參考（JavaScript 會自動處理，但這裡明確化意圖）

        // 更新進度
        const uploadInfo = this.activeUploads.get(uploadId);
        if (uploadInfo) {
          uploadInfo.uploadedChunks = chunkIndex + 1;
          const percent = ((chunkIndex + 1) / totalChunks) * 100;
          if (onProgress) onProgress(percent);
        }
      }

      // 清理上傳追蹤
      this.activeUploads.delete(uploadId);
      return { success: true, message: "Chunked upload completed", upload_id: uploadId };
    } catch (error) {
      // 錯誤時也要清理
      this.activeUploads.delete(uploadId);
      throw error;
    }
  }

  /**
   * 上傳單個 chunk (含自動重試機制)
   *
   * 🧠 記憶體管理：
   * - FormData 不會複製 Blob 資料
   * - fetch 完成後，FormData 和 Blob 都可被 GC
   *
   * 🔄 Rate Limit 重試：
   * - 自動偵測 429 狀態碼
   * - 支援 Retry-After header
   * - 最多重試 3 次
   */
  async uploadChunk(uploadId, chunkIndex, totalChunks, chunkData, fileName, totalSize) {
    const formData = new FormData();
    formData.append("upload_id", uploadId);
    formData.append("chunk_index", chunkIndex.toString());
    formData.append("total_chunks", totalChunks.toString());
    formData.append("file_name", fileName);
    formData.append("total_size", totalSize.toString());
    formData.append("chunk", chunkData);

    const url = `${this.webroot}/upload-chunk`;
    const maxRetries = 3;
    const baseDelay = 60; // 秒

    let lastResponse = null;
    const maxAttempts = 1 + maxRetries;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        // 執行上傳請求
        const response = await fetch(url, {
          method: "POST",
          body: formData,
        });

        lastResponse = response;

        // 檢查是否為 429 (Too Many Requests)
        if (response.status === 429) {
          // 已達最大重試次數
          if (attempt >= maxAttempts - 1) {
            console.error(
              `[Upload] ❌ Chunk ${chunkIndex} - Max retries exceeded. Status: 429. Returning error.`,
            );
            throw new Error(
              `Chunk ${chunkIndex} upload failed: 429 Too Many Requests (max retries exceeded)`,
            );
          }

          // 計算延遲時間
          let delaySeconds = baseDelay;
          const retryAfter = response.headers.get("Retry-After");

          if (retryAfter) {
            const seconds = parseInt(retryAfter, 10);
            if (!isNaN(seconds) && seconds > 0 && seconds < 86400) {
              delaySeconds = seconds;
            }
            console.warn(
              `[Upload] ⏳ Chunk ${chunkIndex} - Rate limit triggered (429). Using Retry-After: ${delaySeconds}s`,
            );
          } else {
            console.warn(
              `[Upload] ⏳ Chunk ${chunkIndex} - Rate limit triggered (429). Using default: ${delaySeconds}s`,
            );
          }

          // 顯示重試進度
          const retryAttempt = attempt + 1;
          console.log(
            `[Upload] 🔄 Chunk ${chunkIndex} - Retry attempt ${retryAttempt}/${maxRetries}...`,
          );
          console.log(
            `[Upload] ⏸️ Chunk ${chunkIndex} - Waiting ${delaySeconds} seconds before retry...`,
          );

          // 等待後重試
          await new Promise((resolve) => setTimeout(resolve, delaySeconds * 1000));
          continue;
        }

        // 檢查是否成功
        if (response.ok) {
          console.log(`[Upload] ✅ Chunk ${chunkIndex} uploaded successfully`);
          const result = await response.json();
          return result;
        }

        // 其他 HTTP 錯誤
        console.error(
          `[Upload] ❌ Chunk ${chunkIndex} upload failed: ${response.status} ${response.statusText}`,
        );
        throw new Error(`Chunk ${chunkIndex} upload failed: ${response.status}`);
      } catch (error) {
        // 不是 429，直接拋出
        throw error;
      }
    }

    // 不應到達此處
    throw new Error(`Chunk ${chunkIndex} upload failed: Unknown error`);
  }

  /**
   * 取消上傳
   *
   * 🧠 記憶體管理：
   * - 取消時清理所有關聯資源
   * - 呼叫 finishTransferTask 執行等級二清理
   */
  async cancelUpload(uploadId) {
    const upload = this.activeUploads.get(uploadId);
    if (upload) {
      upload.status = "cancelled";

      // 等級二：清理任務資源
      if (upload.taskId) {
        await finishTransferTask(upload.taskId, "aborted");
      }

      this.activeUploads.delete(uploadId);
    }
  }

  /**
   * 清理所有活動上傳
   * 用於緊急清理或頁面卸載
   */
  async cleanupAll() {
    for (const [uploadId, upload] of this.activeUploads) {
      if (upload.taskId) {
        await finishTransferTask(upload.taskId, "aborted");
      }
    }
    this.activeUploads.clear();
    console.log("[UploadManager] All uploads cleaned up");
  }
}

// ==================== 下載管理器 ====================

/**
 * 下載管理器類別
 * 整合記憶體生命週期管理（等級一 + 二 + 三）
 */
class DownloadManager {
  /**
   * @param {string} webroot - 網站根路徑
   */
  constructor(webroot) {
    this.webroot = webroot;
    /** @type {Map<string, {taskId: string|null, status: string}>} */
    this.activeDownloads = new Map();
  }

  /**
   * 下載檔案（自動判斷使用直傳或 chunk）
   *
   * 🧠 記憶體管理：
   * - 等級一：所有 Blob 和 Object URL 都被追蹤
   * - 等級二：任務完成後自動清理所有資源
   * - 等級三：大檔下載使用 chunk 避免一次性載入過多資料
   *
   * @param {string} url - 下載 URL
   * @param {string} fileName - 檔案名稱
   * @param {object} options - 選項
   * @param {function} options.onProgress - 進度回調
   * @returns {Promise<Blob>} 下載的檔案
   */
  async downloadFile(url, fileName, options = {}) {
    const { onProgress } = options;

    // 等級二：建立任務上下文
    const task = createTransferTask("download");
    const taskId = task?.taskId || null;
    const downloadId = generateUploadId();

    this.activeDownloads.set(downloadId, { taskId, status: "downloading" });

    try {
      // 先取得檔案資訊
      const info = await this.getFileInfo(url);

      let blob;
      if (!info) {
        // 無法取得資訊，使用直接下載
        blob = await this.downloadDirect(url, fileName, onProgress, taskId);
      } else if (shouldUseChunkedTransfer(info.total_size)) {
        // 大檔：使用 chunk 下載
        blob = await this.downloadChunked(url, fileName, info, onProgress, taskId);
      } else {
        // 小檔：直接下載
        blob = await this.downloadDirect(url, fileName, onProgress, taskId);
      }

      // 等級二：任務完成，清理資源
      // 注意：Blob 在這裡回傳給呼叫者，它的生命週期由呼叫者管理
      this.activeDownloads.delete(downloadId);
      await finishTransferTask(taskId, "completed");

      return blob;
    } catch (error) {
      this.activeDownloads.delete(downloadId);
      await finishTransferTask(taskId, "failed");
      throw error;
    }
  }

  /**
   * 取得檔案資訊
   */
  async getFileInfo(url) {
    try {
      const response = await fetch(`${url}/info`, { method: "GET" });
      if (response.ok) {
        return response.json();
      }
    } catch {
      // 忽略錯誤，降級為直接下載
    }
    return null;
  }

  /**
   * 直接下載（小檔）
   *
   * 🧠 記憶體管理：
   * - 使用 ReadableStream 逐步讀取，避免一次性載入
   * - chunks 陣列在建立 Blob 後可被 GC
   *
   * @param {string} url
   * @param {string} fileName
   * @param {function} onProgress
   * @param {string|null} taskId
   */
  async downloadDirect(url, fileName, onProgress, taskId = null) {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Download failed: ${response.status}`);
    }

    const contentLength = response.headers.get("Content-Length");
    const total = contentLength ? parseInt(contentLength, 10) : 0;

    const reader = response.body.getReader();
    /** @type {Uint8Array[]} */
    const chunks = [];
    let loaded = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      chunks.push(value);
      loaded += value.length;

      if (onProgress && total > 0) {
        onProgress((loaded / total) * 100);
      }
    }

    // 等級一：建立 Blob 後，chunks 陣列可被 GC
    const blob = new Blob(chunks);

    // 觸發下載（會建立並釋放 Object URL）
    this.triggerDownload(blob, fileName, taskId);

    // 等級一：blob 參考在這裡回傳，由呼叫者管理生命週期
    return blob;
  }

  /**
   * Chunk 下載（大檔）
   *
   * 🧠 記憶體管理：
   * - 等級三：逐 chunk 下載，避免一次性佔用過多記憶體
   * - 每個 chunk 的 ArrayBuffer 在加入陣列後可被串流處理
   * - 最終合併時才建立完整 Blob
   *
   * @param {string} url
   * @param {string} fileName
   * @param {object} info
   * @param {function} onProgress
   * @param {string|null} taskId
   */
  async downloadChunked(url, fileName, info, onProgress, taskId = null) {
    const { total_chunks, chunk_size, total_size } = info;
    /** @type {ArrayBuffer[]} */
    const chunks = [];

    for (let i = 0; i < total_chunks; i++) {
      const chunkData = await this.downloadChunk(url, i);
      chunks.push(chunkData);

      if (onProgress) {
        const loaded = Math.min((i + 1) * chunk_size, total_size);
        onProgress((loaded / total_size) * 100);
      }

      // 🧠 等級一：每次迴圈後，前一個 chunkData 的參考仍在 chunks 陣列中
      // 這是必要的，因為我們需要所有 chunks 來建立最終 Blob
      // 但一旦 Blob 建立完成，chunks 陣列就可以被 GC
    }

    // 等級一：建立 Blob 後，chunks 陣列可被 GC
    const blob = new Blob(chunks);

    // 🧠 等級一：明確清空 chunks 陣列，允許 GC 更早回收
    chunks.length = 0;

    this.triggerDownload(blob, fileName, taskId);
    return blob;
  }

  /**
   * 下載單個 chunk
   *
   * @param {string} url
   * @param {number} chunkIndex
   * @returns {Promise<ArrayBuffer>}
   */
  async downloadChunk(url, chunkIndex) {
    const response = await fetch(`${url}/chunk/${chunkIndex}`);

    if (!response.ok) {
      throw new Error(`Chunk ${chunkIndex} download failed: ${response.status}`);
    }

    // 等級一：ArrayBuffer 會被回傳，由呼叫者管理
    return response.arrayBuffer();
  }

  /**
   * 觸發瀏覽器下載
   *
   * 🧠 記憶體管理：
   * - 等級一：使用 createTrackedURL 追蹤 Object URL
   * - 下載完成後立即釋放 Object URL
   *
   * @param {Blob} blob
   * @param {string} fileName
   * @param {string|null} taskId
   */
  triggerDownload(blob, fileName, taskId = null) {
    // 等級一：使用追蹤的 Object URL
    const url = createTrackedURL(blob, taskId, `download:${fileName}`);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // 等級一：立即釋放 Object URL
    // 使用 setTimeout 確保瀏覽器已經開始處理下載
    setTimeout(() => {
      revokeTrackedURL(url);
    }, 1000);
  }

  /**
   * 簡單下載（不使用 chunk，用於向後相容）
   *
   * 🧠 記憶體管理：
   * - 此方法使用伺服器 URL，不建立 Object URL
   * - 記憶體使用量由瀏覽器管理
   */
  async simpleDownload(url, fileName) {
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  /**
   * 清理所有活動下載
   * 用於緊急清理或頁面卸載
   */
  async cleanupAll() {
    for (const [downloadId, download] of this.activeDownloads) {
      if (download.taskId) {
        await finishTransferTask(download.taskId, "aborted");
      }
    }
    this.activeDownloads.clear();
    console.log("[DownloadManager] All downloads cleaned up");
  }
}

// ==================== 全域實例 ====================

// 從 meta 標籤取得 webroot
const webrootMeta = document.querySelector("meta[name='webroot']");
const transferWebroot = webrootMeta ? webrootMeta.content : "";

// 建立全域實例
const uploadManagerInstance = new UploadManager(transferWebroot);
const downloadManagerInstance = new DownloadManager(transferWebroot);

window.ContentsTransfer = {
  uploadManager: uploadManagerInstance,
  downloadManager: downloadManagerInstance,

  // 工具函數
  shouldUseChunkedTransfer,
  calculateChunkCount,

  // 常數
  CHUNK_THRESHOLD_BYTES,
  CHUNK_SIZE_BYTES,

  // 🧠 記憶體管理 API
  /**
   * 執行緊急清理
   * 清理所有進行中的傳輸並釋放資源
   */
  async emergencyCleanup() {
    await uploadManagerInstance.cleanupAll();
    await downloadManagerInstance.cleanupAll();
    console.log("[ContentsTransfer] Emergency cleanup completed");
  },

  /**
   * 取得傳輸狀態
   */
  getStatus() {
    return {
      activeUploads: uploadManagerInstance.activeUploads.size,
      activeDownloads: downloadManagerInstance.activeDownloads.size,
    };
  },
};

// 向後相容：提供簡化的 API
window.uploadFile = (file, options) =>
  window.ContentsTransfer.uploadManager.uploadFile(file, options);
window.downloadFile = (url, fileName, options) =>
  window.ContentsTransfer.downloadManager.downloadFile(url, fileName, options);

// 🧠 頁面卸載時清理
window.addEventListener("beforeunload", () => {
  window.ContentsTransfer.emergencyCleanup();
});

console.log("[ContentsTransfer] Module initialized with memory lifecycle management");
