const webroot = document.querySelector("meta[name='webroot']").content;
const csrfToken = document.querySelector("meta[name='csrf-token']")?.content || "";
const fileInput = document.querySelector('input[type="file"]');
const convertButton = document.querySelector("input[type='submit']");
const fileNames = [];
let fileType;
let pendingFiles = 0;
let formatSelected = false;

// 🧠 記憶體生命週期管理
// 追蹤當前會話的所有上傳任務
/** @type {Map<string, {taskId: string|null, file: File|null, status: string}>} */
const uploadTasks = new Map();
/** @type {Map<string, {file: File, row: HTMLTableRowElement, attempt: number, pending: boolean, removed: boolean, controller: AbortController|null, xhr: XMLHttpRequest|null, uploadId: string|null}>} */
const uploadStates = new Map();

function refreshConvertButton() {
  convertButton.disabled = !(pendingFiles === 0 && formatSelected && fileNames.length > 0);
}

async function cancelUploadSession(state) {
  const uploadId = state?.uploadId;
  if (!uploadId) return true;
  try {
    const response = await fetch(`${webroot}/upload-cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ upload_id: uploadId, csrf_token: csrfToken }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.success) {
      throw new Error(payload.message || `Upload cleanup failed (${response.status})`);
    }
    state.uploadId = null;
    return true;
  } catch (error) {
    console.warn("Upload session cleanup failed", error);
    return false;
  }
}

/**
 * 取得記憶體生命週期管理器
 * @returns {any|null}
 */
function getMemoryLifecycle() {
  // @ts-ignore
  return window.MemoryLifecycle || null;
}

/**
 * 建立上傳任務上下文
 * @param {string} fileName
 * @returns {{taskId: string|null, context: any|null}}
 */
function createUploadTask(fileName) {
  const lifecycle = getMemoryLifecycle();
  if (lifecycle) {
    const context = lifecycle.createTask("upload");
    uploadTasks.set(fileName, { taskId: context.taskId, file: null, status: "pending" });
    return { taskId: context.taskId, context };
  }
  return { taskId: null, context: null };
}

/**
 * 完成上傳任務並清理
 * @param {string} fileName
 * @param {"completed"|"failed"|"aborted"} status
 */
async function finishUploadTask(fileName, status = "completed") {
  const task = uploadTasks.get(fileName);
  if (task?.taskId) {
    const lifecycle = getMemoryLifecycle();
    if (lifecycle) {
      await lifecycle.finishTask(task.taskId, status);
    }
  }
  uploadTasks.delete(fileName);
}

/**
 * 清理所有未完成的上傳任務
 */
async function cleanupAllUploadTasks() {
  for (const [fileName, task] of uploadTasks) {
    if (task.taskId) {
      const lifecycle = getMemoryLifecycle();
      if (lifecycle) {
        await lifecycle.finishTask(task.taskId, "aborted");
      }
    }
  }
  uploadTasks.clear();
  console.log("[Script] All upload tasks cleaned up");
}

// 頁面卸載時清理
window.addEventListener("beforeunload", () => {
  cleanupAllUploadTasks();
});

// Get translation helper
const getTranslation = (category, key, params) => {
  if (typeof window.t === "function") {
    const translated = window.t(category, key, params);
    if (translated !== `${category}.${key}`) return translated;
  }
  // Fallback to English if t is not available
  const fallbacks = {
    "common.remove": "Remove",
    "convert.title": "Convert",
    "convert.titleWithType": "Convert .{fileType}",
    "convert.convertButton": "Convert",
    "convert.uploading": "Uploading...",
    "common.retry": "Retry",
    "errors.uploadCancelFailed": "Could not cancel upload. Please retry.",
    "errors.uploadCleanupFailed": "Previous upload cleanup failed. Retry again.",
    "errors.deleteFailed": "Could not delete file.",
  };
  let text = fallbacks[`${category}.${key}`] || key;
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      text = text.replace(`{${k}}`, v);
    });
  }
  return text;
};

// ===== 全頁拖曳上傳支援（UI 零變動版）=====
// 只監聯 dragover 和 drop，不操作任何 UI class
// 這樣虛線框不會變粗、不會閃爍

// 🧠 記憶體管理：使用 WeakSet 避免持有檔案參考
// 防重複機制：記錄最近處理的檔案鍵值
const recentlyProcessedFiles = new Set();
const getFileKey = (file) => `${file.name}_${file.size}_${file.lastModified}`;
const clearRecentFiles = () => {
  setTimeout(() => recentlyProcessedFiles.clear(), 100);
};

// 全頁 dragover：只做 preventDefault，防止瀏覽器開啟檔案
document.addEventListener("dragover", (e) => {
  e.preventDefault();
  e.stopPropagation();
});

// 全頁 drop：處理檔案上傳
// 🧠 記憶體管理：不保留 DataTransfer 或 FileList 的參考
document.addEventListener("drop", (e) => {
  e.preventDefault();
  e.stopPropagation();

  const files = e.dataTransfer.files;

  if (files.length === 0) {
    console.warn("No files dropped — likely a URL or unsupported source.");
    return;
  }

  // 立即處理所有檔案，不保留 FileList 參考
  for (const file of files) {
    console.log("Handling dropped file:", file.name);
    handleFile(file);
  }

  // 🧠 等級一：清除 DataTransfer 參考
  // DataTransfer 在事件處理完成後會被自動清理
});
// ===== 全頁拖曳上傳支援結束 =====

// Reuse the same upload, chunking, cancellation and safe filename rendering for pasted files.
document.addEventListener("paste", (event) => {
  if (event.target?.closest?.("input, textarea, [contenteditable]")) return;
  const files = Array.from(event.clipboardData?.files ?? []);
  if (files.length === 0) return;
  event.preventDefault();
  for (const [index, file] of files.entries()) {
    let name = file.name;
    if (!name || !name.includes(".") || uploadStates.has(name)) {
      const extension = window.inferExtensionFromMimeType(file.type);
      name = `clipboard-${Date.now()}-${index}.${extension}`;
    }
    handleFile(new File([file], name, { type: file.type, lastModified: file.lastModified }));
  }
});

// Extracted handleFile function for reusability in drag-and-drop and file input
// 🧠 記憶體管理：File 物件參考只在上傳期間保持
function handleFile(file) {
  if (uploadStates.has(file.name)) {
    console.warn(`A file named "${file.name}" is already in this job.`);
    return;
  }
  // 防重複檢查：如果這個檔案剛剛已經處理過，直接跳過
  const fileKey = getFileKey(file);
  if (recentlyProcessedFiles.has(fileKey)) {
    console.log("Skipping duplicate file:", file.name);
    return;
  }
  recentlyProcessedFiles.add(fileKey);
  clearRecentFiles();

  const fileList = document.querySelector("#file-list");
  const removeText = getTranslation("common", "remove");

  const row = document.createElement("tr");
  // 🧠 記憶體管理：不在 DOM 中保存 File 物件參考
  // 只保存檔案名稱用於追蹤
  const fileName = file.name;
  const fileSizeKB = (file.size / 1024).toFixed(2);

  row.dataset.fileName = fileName;
  row.dataset.uploadStatus = "uploading";
  const nameCell = document.createElement("td");
  nameCell.textContent = fileName;
  const progressCell = document.createElement("td");
  const progress = document.createElement("progress");
  progress.value = 0;
  progress.max = 100;
  progress.className =
    "inline-block h-2 appearance-none overflow-hidden rounded-full border-0 bg-neutral-700 bg-none text-accent-500 accent-accent-500";
  progress.setAttribute("aria-label", `${fileName} upload progress`);
  progressCell.appendChild(progress);
  const sizeCell = document.createElement("td");
  sizeCell.textContent = `${fileSizeKB} kB`;
  const actionCell = document.createElement("td");
  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.textContent = removeText;
  removeButton.addEventListener("click", () => deleteRow(removeButton));
  actionCell.appendChild(removeButton);
  const retryButton = document.createElement("button");
  retryButton.type = "button";
  retryButton.textContent = getTranslation("common", "retry");
  retryButton.className = "ml-2 hidden";
  retryButton.addEventListener("click", () => retryUpload(fileName));
  actionCell.appendChild(retryButton);
  const statusCell = document.createElement("td");
  statusCell.className = "upload-status text-sm";
  statusCell.setAttribute("role", "status");
  statusCell.setAttribute("aria-live", "polite");
  statusCell.textContent = getTranslation("convert", "uploading");
  row.append(nameCell, progressCell, sizeCell, statusCell, actionCell);

  if (!fileType) {
    fileType = file.name.split(".").pop();
    fileInput.setAttribute("accept", `.${fileType}`);
    setTitle();

    fetch(`${webroot}/conversions`, {
      method: "POST",
      body: JSON.stringify({ fileType }),
      headers: { "Content-Type": "application/json" },
    })
      .then((res) => res.text())
      .then((html) => {
        selectContainer.innerHTML = html;
        updateSearchBar();

        // 🎯 觸發格式推斷
        triggerFormatInference(fileType, file.size);
      })
      .catch(console.error);
  }

  fileList.appendChild(row);

  // 🧠 記憶體管理：使用 WeakRef 或只保存必要資訊
  // 不再使用 file.htmlRow = row，避免交叉參考
  // 改為使用 Map 追蹤
  const fileRowMap = window._fileRowMap || (window._fileRowMap = new Map());
  fileRowMap.set(fileName, row);
  uploadStates.set(fileName, {
    file,
    row,
    attempt: 0,
    pending: false,
    removed: false,
    controller: null,
    xhr: null,
    uploadId: null,
  });

  // 🧠 記憶體管理：建立任務上下文追蹤這個上傳
  createUploadTask(fileName);

  // 上傳檔案（傳遞 row 和 fileName 用於 UI 更新，不在閉包中保持 file 參考過久）
  uploadFile(file, row, fileName);
}

const selectContainer = document.querySelector("form .select_container");

const updateSearchBar = () => {
  const convertToInput = document.querySelector("input[name='convert_to_search']");
  const convertToPopup = document.querySelector(".convert_to_popup");
  const convertToGroupElements = document.querySelectorAll(".convert_to_group");
  const convertToGroups = {};
  const convertToElement = document.querySelector("select[name='convert_to']");

  const clearFormatSelection = () => {
    convertToElement.value = "";
    formatSelected = false;
    const supportedSources = document.querySelector("#supported-sources");
    if (supportedSources) supportedSources.textContent = "";
    for (const candidate of document.querySelectorAll(".target[aria-selected='true']")) {
      candidate.setAttribute("aria-selected", "false");
    }
    refreshConvertButton();
  };

  // =========================================================================
  // 搜尋邏輯：同時支援目標格式和引擎名稱搜尋
  // =========================================================================
  // 使用者可以輸入：
  //   - "pdf"     → 顯示所有包含 "pdf" 的目標格式
  //   - "pandoc"  → 顯示 Pandoc 引擎的所有格式
  //   - "md pan"  → 顯示 Pandoc 引擎中包含 "md" 的格式
  // =========================================================================
  const showMatching = (search) => {
    const searchTerms = search.toLowerCase().split(/\s+/).filter(Boolean);

    for (const [groupName, [targets, groupElement]] of Object.entries(convertToGroups)) {
      const groupNameLower = groupName.toLowerCase();
      let matchingTargetsFound = 0;

      for (const target of targets) {
        const targetName = target.dataset.target.toLowerCase();

        // 匹配邏輯：
        // 1. 如果搜尋詞匹配引擎名稱，顯示該引擎的所有格式
        // 2. 如果搜尋詞匹配目標格式名稱，顯示該格式
        // 3. 如果有多個搜尋詞，所有詞都必須匹配（引擎或格式）
        let isMatch = false;

        if (searchTerms.length === 0) {
          // 無搜尋詞時顯示全部
          isMatch = true;
        } else if (searchTerms.length === 1) {
          // 單一搜尋詞：匹配格式或引擎
          isMatch = targetName.includes(searchTerms[0]) || groupNameLower.includes(searchTerms[0]);
        } else {
          // 多個搜尋詞：全部都要匹配（可以是格式或引擎的組合）
          isMatch = searchTerms.every(
            (term) => targetName.includes(term) || groupNameLower.includes(term),
          );
        }

        if (isMatch) {
          matchingTargetsFound++;
          target.classList.remove("hidden");
          target.classList.add("flex");
        } else {
          target.classList.add("hidden");
          target.classList.remove("flex");
        }
      }

      if (matchingTargetsFound === 0) {
        groupElement.classList.add("hidden");
        groupElement.classList.remove("flex");
      } else {
        groupElement.classList.remove("hidden");
        groupElement.classList.add("flex");
      }
    }
  };

  for (const groupElement of convertToGroupElements) {
    const groupName = groupElement.dataset.converter;

    const targetElements = groupElement.querySelectorAll(".target");
    const targets = Array.from(targetElements);

    for (const target of targets) {
      target.setAttribute("aria-selected", "false");
      target.onclick = () => {
        for (const candidate of document.querySelectorAll(".target[aria-selected='true']")) {
          candidate.setAttribute("aria-selected", "false");
        }
        convertToElement.value = target.dataset.value;
        convertToInput.value = `${target.dataset.target} using ${target.dataset.converter}`;
        target.setAttribute("aria-selected", "true");
        const supportedSources = document.querySelector("#supported-sources");
        if (supportedSources) {
          supportedSources.textContent = target.dataset.sources
            ? getTranslation("convert", "supportedSources", { sources: target.dataset.sources })
            : "";
        }
        formatSelected = true;
        refreshConvertButton();
        showMatching("");
        convertToPopup.classList.add("hidden");
        convertToPopup.classList.remove("flex");
      };
    }

    convertToGroups[groupName] = [targets, groupElement];
  }

  convertToInput.addEventListener("input", (e) => {
    const selected = document.querySelector(".target[aria-selected='true']");
    const selectedLabel = selected
      ? `${selected.dataset.target} using ${selected.dataset.converter}`
      : "";
    if (e.target.value !== selectedLabel) clearFormatSelection();
    showMatching(e.target.value.toLowerCase());
  });

  convertToInput.addEventListener("search", () => {
    // when the user clears the search bar using the 'x' button
    clearFormatSelection();
  });

  convertToInput.addEventListener("blur", (e) => {
    // Keep the popup open even when clicking on a target button
    // so the subsequent click event can complete the selection.
    if (e?.relatedTarget?.classList?.contains("target")) {
      return;
    }

    convertToPopup.classList.add("hidden");
    convertToPopup.classList.remove("flex");
  });

  convertToInput.addEventListener("focus", () => {
    convertToPopup.classList.remove("hidden");
    convertToPopup.classList.add("flex");
  });

  const defaults = new URLSearchParams(window.location.search);
  const defaultTarget = defaults.get("to");
  const defaultConverter = defaults.get("converter");
  if (defaultTarget && !convertToElement.value) {
    const match = Array.from(document.querySelectorAll(".target")).find(
      (target) =>
        target.dataset.target === defaultTarget &&
        (!defaultConverter || target.dataset.converter === defaultConverter),
    );
    match?.click();
  }
};

// Add a 'change' event listener to the file input element
fileInput.addEventListener("change", (e) => {
  const files = e.target.files;
  for (const file of files) {
    handleFile(file);
  }
});

const setTitle = () => {
  const title = document.querySelector("h1");
  if (fileType) {
    title.textContent = getTranslation("convert", "titleWithType", { fileType });
  } else {
    title.textContent = getTranslation("convert", "title");
  }
};

// Add a onclick for the delete button
// 🧠 記憶體管理：刪除時清理相關任務資源
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const deleteRow = async (target) => {
  const filename = target.parentElement.parentElement.children[0].textContent;
  const row = target.parentElement.parentElement;
  const state = uploadStates.get(filename);
  if (state) {
    state.removed = true;
    state.controller?.abort();
    state.xhr?.abort();
    if (!(await cancelUploadSession(state))) {
      state.removed = false;
      const status = row.querySelector(".upload-status");
      if (status) status.textContent = getTranslation("errors", "uploadCancelFailed");
      refreshConvertButton();
      return;
    }
  }
  try {
    const response = await fetch(`${webroot}/delete`, {
      method: "POST",
      body: JSON.stringify({ filename: filename, csrf_token: csrfToken }),
      headers: { "Content-Type": "application/json" },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.success) {
      throw new Error(payload.message || `Delete failed (${response.status})`);
    }
  } catch (error) {
    if (state) state.removed = false;
    const status = row.querySelector(".upload-status");
    if (status) status.textContent = error.message || getTranslation("errors", "deleteFailed");
    refreshConvertButton();
    return;
  }
  if (state?.pending) {
    state.pending = false;
    pendingFiles = Math.max(0, pendingFiles - 1);
  }
  uploadStates.delete(filename);
  row.remove();

  // 🧠 等級二：清理該檔案的上傳任務
  await finishUploadTask(filename, "aborted");

  // 從 fileRowMap 中移除
  const fileRowMap = window._fileRowMap;
  if (fileRowMap) {
    fileRowMap.delete(filename);
  }

  // remove from fileNames
  const index = fileNames.indexOf(filename);
  if (index >= 0) fileNames.splice(index, 1);

  // reset fileInput
  fileInput.value = "";

  // if fileNames is empty, reset fileType
  if (fileNames.length === 0) {
    fileType = null;
    fileInput.removeAttribute("accept");
    refreshConvertButton();
    setTitle();

    // 🧠 等級二：清理所有殘留任務
    await cleanupAllUploadTasks();
  }

  refreshConvertButton();
};

/**
 * Complete one upload attempt and refresh conversion readiness.
 */
async function finalizeUpload(fileName, row, attempt, success, message) {
  const state = uploadStates.get(fileName);
  if (!state || state.removed || state.attempt !== attempt) return;
  if (state.pending) {
    state.pending = false;
    pendingFiles = Math.max(0, pendingFiles - 1);
  }
  row.dataset.uploadStatus = success ? "completed" : "failed";
  const status = row.querySelector(".upload-status");
  if (status) status.textContent = message;

  if (success && !fileNames.includes(fileName)) fileNames.push(fileName);
  if (success) {
    const progress = row.querySelector("progress");
    if (progress?.parentElement) progress.parentElement.remove();
  }
  if (!success) await cancelUploadSession(state);
  const retryButton = row.querySelector("button:nth-of-type(2)");
  if (retryButton) retryButton.classList.toggle("hidden", success);

  await finishUploadTask(fileName, success ? "completed" : "failed");
  convertButton.value = getTranslation("convert", "convertButton");
  refreshConvertButton();
}

const uploadFile = async (file, row, fileName) => {
  const state = uploadStates.get(fileName);
  if (!state || state.removed) return;
  if (state.uploadId && !(await cancelUploadSession(state))) {
    const status = row.querySelector(".upload-status");
    if (status) status.textContent = getTranslation("errors", "uploadCleanupFailed");
    return;
  }
  state.attempt += 1;
  const attempt = state.attempt;
  state.pending = true;
  state.controller = new AbortController();
  state.xhr = null;
  const retryButton = row.querySelector("button:nth-of-type(2)");
  if (retryButton) retryButton.classList.add("hidden");
  row.dataset.uploadStatus = "uploading";
  const status = row.querySelector(".upload-status");
  if (status) status.textContent = getTranslation("convert", "uploading");
  let progress = row.querySelector("progress");
  if (!progress) {
    progress = document.createElement("progress");
    progress.max = 100;
    row.children[1].appendChild(progress);
  }
  progress.value = 0;
  convertButton.disabled = true;
  convertButton.value = getTranslation("convert", "uploading");
  pendingFiles += 1;
  let session;
  try {
    const response = await fetch(`${webroot}/upload-info`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file_name: fileName, file_size: file.size }),
      signal: state.controller.signal,
    });
    session = await response.json();
    if (!response.ok || !session.success)
      throw new Error(session.message || `Upload initialization failed (${response.status})`);
  } catch (error) {
    if (error.name !== "AbortError") {
      await finalizeUpload(
        fileName,
        row,
        attempt,
        false,
        error.message || "Upload initialization failed",
      );
    }
    return;
  }
  state.uploadId = session.upload_id;
  if (session.mode === "chunked") await uploadFileChunked(file, row, fileName, session, attempt);
  else uploadFileDirect(file, row, fileName, session, attempt);
};

const uploadFileDirect = (file, row, fileName, session, attempt) => {
  const formData = new FormData();
  formData.append("upload_id", session.upload_id);
  formData.append("file", file, fileName);
  const xhr = new XMLHttpRequest();
  const state = uploadStates.get(fileName);
  if (!state || state.attempt !== attempt) return;
  state.xhr = xhr;
  xhr.open("POST", `${webroot}/upload`, true);
  xhr.onload = async () => {
    let data = {};
    try {
      data = JSON.parse(xhr.responseText);
    } catch (error) {
      console.warn("Invalid upload response", error);
    }
    if (xhr.status < 200 || xhr.status >= 300 || !data.success) {
      await finalizeUpload(
        fileName,
        row,
        attempt,
        false,
        data.message || `Upload failed (${xhr.status})`,
      );
      return;
    }
    await finalizeUpload(fileName, row, attempt, true, data.message || "Upload completed");
  };
  xhr.upload.onprogress = (event) => {
    if (!event.lengthComputable) return;
    const progress = row.querySelector("progress");
    if (progress) progress.value = Math.round((100 * event.loaded) / event.total);
  };
  xhr.onerror = async () => {
    await finalizeUpload(fileName, row, attempt, false, "Upload connection failed");
  };
  xhr.onabort = () => {};
  xhr.send(formData);
};

const uploadFileChunked = async (file, row, fileName, session, attempt) => {
  const state = uploadStates.get(fileName);
  if (!state || state.attempt !== attempt) return;
  try {
    for (let chunkIndex = 0; chunkIndex < session.total_chunks; chunkIndex++) {
      const start = chunkIndex * session.chunk_size;
      const formData = new FormData();
      formData.append("upload_id", session.upload_id);
      formData.append("chunk_index", chunkIndex.toString());
      formData.append("chunk", file.slice(start, Math.min(start + session.chunk_size, file.size)));
      const response = await fetch(`${webroot}/upload-chunk`, {
        method: "POST",
        body: formData,
        signal: state.controller.signal,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success)
        throw new Error(
          payload.message || `Chunk ${chunkIndex} upload failed (${response.status})`,
        );
      const progress = row.querySelector("progress");
      if (progress) progress.value = Math.round(((chunkIndex + 1) / session.total_chunks) * 100);
    }
    await finalizeUpload(fileName, row, attempt, true, "Upload completed");
  } catch (error) {
    if (error.name === "AbortError") return;
    console.error("Chunked upload failed:", error);
    await finalizeUpload(fileName, row, attempt, false, error.message || "Chunked upload failed");
  }
};

function retryUpload(fileName) {
  const state = uploadStates.get(fileName);
  if (!state || state.pending || state.removed) return;
  createUploadTask(fileName);
  uploadFile(state.file, state.row, fileName);
}
const formConvert = document.querySelector(`form[action='${webroot}/convert']`);

formConvert.addEventListener("submit", () => {
  const hiddenInput = document.querySelector("input[name='file_names']");
  hiddenInput.value = JSON.stringify(fileNames);
});

updateSearchBar();

// ==================== 格式推斷功能 ====================

/**
 * 觸發格式推斷
 * @param {string} ext - 檔案副檔名
 * @param {number} fileSize - 檔案大小 (bytes)
 */
async function triggerFormatInference(ext, fileSize) {
  if (formatSelected) return;
  // 檢查推斷模組是否可用
  if (!window.inferenceModule) {
    console.warn("Inference module not loaded");
    return;
  }

  const fileSizeKb = Math.round(fileSize / 1024);

  try {
    const result = await window.inferenceModule.requestFormatInference(ext, fileSizeKb);
    if (formatSelected) return;

    if (result && result.should_auto_fill && result.format) {
      // 自動填入推斷的 search token (模擬使用者輸入)
      // 傳遞 is_cold_start 以顯示正確的 UX 提示
      window.inferenceModule.autoFillInferredFormat(
        result.format.search_token,
        result.engine?.engine,
        result.format.is_cold_start,
      );

      // 嘗試自動選擇對應的引擎選項
      if (result.engine) {
        autoSelectEngine(result.format.search_token, result.engine.engine);
      }
    }
  } catch (error) {
    console.warn("Format inference failed:", error);
  }
}

/**
 * 自動選擇推薦的引擎
 * @param {string} format - 目標格式
 * @param {string} engine - 推薦引擎
 */
function autoSelectEngine(format, engine) {
  // 尋找對應的目標按鈕
  const targetButtons = document.querySelectorAll(".target");

  // 收集所有匹配格式的按鈕和它們的引擎
  const matchingButtons = [];
  for (const button of targetButtons) {
    const targetFormat = button.dataset.target;
    const converter = button.dataset.converter;

    if (targetFormat && targetFormat.toLowerCase() === format.toLowerCase()) {
      // 檢查按鈕是否可見（引擎可用）
      const isVisible = !button.classList.contains("hidden") && button.offsetParent !== null;

      matchingButtons.push({
        button,
        converter: converter || "",
        isVisible,
        // 計算引擎匹配分數
        engineMatch:
          converter && engine
            ? converter.toLowerCase() === engine.toLowerCase()
              ? 2 // 完全匹配
              : converter.toLowerCase().includes(engine.toLowerCase())
                ? 1 // 部分匹配
                : 0 // 不匹配
            : 0,
      });
    }
  }

  if (matchingButtons.length === 0) {
    console.log(`🎯 No matching format found: ${format}`);
    return;
  }

  // 按優先級排序：可見性 > 引擎匹配度
  matchingButtons.sort((a, b) => {
    // 優先選擇可見的按鈕
    if (a.isVisible !== b.isVisible) {
      return a.isVisible ? -1 : 1;
    }
    // 然後按引擎匹配度排序
    return b.engineMatch - a.engineMatch;
  });

  // 選擇最佳匹配
  const best = matchingButtons[0];
  if (best && best.isVisible) {
    best.button.click();
    console.log(`🎯 Auto-selected: ${format} using ${best.converter}`);
  } else if (matchingButtons.some((b) => b.isVisible)) {
    // 選擇第一個可見的按鈕
    const firstVisible = matchingButtons.find((b) => b.isVisible);
    if (firstVisible) {
      firstVisible.button.click();
      console.log(`🎯 Auto-selected format: ${format} using ${firstVisible.converter}`);
    }
  } else {
    console.log(`🎯 No visible button for format: ${format}`);
  }
}

// 將 fileType 暴露給推斷模組
window.fileType = fileType;

// 監聽 fileType 變化
Object.defineProperty(window, "fileType", {
  get: () => fileType,
  set: (value) => {
    fileType = value;
  },
});
