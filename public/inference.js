/**
 * 智慧搜尋代理 - 前端模組
 *
 * 在使用者上傳檔案後，自動推斷最可能的目標格式
 * 並模擬使用者在搜尋欄輸入 token (prefix matching)
 *
 * UI 行為完全等同真人輸入
 */

// @ts-check

/**
 * @typedef {function(string, string, Object=): string} TranslateFunction
 */

/**
 * 安全取得翻譯函數
 * @param {string} category
 * @param {string} key
 * @returns {string|null}
 */
function safeTranslate(category, key) {
  // @ts-ignore - window.t is defined by i18n.js
  if (typeof window.t === "function") {
    // @ts-ignore
    return window.t(category, key);
  }
  return null;
}

/**
 * @typedef {Object} FormatPrediction
 * @property {string} search_token - 預測的搜尋 token (用於 prefix matching)
 * @property {number} confidence - 預測信心度 (0-1)
 * @property {Array<{token: string, score: number}>} top_k - Top-K 候選 token
 * @property {string[]} reason_codes - 預測原因碼
 */

/**
 * @typedef {Object} EnginePrediction
 * @property {string} engine - 預測的引擎名稱
 * @property {number} confidence - 預測信心度 (0-1)
 * @property {boolean} should_warmup - 是否應該預調用
 * @property {number} cold_start_cost - 預估冷啟動成本 (毫秒)
 * @property {string} reason - 預測原因
 */

/**
 * @typedef {Object} InferenceResult
 * @property {FormatPrediction|null} format - 格式推斷結果
 * @property {EnginePrediction|null} engine - 引擎推斷結果
 * @property {boolean} should_auto_fill - 是否應自動填入
 */

// 取得 webroot
const inferenceWebrootMeta = document.querySelector("meta[name='webroot']");
const inferenceWebroot = inferenceWebrootMeta
  ? inferenceWebrootMeta.getAttribute("content") || ""
  : "";

// 狀態追蹤
let inferenceEnabled = true;
/** @type {string|null} */
let lastInferredToken = null;
/** @type {string|null} */
let lastInferredEngine = null;
let isInferredValue = false;

/**
 * 請求格式推斷
 * @param {string} ext - 檔案副檔名
 * @param {number} [fileSizeKb] - 檔案大小 (KB)
 * @returns {Promise<InferenceResult|null>}
 */
async function requestFormatInference(ext, fileSizeKb) {
  if (!inferenceEnabled) {
    return null;
  }

  try {
    const response = await fetch(`${inferenceWebroot}/inference/predict`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ext: ext,
        file_size_kb: fileSizeKb,
      }),
    });

    const result = await response.json();

    if (result.success && result.data) {
      return result.data;
    }

    return null;
  } catch (error) {
    console.warn("Format inference request failed:", error);
    return null;
  }
}

/**
 * 記錄推薦被拒絕
 * @param {string} inputExt - 輸入副檔名
 * @param {string} dismissedFormat - 被拒絕的格式
 * @param {string} [dismissedEngine] - 被拒絕的引擎
 */
async function logDismissEvent(inputExt, dismissedFormat, dismissedEngine) {
  try {
    await fetch(`${inferenceWebroot}/inference/dismiss`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input_ext: inputExt,
        dismissed_format: dismissedFormat,
        dismissed_engine: dismissedEngine,
      }),
    });
  } catch (error) {
    console.warn("Failed to log dismiss event:", error);
  }
}

/**
 * 取消預調用
 */
async function cancelWarmup() {
  try {
    await fetch(`${inferenceWebroot}/inference/cancel-warmup`, {
      method: "POST",
    });
  } catch (error) {
    console.warn("Failed to cancel warmup:", error);
  }
}

/**
 * 自動填入推斷的格式
 * UI 行為完全等同使用者手動輸入，但會顯示視覺提示
 * @param {string} token - 推斷的 search token
 * @param {string} [engine] - 推斷的引擎
 * @param {boolean} [isColdStart=false] - 是否為 Cold Start 預測
 */
function autoFillInferredFormat(token, engine, isColdStart = false) {
  /** @type {HTMLInputElement|null} */
  const searchInput = document.querySelector("input[name='convert_to_search']");
  const convertToPopup = document.querySelector(".convert_to_popup");

  if (!searchInput || !convertToPopup) {
    console.warn("Search input or popup not found");
    return;
  }

  // 儲存推斷值
  lastInferredToken = token;
  lastInferredEngine = engine || null;
  isInferredValue = true;

  // 填入搜尋欄 - UI 行為完全等同使用者輸入
  searchInput.value = token;

  // 觸發 input 事件以過濾結果
  const inputEvent = new Event("input", { bubbles: true });
  searchInput.dispatchEvent(inputEvent);

  // 添加視覺提示 - 讓使用者知道這是系統預填的
  searchInput.classList.add("inference-auto-filled");
  searchInput.setAttribute("data-inference-source", isColdStart ? "cold-start" : "learned");

  // 顯示提示訊息（如果有 toast 系統的話）
  const mode = isColdStart
    ? safeTranslate("inference", "smartRecommend") || "Smart Recommend"
    : safeTranslate("inference", "yourFrequentFormat") || "Your frequent format";
  console.log(`🎯 ${mode}: ${token}${engine ? ` (引擎: ${engine})` : ""}`);

  // 在搜尋框旁顯示小提示
  showInferenceHint(searchInput, token, isColdStart);
}

/**
 * 處理搜尋欄清除事件 (使用者點擊 X)
 * @param {string} inputExt - 輸入副檔名
 */
function handleSearchClear(inputExt) {
  if (isInferredValue && lastInferredToken) {
    // 記錄為負樣本
    logDismissEvent(inputExt, lastInferredToken, lastInferredEngine || undefined);

    // 取消預調用
    cancelWarmup();

    console.log(`❌ User dismissed inference: ${lastInferredToken}`);
  }

  // 重置狀態
  isInferredValue = false;
  lastInferredToken = null;
  lastInferredEngine = null;

  // 移除視覺提示
  removeInferenceHint();
}

/**
 * 處理使用者手動輸入
 */
function handleManualInput() {
  if (isInferredValue) {
    // 使用者手動修改，取消預調用
    cancelWarmup();
    isInferredValue = false;

    // 移除視覺提示
    removeInferenceHint();
  }
}

/**
 * 顯示推斷提示
 * @param {HTMLInputElement} searchInput
 * @param {string} token
 * @param {boolean} [isColdStart=false]
 */
function showInferenceHint(searchInput, token, isColdStart = false) {
  // 移除舊的提示
  removeInferenceHint();

  // 創建提示元素
  const hint = document.createElement("div");
  hint.id = "inference-hint";
  hint.className = "inference-hint";
  const hintLabel = isColdStart
    ? safeTranslate("inference", "smartRecommend") || "Smart Recommend"
    : safeTranslate("inference", "yourFrequentFormat") || "Your frequent format";
  hint.innerHTML = `
    <span class="inference-hint-icon">✨</span>
    <span class="inference-hint-text">${hintLabel}: <strong>${token.toUpperCase()}</strong></span>
    <button class="inference-hint-dismiss" title="✕">✕</button>
  `;

  // 插入到搜尋欄後面
  searchInput.parentNode?.insertBefore(hint, searchInput.nextSibling);

  // 綁定清除按鈕
  const dismissBtn = hint.querySelector(".inference-hint-dismiss");
  if (dismissBtn) {
    dismissBtn.addEventListener("click", () => {
      // @ts-ignore - fileType is set by script.js
      const fileType = window.fileType || "";
      handleSearchClear(fileType);
      searchInput.value = "";

      // 🔧 關鍵修復：觸發 input 事件以同步過濾狀態
      // 這會讓 script.js 中的 showMatching("") 被呼叫，重置格式清單為「顯示全部」
      const inputEvent = new Event("input", { bubbles: true });
      searchInput.dispatchEvent(inputEvent);

      searchInput.focus();
    });
  }
}

/**
 * 移除推斷提示
 */
function removeInferenceHint() {
  const existingHint = document.getElementById("inference-hint");
  if (existingHint) {
    existingHint.remove();
  }

  // 移除搜尋框的 CSS class
  const searchInput = document.querySelector("input[name='convert_to_search']");
  if (searchInput) {
    searchInput.classList.remove("inference-auto-filled");
    searchInput.removeAttribute("data-inference-source");
  }
}

/**
 * 注入推斷相關的 CSS 樣式
 */
function injectInferenceStyles() {
  if (document.getElementById("inference-styles")) return;

  const style = document.createElement("style");
  style.id = "inference-styles";
  style.textContent = `
    /* 推斷自動填入的搜尋框樣式 */
    .inference-auto-filled {
      background: linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(147, 51, 234, 0.08) 100%) !important;
      border-color: rgba(59, 130, 246, 0.4) !important;
      transition: all 0.3s ease;
    }
    
    .inference-auto-filled:focus {
      border-color: rgba(59, 130, 246, 0.6) !important;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15) !important;
    }
    
    /* 推斷提示樣式 */
    .inference-hint {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.35rem 0.75rem;
      margin-left: 0.5rem;
      background: linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(147, 51, 234, 0.15) 100%);
      border: 1px solid rgba(59, 130, 246, 0.3);
      border-radius: 9999px;
      font-size: 0.8rem;
      color: var(--text-color, #374151);
      animation: inference-hint-appear 0.3s ease;
    }
    
    @keyframes inference-hint-appear {
      from {
        opacity: 0;
        transform: translateX(-10px);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }
    
    .inference-hint-icon {
      font-size: 1rem;
    }
    
    .inference-hint-text strong {
      color: var(--primary-color, #3b82f6);
      font-weight: 600;
    }
    
    .inference-hint-dismiss {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 1.25rem;
      height: 1.25rem;
      padding: 0;
      margin-left: 0.25rem;
      background: rgba(0, 0, 0, 0.1);
      border: none;
      border-radius: 50%;
      font-size: 0.7rem;
      cursor: pointer;
      opacity: 0.6;
      transition: all 0.2s ease;
    }
    
    .inference-hint-dismiss:hover {
      opacity: 1;
      background: rgba(239, 68, 68, 0.2);
      color: #dc2626;
    }
    
    /* 暗色模式 */
    @media (prefers-color-scheme: dark) {
      .inference-hint {
        color: #e5e7eb;
      }
      
      .inference-hint-dismiss {
        background: rgba(255, 255, 255, 0.1);
      }
    }
  `;

  document.head.appendChild(style);
}

/**
 * 初始化推斷模組
 * 需要在頁面載入後呼叫
 */
function initInferenceModule() {
  // 注入 CSS 樣式
  injectInferenceStyles();

  // 監聽搜尋欄的 search 事件 (當使用者點擊 X 時觸發)
  /** @type {HTMLInputElement|null} */
  const searchInput = document.querySelector("input[name='convert_to_search']");

  if (searchInput) {
    // 監聯清除事件
    searchInput.addEventListener("search", () => {
      // @ts-ignore - fileType is set by script.js
      const fileType = window.fileType || "";
      handleSearchClear(fileType);
    });

    // 監聽手動輸入
    searchInput.addEventListener("input", (e) => {
      // 如果是程式設定的值，不處理
      if (e.isTrusted && isInferredValue) {
        const currentValue = searchInput.value;
        if (currentValue !== lastInferredToken) {
          handleManualInput();
        }
      }
    });
  }

  console.log("┌──────────────────────────────────────────┐");
  console.log("│  ✅ Inference Module Initialized         │");
  console.log("│  ✅ Cold-Start prediction ready          │");
  console.log("│  ✅ Auto-fill on file drop enabled       │");
  console.log("└──────────────────────────────────────────┘");
}

/**
 * 啟用/停用推斷功能
 * @param {boolean} enabled
 */
function setInferenceEnabled(enabled) {
  inferenceEnabled = enabled;
  console.log(`Inference ${enabled ? "enabled" : "disabled"}`);
}

// 導出到全域
// @ts-expect-error - Define on window object
window.inferenceModule = {
  requestFormatInference,
  autoFillInferredFormat,
  handleSearchClear,
  handleManualInput,
  setInferenceEnabled,
  initInferenceModule,
  logDismissEvent,
  cancelWarmup,
  showInferenceHint,
  removeInferenceHint,
};

// 頁面載入後初始化
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initInferenceModule);
} else {
  initInferenceModule();
}
