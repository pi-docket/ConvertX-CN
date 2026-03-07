/**
 * API 請求重試處理器 - Rate Limit (429) 自動重試機制
 *
 * 功能：
 * - 自動偵測 HTTP 429 (Too Many Requests) 狀態碼
 * - 支援 Retry-After header 和固定 60 秒延遲
 * - 最多重試 3 次
 * - 保留原始 request body、headers、method
 * - 清楚的日誌輸出
 * - 防止無限循環
 */

/**
 * 延遲函數 (毫秒)
 * @param {number} ms - 延遲時間（毫秒）
 * @returns {Promise<void>}
 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 從 response header 取得 Retry-After 秒數
 * @param {Response} response - fetch response 物件
 * @returns {number} 秒數，若無則返回 null
 */
function getRetryAfterSeconds(response) {
  const retryAfter = response.headers.get("Retry-After");
  if (!retryAfter) return null;

  // Retry-After 可能是秒數（數字）或日期
  const seconds = parseInt(retryAfter, 10);
  if (!isNaN(seconds) && seconds > 0 && seconds < 86400) {
    return seconds;
  }

  // 如果是日期格式，計算差異
  try {
    const retryDate = new Date(retryAfter);
    if (!isNaN(retryDate.getTime())) {
      const diff = (retryDate.getTime() - Date.now()) / 1000;
      if (diff > 0 && diff < 86400) {
        return Math.ceil(diff);
      }
    }
  } catch {
    // 無法解析，使用預設值
  }

  return null;
}

/**
 * 執行 API 請求 (含自動重試機制)
 *
 * @param {string} url - 請求 URL
 * @param {object} options - fetch 選項
 * @param {string} options.method - HTTP 方法 (GET, POST 等)
 * @param {object} options.headers - 請求 headers
 * @param {string|FormData|Blob} options.body - 請求 body
 * @param {number} options.timeout - 請求逾時 (毫秒，預設 30000)
 * @param {boolean} options.disableRetry - 禁用重試機制 (預設 false)
 * @param {number} options.maxRetries - 最大重試次數 (預設 3)
 * @param {number} options.baseDelay - 基礎延遲秒數 (預設 60)
 *
 * @returns {Promise<Response>} fetch response 物件
 * @throws {Error} 所有重試都失敗或其他錯誤
 */
async function fetchWithRetry(url, options = {}) {
  const {
    method = "GET",
    headers = {},
    body = undefined,
    timeout = 30000,
    disableRetry = false,
    maxRetries = 3,
    baseDelay = 60,
  } = options;

  let lastError = null;
  let lastResponse = null;

  // 最多嘗試 = 初始嘗試 + 重試次數
  const maxAttempts = disableRetry ? 1 : 1 + maxRetries;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      // 測試進度日誌
      if (attempt === 0) {
        console.log(`[API Request] ${method} ${url}`);
      }

      // 建立超時控制器
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        // 執行請求
        const response = await fetch(url, {
          method,
          headers,
          body,
          signal: controller.signal,
        });

        lastResponse = response;
        clearTimeout(timeoutId);

        // 檢查是否為 429 (Too Many Requests)
        if (response.status === 429) {
          // 已達最大重試次數
          if (attempt >= maxAttempts - 1) {
            console.error(
              `[API Retry] ❌ Max retries exceeded. Status: 429. Returning error response.`,
            );
            return response; // 回傳 429 response 給呼叫者
          }

          // 計算延遲時間
          let delaySeconds = baseDelay;
          const retryAfterSeconds = getRetryAfterSeconds(response);

          if (retryAfterSeconds !== null) {
            delaySeconds = retryAfterSeconds;
            console.warn(
              `[API Retry] ⏳ Rate limit triggered (429). Using Retry-After header: ${delaySeconds}s`,
            );
          } else {
            console.warn(
              `[API Retry] ⏳ Rate limit triggered (429). Using default: ${delaySeconds}s`,
            );
          }

          // 顯示重試進度
          const retryAttempt = attempt + 1;
          console.log(`[API Retry] 🔄 Retry attempt ${retryAttempt}/${maxRetries}...`);
          console.log(`[API Retry] ⏸️ Waiting ${delaySeconds} seconds before retry...`);

          // 等待後重試
          await delay(delaySeconds * 1000);
          continue;
        }

        // 成功回應（2xx）或其他狀態碼
        if (response.status >= 200 && response.status < 300) {
          console.log(`[API Request] ✅ Success. Status: ${response.status}`);
          return response;
        }

        // 其他 HTTP 錯誤（3xx, 4xx, 5xx 除了 429）
        console.warn(
          `[API Request] ⚠️ HTTP Error. Status: ${response.status} ${response.statusText}`,
        );
        return response; // 回傳非 429 的錯誤回應
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      lastError = error;

      // 處理超時
      if (error.name === "AbortError") {
        console.error(`[API Request] ⏱️ Request timeout after ${timeout}ms`);
        if (attempt >= maxAttempts - 1) {
          throw new Error(`Request timeout after ${maxAttempts} attempts`);
        }
        console.log(`[API Retry] 🔄 Retry attempt ${attempt + 1}/${maxRetries}...`);
        await delay(baseDelay * 1000);
        continue;
      }

      // 其他網路錯誤
      console.error(`[API Request] ❌ Network error: ${error.message}`);
      if (attempt >= maxAttempts - 1) {
        throw error;
      }
      console.log(`[API Retry] 🔄 Retry attempt ${attempt + 1}/${maxRetries}...`);
      await delay(baseDelay * 1000);
    }
  }

  // 如果還有最終錯誤，拋出它
  if (lastError) {
    throw lastError;
  }

  // 回傳最後的回應（通常是錯誤狀態）
  return lastResponse;
}

/**
 * 簡化版 POST 請求 (自動重試)
 *
 * @param {string} url - 請求 URL
 * @param {object} data - 要發送的資料
 * @param {object} options - 額外選項
 * @returns {Promise<Response>}
 */
async function postWithRetry(url, data = {}, options = {}) {
  // 可以是 object 或 FormData
  let body;
  let headers = options.headers || {};

  if (data instanceof FormData) {
    body = data;
    // FormData 會自動設定正確的 Content-Type，不要手動設定
  } else if (typeof data === "object" && data !== null) {
    body = JSON.stringify(data);
    headers = { ...headers, "Content-Type": "application/json" };
  } else if (typeof data === "string") {
    body = data;
  }

  return fetchWithRetry(url, {
    method: "POST",
    headers,
    body,
    ...options,
  });
}

/**
 * 簡化版 GET 請求 (自動重試)
 *
 * @param {string} url - 請求 URL
 * @param {object} options - 額外選項
 * @returns {Promise<Response>}
 */
async function getWithRetry(url, options = {}) {
  return fetchWithRetry(url, {
    method: "GET",
    ...options,
  });
}

// ==================== 全域暴露 ====================

/**
 * 將 API 重試功能暴露到全域 window 物件
 */
window.APIRetryHandler = {
  fetchWithRetry,
  postWithRetry,
  getWithRetry,
  delay,
  getRetryAfterSeconds,
};

console.log(
  "[APIRetryHandler] Module initialized with Rate Limit retry mechanism (429 status code)",
);
