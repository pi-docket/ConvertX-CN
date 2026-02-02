const webroot = document.querySelector("meta[name='webroot']").content;
const fileInput = document.querySelector('input[type="file"]');
const convertButton = document.querySelector("input[type='submit']");
const fileNames = [];
let fileType;
let pendingFiles = 0;
let formatSelected = false;

// Get translation helper
const getTranslation = (category, key, params) => {
  if (typeof window.t === "function") {
    return window.t(category, key, params);
  }
  // Fallback to English if t is not available
  const fallbacks = {
    "common.remove": "Remove",
    "convert.title": "Convert",
    "convert.titleWithType": "Convert .{fileType}",
    "convert.convertButton": "Convert",
    "convert.uploading": "Uploading...",
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
// 只監聽 dragover 和 drop，不操作任何 UI class
// 這樣虛線框不會變粗、不會閃爍

// 防重複機制：記錄最近處理的檔案
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
document.addEventListener("drop", (e) => {
  e.preventDefault();
  e.stopPropagation();

  const files = e.dataTransfer.files;

  if (files.length === 0) {
    console.warn("No files dropped — likely a URL or unsupported source.");
    return;
  }

  for (const file of files) {
    console.log("Handling dropped file:", file.name);
    handleFile(file);
  }
});
// ===== 全頁拖曳上傳支援結束 =====

// Extracted handleFile function for reusability in drag-and-drop and file input
function handleFile(file) {
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
  row.innerHTML = `
    <td>${file.name}</td>
    <td><progress max="100" class="inline-block h-2 appearance-none overflow-hidden rounded-full border-0 bg-neutral-700 bg-none text-accent-500 accent-accent-500 [&::-moz-progress-bar]:bg-accent-500 [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:[background:none] [&[value]::-webkit-progress-value]:bg-accent-500 [&[value]::-webkit-progress-value]:transition-[inline-size]"></progress></td>
    <td>${(file.size / 1024).toFixed(2)} kB</td>
    <td><a onclick="deleteRow(this)">${removeText}</a></td>
  `;

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
  file.htmlRow = row;
  fileNames.push(file.name);
  uploadFile(file);
}

const selectContainer = document.querySelector("form .select_container");

const updateSearchBar = () => {
  const convertToInput = document.querySelector("input[name='convert_to_search']");
  const convertToPopup = document.querySelector(".convert_to_popup");
  const convertToGroupElements = document.querySelectorAll(".convert_to_group");
  const convertToGroups = {};
  const convertToElement = document.querySelector("select[name='convert_to']");

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
      target.onmousedown = () => {
        convertToElement.value = target.dataset.value;
        convertToInput.value = `${target.dataset.target} using ${target.dataset.converter}`;
        formatSelected = true;
        if (pendingFiles === 0 && fileNames.length > 0) {
          convertButton.disabled = false;
        }
        showMatching("");
      };
    }

    convertToGroups[groupName] = [targets, groupElement];
  }

  convertToInput.addEventListener("input", (e) => {
    showMatching(e.target.value.toLowerCase());
  });

  convertToInput.addEventListener("search", () => {
    // when the user clears the search bar using the 'x' button
    convertButton.disabled = true;
    formatSelected = false;
  });

  convertToInput.addEventListener("blur", (e) => {
    // Keep the popup open even when clicking on a target button
    // for a split second to allow the click to go through
    if (e?.relatedTarget?.classList?.contains("target")) {
      convertToPopup.classList.add("hidden");
      convertToPopup.classList.remove("flex");
      return;
    }

    convertToPopup.classList.add("hidden");
    convertToPopup.classList.remove("flex");
  });

  convertToInput.addEventListener("focus", () => {
    convertToPopup.classList.remove("hidden");
    convertToPopup.classList.add("flex");
  });
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
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const deleteRow = (target) => {
  const filename = target.parentElement.parentElement.children[0].textContent;
  const row = target.parentElement.parentElement;
  row.remove();

  // remove from fileNames
  const index = fileNames.indexOf(filename);
  fileNames.splice(index, 1);

  // reset fileInput
  fileInput.value = "";

  // if fileNames is empty, reset fileType
  if (fileNames.length === 0) {
    fileType = null;
    fileInput.removeAttribute("accept");
    convertButton.disabled = true;
    setTitle();
  }

  fetch(`${webroot}/delete`, {
    method: "POST",
    body: JSON.stringify({ filename: filename }),
    headers: {
      "Content-Type": "application/json",
    },
  }).catch((err) => console.log(err));
};

// ==================== 全域傳輸常數 ====================
const CHUNK_THRESHOLD_BYTES = 10 * 1024 * 1024; // 10MB
const CHUNK_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

/**
 * 判斷是否需要使用 chunk 傳輸
 */
function shouldUseChunkedUpload(fileSize) {
  return fileSize > CHUNK_THRESHOLD_BYTES;
}

/**
 * 生成 UUID
 */
function generateUploadId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * 統一上傳檔案（自動判斷使用直傳或 chunk）
 *
 * @param {File} file - 要上傳的檔案
 */
const uploadFile = (file) => {
  convertButton.disabled = true;
  convertButton.value = getTranslation("convert", "uploading");
  pendingFiles += 1;

  if (shouldUseChunkedUpload(file.size)) {
    // 大檔：使用 chunk 上傳
    uploadFileChunked(file);
  } else {
    // 小檔：直接上傳
    uploadFileDirect(file);
  }
};

/**
 * 直接上傳（≤10MB）
 */
const uploadFileDirect = (file) => {
  const formData = new FormData();
  formData.append("file", file, file.name);

  let xhr = new XMLHttpRequest();

  xhr.open("POST", `${webroot}/upload`, true);

  xhr.onload = () => {
    let data = {};
    try {
      data = JSON.parse(xhr.responseText);
    } catch (e) {
      console.log("Parse error:", e);
    }

    pendingFiles -= 1;
    if (pendingFiles === 0) {
      if (formatSelected) {
        convertButton.disabled = false;
      }
      convertButton.value = getTranslation("convert", "convertButton");
    }

    // Remove the progress bar when upload is done
    let progressbar = file.htmlRow.getElementsByTagName("progress");
    if (progressbar[0]) {
      progressbar[0].parentElement.remove();
    }
    console.log("Direct upload complete:", data);
  };

  xhr.upload.onprogress = (e) => {
    let sent = e.loaded;
    let total = e.total;
    console.log(`upload progress (${file.name}):`, (100 * sent) / total);

    let progressbar = file.htmlRow.getElementsByTagName("progress");
    if (progressbar[0]) {
      progressbar[0].value = (100 * sent) / total;
    }
  };

  xhr.onerror = (e) => {
    console.log("Upload error:", e);
    pendingFiles -= 1;
    if (pendingFiles === 0) {
      convertButton.value = getTranslation("convert", "convertButton");
    }
  };

  xhr.send(formData);
};

/**
 * Chunk 上傳（>10MB）
 */
const uploadFileChunked = async (file) => {
  const uploadId = generateUploadId();
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE_BYTES);

  console.log(`Starting chunked upload: ${file.name}, size: ${file.size}, chunks: ${totalChunks}`);

  try {
    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      const start = chunkIndex * CHUNK_SIZE_BYTES;
      const end = Math.min(start + CHUNK_SIZE_BYTES, file.size);
      const chunk = file.slice(start, end);

      const formData = new FormData();
      formData.append("upload_id", uploadId);
      formData.append("chunk_index", chunkIndex.toString());
      formData.append("total_chunks", totalChunks.toString());
      formData.append("file_name", file.name);
      formData.append("total_size", file.size.toString());
      formData.append("chunk", chunk);

      const response = await fetch(`${webroot}/upload-chunk`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Chunk ${chunkIndex} upload failed: ${response.status}`);
      }

      // 更新進度
      const percent = ((chunkIndex + 1) / totalChunks) * 100;
      let progressbar = file.htmlRow.getElementsByTagName("progress");
      if (progressbar[0]) {
        progressbar[0].value = percent;
      }
      console.log(`Chunk ${chunkIndex + 1}/${totalChunks} uploaded (${percent.toFixed(1)}%)`);
    }

    // 完成
    pendingFiles -= 1;
    if (pendingFiles === 0) {
      if (formatSelected) {
        convertButton.disabled = false;
      }
      convertButton.value = getTranslation("convert", "convertButton");
    }

    // Remove the progress bar
    let progressbar = file.htmlRow.getElementsByTagName("progress");
    if (progressbar[0]) {
      progressbar[0].parentElement.remove();
    }
    console.log("Chunked upload complete:", file.name);
  } catch (error) {
    console.error("Chunked upload failed:", error);
    pendingFiles -= 1;
    if (pendingFiles === 0) {
      convertButton.value = getTranslation("convert", "convertButton");
    }
  }
};

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
  // 檢查推斷模組是否可用
  if (!window.inferenceModule) {
    console.warn("Inference module not loaded");
    return;
  }

  const fileSizeKb = Math.round(fileSize / 1024);

  try {
    const result = await window.inferenceModule.requestFormatInference(ext, fileSizeKb);

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
