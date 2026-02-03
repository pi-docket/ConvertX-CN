/**
 * 處理模式配置管理
 *
 * 管理 MinerU 的處理模式設定（pipeline / vlm）
 *
 * 設計原則：
 * - 預設一律使用 pipeline（穩定、無需額外依賴）
 * - VLM 為進階選項，需要額外條件才能啟用
 * - 失敗自動回退到 pipeline，確保系統穩定性
 *
 * 環境變數：
 * - MINERU_MODE: 處理模式（pipeline | vlm），預設 pipeline
 * - MINERU_BACKEND: 後端類型（與 MINERU_MODE 相容）
 * - VLM_FALLBACK: 強制回退標記（由 entrypoint.sh 設定）
 * - VLM_AVAILABLE: VLM 可用性標記（由 entrypoint.sh 設定）
 * - VLM_ON_DEMAND: 按需啟動標記
 */

import { ensureVlmServer, isVlmHealthy, stopVlmServer } from "./vlmServer";

// 處理模式類型
export type ProcessingMode = "pipeline" | "vlm";

// 預設模式（必須是 pipeline）
export const DEFAULT_PROCESSING_MODE: ProcessingMode = "pipeline";

// VLM 狀態追蹤
let vlmFailureCount = 0;
const MAX_VLM_FAILURES = 3;
let isVlmForcedFallback = false;

/**
 * 從環境變數取得設定的處理模式
 * @returns 設定的處理模式（尚未驗證可用性）
 */
export function getConfiguredProcessingMode(): ProcessingMode {
  // 優先檢查 MINERU_MODE
  const mineruMode = process.env.MINERU_MODE?.toLowerCase();
  if (mineruMode === "vlm") {
    return "vlm";
  }
  if (mineruMode === "pipeline" || mineruMode === "pip") {
    return "pipeline";
  }

  // 相容舊的 MINERU_BACKEND 設定
  const backend = process.env.MINERU_BACKEND?.toLowerCase();
  if (backend?.includes("vlm")) {
    return "vlm";
  }

  // 預設使用 pipeline
  return DEFAULT_PROCESSING_MODE;
}

/**
 * 取得使用者的處理模式設定
 * @deprecated 處理模式現在由環境變數控制，userId 參數已忽略
 * @param __userId - 使用者 ID（已忽略）
 * @returns 處理模式（預設為 pipeline）
 */
export function getUserProcessingMode(_userId: number): ProcessingMode {
  return getConfiguredProcessingMode();
}

/**
 * 設定使用者的處理模式（已停用）
 * @deprecated 處理模式現在由環境變數控制，此函數不再有效
 */
export function setUserProcessingMode(_userId: number, _mode: ProcessingMode): boolean {
  console.warn(
    "[CONFIG] setUserProcessingMode is deprecated. Use MINERU_MODE environment variable.",
  );
  return false;
}

/**
 * 檢查 VLM 服務可用性（不自動啟動）
 * 僅檢查當前狀態，如需按需啟動請使用 ensureVlmAvailability()
 * @returns VLM 可用狀態和訊息
 */
export async function checkVlmAvailability(): Promise<{
  available: boolean;
  fallback: boolean;
  reason:
    | "available"
    | "server_unreachable"
    | "not_installed"
    | "model_missing"
    | "fallback_active"
    | "on_demand_available"
    | "forced_fallback";
  message: string;
}> {
  // 檢查是否被程式強制回退
  if (isVlmForcedFallback) {
    return {
      available: false,
      fallback: true,
      reason: "forced_fallback",
      message: "VLM forced fallback due to repeated failures",
    };
  }

  // 檢查是否已經啟用了回退模式（由 entrypoint.sh 設定）
  if (process.env.VLM_FALLBACK === "true") {
    return {
      available: false,
      fallback: true,
      reason: "fallback_active",
      message: "VLM unavailable, using pipeline mode",
    };
  }

  // 檢查環境變數標記（由 entrypoint.sh 設定）
  if (process.env.VLM_AVAILABLE === "false") {
    return {
      available: false,
      fallback: false,
      reason: "not_installed",
      message: "VLM service not installed on this system",
    };
  }

  // 按需啟動模式：VLM 可能當前未運行但可以啟動
  if (process.env.VLM_ON_DEMAND === "true") {
    // 先檢查是否已經在運行
    if (await isVlmHealthy()) {
      return {
        available: true,
        fallback: false,
        reason: "available",
        message: "VLM server is running",
      };
    }
    // 未運行但可以按需啟動
    return {
      available: true,
      fallback: false,
      reason: "on_demand_available",
      message: "VLM server available (on-demand, not currently running)",
    };
  }

  const vlmUrl = process.env.MINERU_VLM_URL || "http://127.0.0.1:11785/v1";

  try {
    const healthUrl = vlmUrl.replace("/v1", "/health");
    const response = await fetch(healthUrl, {
      method: "GET",
      signal: AbortSignal.timeout(3000),
    });

    if (response.ok) {
      // 重置失敗計數
      vlmFailureCount = 0;
      return {
        available: true,
        fallback: false,
        reason: "available",
        message: `VLM server available at ${vlmUrl}`,
      };
    }

    return {
      available: false,
      fallback: false,
      reason: "server_unreachable",
      message: `VLM server not responding at ${vlmUrl}`,
    };
  } catch (error) {
    return {
      available: false,
      fallback: false,
      reason: "server_unreachable",
      message: `VLM server unreachable: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * 確保 VLM 服務可用（按需啟動）
 * 如果 VLM 未運行，會嘗試啟動它
 */
export async function ensureVlmAvailability(): Promise<{
  available: boolean;
  fallback: boolean;
  reason: string;
  message: string;
}> {
  // 先檢查基本狀態
  const status = await checkVlmAvailability();

  // 如果已經可用（正在運行）或完全不可用（未安裝/回退），直接返回
  if (
    status.reason === "available" ||
    status.reason === "fallback_active" ||
    status.reason === "not_installed" ||
    status.reason === "forced_fallback"
  ) {
    return status;
  }

  // 按需啟動模式或服務器不可達：嘗試啟動
  if (status.reason === "on_demand_available" || status.reason === "server_unreachable") {
    console.log("[VLM] 嘗試按需啟動 VLM server...");
    const started = await ensureVlmServer();

    if (started) {
      vlmFailureCount = 0; // 重置失敗計數
      return {
        available: true,
        fallback: false,
        reason: "available",
        message: "VLM server started successfully (on-demand)",
      };
    }

    // 啟動失敗，記錄並可能觸發強制回退
    vlmFailureCount++;
    console.warn(`[VLM] 啟動失敗 (${vlmFailureCount}/${MAX_VLM_FAILURES})`);

    if (vlmFailureCount >= MAX_VLM_FAILURES) {
      isVlmForcedFallback = true;
      console.error("[VLM] 連續多次啟動失敗，強制回退到 pipeline 模式");
    }

    return {
      available: false,
      fallback: true,
      reason: "server_unreachable",
      message: "Failed to start VLM server on-demand, falling back to pipeline",
    };
  }

  return status;
}

/**
 * 報告 VLM 執行錯誤，可能觸發回退
 * @param error - 錯誤訊息
 */
export function reportVlmError(error: string): void {
  vlmFailureCount++;
  console.error(`[VLM] 執行錯誤 (${vlmFailureCount}/${MAX_VLM_FAILURES}): ${error}`);

  if (vlmFailureCount >= MAX_VLM_FAILURES) {
    isVlmForcedFallback = true;
    console.error("[VLM] 連續多次錯誤，強制回退到 pipeline 模式");

    // 嘗試停止 VLM server
    stopVlmServer().catch((e) => {
      console.warn("[VLM] 無法停止 VLM server:", e);
    });
  }
}

/**
 * 重置 VLM 回退狀態（用於手動恢復）
 */
export function resetVlmFallback(): void {
  vlmFailureCount = 0;
  isVlmForcedFallback = false;
  console.log("[VLM] 回退狀態已重置");
}

/**
 * 取得有效的處理模式（考慮 VLM 可用性）
 * 如果設定為 VLM 但 VLM 不可用，會自動回退到 pipeline
 *
 * @param __userId - 使用者 ID（已忽略，現在使用環境變數）
 */
export async function getEffectiveProcessingMode(
  _userId?: number,
): Promise<{ mode: ProcessingMode; isAutoFallback: boolean; reason?: string }> {
  const configuredMode = getConfiguredProcessingMode();

  // 如果設定為 pipeline，直接使用
  if (configuredMode === "pipeline") {
    return { mode: "pipeline", isAutoFallback: false };
  }

  // 設定為 VLM，檢查可用性
  const vlmStatus = await checkVlmAvailability();

  if (vlmStatus.available) {
    return { mode: "vlm", isAutoFallback: false };
  }

  // VLM 不可用，自動回退到 pipeline
  console.log(`[CONFIG] VLM 不可用 (${vlmStatus.reason}), 自動回退到 pipeline 模式`);
  return {
    mode: "pipeline",
    isAutoFallback: true,
    reason: vlmStatus.message,
  };
}

/**
 * 執行處理任務，自動處理 VLM 回退
 *
 * @param task - 要執行的任務
 * @param fallbackTask - VLM 失敗時的回退任務
 * @returns 任務結果
 */
export async function executeWithFallback<T>(
  task: () => Promise<T>,
  fallbackTask: () => Promise<T>,
): Promise<{ result: T; usedFallback: boolean }> {
  const effectiveMode = await getEffectiveProcessingMode();

  // 如果已經是 pipeline 或自動回退，直接使用 fallback
  if (effectiveMode.mode === "pipeline") {
    const result = await fallbackTask();
    return { result, usedFallback: effectiveMode.isAutoFallback };
  }

  // 嘗試使用 VLM
  try {
    const result = await task();
    return { result, usedFallback: false };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[VLM] 任務執行失敗: ${errorMessage}`);
    reportVlmError(errorMessage);

    // 回退到 pipeline
    console.log("[VLM] 自動回退到 pipeline 模式執行任務");
    const result = await fallbackTask();
    return { result, usedFallback: true };
  }
}
