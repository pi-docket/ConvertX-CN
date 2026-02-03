const webroot = document.querySelector("meta[name='webroot']").content;
const jobId = window.location.pathname.split("/").pop();
const main = document.querySelector("main");
let progressElem = document.querySelector("progress");
let lastFileCount = 0;
let completedFileNames = new Set();
let startTime = Date.now();

console.log(`📋 [Job Started] Job ID: ${jobId} - Monitoring conversion progress...`);

/**
 * 格式化時間差
 * @param {number} ms - 毫秒數
 * @returns {string}
 */
const formatDuration = (ms) => {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
};

/**
 * 更新進度條 UI
 * @param {number} completed - 已完成數量
 * @param {number} total - 總數量
 */
const updateProgressBar = (completed, total) => {
  progressElem = document.querySelector("progress");
  if (progressElem) {
    progressElem.value = completed;
    progressElem.max = total;
  }
};

/**
 * 獲取 JSON 進度資料
 */
const fetchProgressJson = async () => {
  try {
    const response = await fetch(`${webroot}/progress-json/${jobId}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  } catch (err) {
    console.warn(`⚠️ [Progress API] Failed to fetch JSON progress, falling back to HTML`);
    return null;
  }
};

const refreshData = async () => {
  // 嘗試使用 JSON API 獲取更詳細的進度
  const progressData = await fetchProgressJson();

  if (progressData && !progressData.error) {
    const { jobId: jid, totalFiles, completedFiles, progress, files, status } = progressData;

    // 檢查新完成的檔案
    for (const file of files) {
      const fileKey = file.outputFileName;
      if (!completedFileNames.has(fileKey)) {
        completedFileNames.add(fileKey);
        const elapsed = formatDuration(Date.now() - startTime);
        console.log(
          `🔄 [Conversion] Job ${jid} | ${completedFiles}/${totalFiles} (${progress}%) | ` +
            `Completed: "${file.fileName}" → "${file.outputFileName}" | Status: ${file.status} | Elapsed: ${elapsed}`,
        );
      }
    }

    // 更新進度條
    updateProgressBar(completedFiles, totalFiles);

    // 如果完成
    if (completedFiles === totalFiles && totalFiles > 0) {
      const elapsed = formatDuration(Date.now() - startTime);
      console.log(
        `✅ [Conversion Complete] Job ${jid} | All ${totalFiles} files converted | Total time: ${elapsed}`,
      );
      console.log(
        `📁 [Files Converted]`,
        files.map((f) => f.outputFileName),
      );

      // 最後刷新一次 HTML 以顯示完整結果
      await refreshHtml();
      return; // 停止輪詢
    }
  }

  // 刷新 HTML（用於 UI 更新）
  await refreshHtml();

  // 繼續輪詢
  progressElem = document.querySelector("progress");
  if (progressElem && progressElem.value !== progressElem.max) {
    setTimeout(refreshData, 1000);
  }
};

/**
 * 刷新 HTML 內容
 */
const refreshHtml = async () => {
  try {
    const response = await fetch(`${webroot}/progress/${jobId}`, { method: "POST" });
    const html = await response.text();
    main.innerHTML = html;
  } catch (err) {
    console.error(`❌ [Error] Failed to refresh HTML:`, err);
  }
};

refreshData();

window.downloadAll = function () {
  // Get all download links
  const downloadLinks = document.querySelectorAll("tbody a[download]");
  const fileCount = downloadLinks.length;

  console.log(`📥 [Download Started] Job ${jobId} | Downloading ${fileCount} files...`);

  // Trigger download for each link
  downloadLinks.forEach((link, index) => {
    const fileName = link.getAttribute("download") || `file_${index + 1}`;

    // We add a delay for each download to prevent them from starting at the same time
    setTimeout(() => {
      console.log(`📥 [Downloading] Job ${jobId} | ${index + 1}/${fileCount}: ${fileName}`);
      const event = new MouseEvent("click");
      link.dispatchEvent(event);

      // 最後一個檔案下載後記錄完成
      if (index === fileCount - 1) {
        setTimeout(() => {
          console.log(
            `✅ [Download Complete] Job ${jobId} | All ${fileCount} files download initiated`,
          );
        }, 100);
      }
    }, index * 300);
  });
};
