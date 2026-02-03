/**
 * Settings Page Form Handler
 *
 * 設計原則：
 * 1. 固定頁面頂部提示列 - 不閃爍、不隨 re-render 消失
 * 2. API Key 為選填 - 未設定不報錯
 * 3. 明確的成功/失敗回饋
 */
document.addEventListener("DOMContentLoaded", function () {
  const form = document.getElementById("api-keys-form");
  const statusBanner = document.getElementById("settings-status-banner");

  if (!form) {
    console.warn("Settings form not found");
    return;
  }

  // 隱藏提示列的計時器（避免多次觸發）
  let hideTimer = null;

  // 顯示狀態提示列
  function showStatus(type, message) {
    if (!statusBanner) return;

    // 清除之前的計時器
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }

    // 移除所有狀態類別
    statusBanner.classList.remove(
      "hidden",
      "status-success",
      "status-error",
      "status-info",
      "status-loading",
    );

    // 設定新狀態
    statusBanner.classList.add(`status-${type}`);
    statusBanner.textContent = message;

    // 成功或資訊訊息 5 秒後自動隱藏
    if (type === "success" || type === "info") {
      hideTimer = setTimeout(() => {
        statusBanner.classList.add("hidden");
      }, 5000);
    }
  }

  // 隱藏狀態提示列
  function hideStatus() {
    if (statusBanner) {
      statusBanner.classList.add("hidden");
    }
  }

  // 取得初始值用於變更偵測
  const getInitialValues = () => ({
    openai_api_key: document.getElementById("initial-openai-key")?.value || "",
    deepseek_api_key: document.getElementById("initial-deepseek-key")?.value || "",
    other_llm_api_key: document.getElementById("initial-other-llm-key")?.value || "",
    processing_mode: document.getElementById("initial-processing-mode")?.value || "pipeline",
    translation_provider: document.getElementById("initial-translation-provider")?.value || "local",
  });

  // 更新 effectiveMode 顯示（僅在儲存成功後調用）
  function updateEffectiveModeDisplay(mode) {
    const effectiveModeValue = document.getElementById("effective-mode-value");
    const fallbackNotice = document.getElementById("vlm-fallback-notice");

    if (effectiveModeValue) {
      effectiveModeValue.textContent = mode === "vlm" ? "VLM" : "Pipeline";
    }

    // 隱藏 fallback 提示（因為已經手動選擇）
    if (fallbackNotice) {
      fallbackNotice.classList.add("hidden");
    }
  }

  // 更新選項高亮樣式（即時響應，但不更新「生效中」文字）
  function updateOptionHighlight(selectedMode) {
    const pipelineLabel = document.getElementById("processing-mode-pipeline-label");
    const vlmLabel = document.getElementById("processing-mode-vlm-label");

    if (pipelineLabel && vlmLabel) {
      if (selectedMode === "pipeline") {
        pipelineLabel.classList.remove("bg-neutral-800/30", "hover:bg-neutral-800/50");
        pipelineLabel.classList.add("bg-neutral-800");
        vlmLabel.classList.remove("bg-neutral-800");
        vlmLabel.classList.add("bg-neutral-800/30", "hover:bg-neutral-800/50");
      } else {
        vlmLabel.classList.remove("bg-neutral-800/30", "hover:bg-neutral-800/50");
        vlmLabel.classList.add("bg-neutral-800");
        pipelineLabel.classList.remove("bg-neutral-800");
        pipelineLabel.classList.add("bg-neutral-800/30", "hover:bg-neutral-800/50");
      }
    }
  }

  // 監聽處理模式選項變更，即時更新選項高亮（不更新「生效中」）
  const processingModeRadios = form.querySelectorAll('input[name="processing_mode"]');
  processingModeRadios.forEach((radio) => {
    radio.addEventListener("change", function () {
      updateOptionHighlight(this.value);
    });
  });

  // 表單提交處理
  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    e.stopPropagation();

    const formData = new FormData(form);
    const submitBtn = form.querySelector('input[type="submit"]');

    // 取得 i18n 字串
    const successText = statusBanner?.dataset.success || "設定已成功更新";
    const errorText = statusBanner?.dataset.error || "設定更新失敗，請稍後再試";
    const updatingText = statusBanner?.dataset.updating || "儲存中...";
    const noChangesText = statusBanner?.dataset.noChanges || "沒有變更需要儲存";

    // 取得目前表單值
    const currentValues = {
      openai_api_key: formData.get("openai_api_key") || "",
      deepseek_api_key: formData.get("deepseek_api_key") || "",
      other_llm_api_key: formData.get("other_llm_api_key") || "",
      processing_mode: formData.get("processing_mode") || "pipeline",
      translation_provider: formData.get("translation_provider") || "local",
    };

    // 取得初始值
    const initialValues = getInitialValues();

    // 檢查是否有變更
    const hasChanges =
      currentValues.openai_api_key !== initialValues.openai_api_key ||
      currentValues.deepseek_api_key !== initialValues.deepseek_api_key ||
      currentValues.other_llm_api_key !== initialValues.other_llm_api_key ||
      currentValues.processing_mode !== initialValues.processing_mode ||
      currentValues.translation_provider !== initialValues.translation_provider;

    // 如果沒有變更，顯示提示並返回
    if (!hasChanges) {
      showStatus("info", noChangesText);
      return false;
    }

    // 顯示儲存中狀態
    showStatus("loading", updatingText);

    // 禁用提交按鈕
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.classList.add("opacity-60", "cursor-wait");
    }

    try {
      // 計算 webroot 路徑
      const pathname = window.location.pathname;
      const webroot = pathname.endsWith("/settings") ? pathname.slice(0, -9) : "";

      const response = await fetch(`${webroot}/settings/api-keys`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin", // 確保傳送 cookie
        body: JSON.stringify(currentValues),
      });

      if (response.ok) {
        // 成功
        showStatus("success", "✓ " + successText);

        // 更新初始值（避免重複提交相同值）
        const initProcessingMode = document.getElementById("initial-processing-mode");
        const initTranslationProvider = document.getElementById("initial-translation-provider");
        const initOpenai = document.getElementById("initial-openai-key");
        const initDeepseek = document.getElementById("initial-deepseek-key");
        const initOtherLlm = document.getElementById("initial-other-llm-key");

        if (initProcessingMode) initProcessingMode.value = currentValues.processing_mode;
        if (initTranslationProvider)
          initTranslationProvider.value = currentValues.translation_provider;
        if (initOpenai) initOpenai.value = currentValues.openai_api_key;
        if (initDeepseek) initDeepseek.value = currentValues.deepseek_api_key;
        if (initOtherLlm) initOtherLlm.value = currentValues.other_llm_api_key;

        // 即時更新 effectiveMode 顯示
        updateEffectiveModeDisplay(currentValues.processing_mode);
      } else {
        // 失敗 - 顯示錯誤但不阻止使用
        // API Key 為選填，空值不應該導致錯誤
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData.message || errorText;
        showStatus("error", "✕ " + errorMsg);
      }
    } catch (err) {
      console.error("Settings save error:", err);
      showStatus("error", "✕ " + errorText);
    } finally {
      // 恢復提交按鈕
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.classList.remove("opacity-60", "cursor-wait");
      }
    }

    return false;
  });

  // 初始化時隱藏狀態列
  hideStatus();
});
