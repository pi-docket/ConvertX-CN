/**
 * 處理模式配置管理
 *
 * 管理 MinerU 的處理模式設定（pipeline / vlm）
 * - 預設為 pipeline（穩定相容）
 * - 設定會持久化到資料庫
 * - 後端啟動時讀取使用者設定
 */

import db from "../db/db";

// 處理模式類型
export type ProcessingMode = "pipeline" | "vlm";

// 預設模式（必須是 pipeline）
export const DEFAULT_PROCESSING_MODE: ProcessingMode = "pipeline";

// 設定名稱常數
const SETTING_KEY = "processing_mode";

/**
 * 確保 settings 表存在
 */
function ensureSettingsTable(): void {
  db.query(
    `
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(user_id, key)
    )
  `,
  ).run();
}

/**
 * 取得使用者的處理模式設定
 * @param userId - 使用者 ID
 * @returns 處理模式（預設為 pipeline）
 */
export function getUserProcessingMode(userId: number): ProcessingMode {
  ensureSettingsTable();

  const result = db
    .query("SELECT value FROM settings WHERE user_id = ? AND key = ?")
    .get(userId, SETTING_KEY) as { value: string } | null;

  if (result?.value === "vlm" || result?.value === "pipeline") {
    return result.value;
  }

  return DEFAULT_PROCESSING_MODE;
}

/**
 * 設定使用者的處理模式
 * @param userId - 使用者 ID
 * @param mode - 處理模式
 */
export function setUserProcessingMode(userId: number, mode: ProcessingMode): void {
  ensureSettingsTable();

  const now = new Date().toISOString();
  const existing = db
    .query("SELECT id FROM settings WHERE user_id = ? AND key = ?")
    .get(userId, SETTING_KEY);

  if (existing) {
    db.query("UPDATE settings SET value = ?, updated_at = ? WHERE user_id = ? AND key = ?").run(
      mode,
      now,
      userId,
      SETTING_KEY,
    );
  } else {
    db.query(
      "INSERT INTO settings (user_id, key, value, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
    ).run(userId, SETTING_KEY, mode, now, now);
  }

  console.log(`[CONFIG] User ${userId} processing mode set to: ${mode}`);
}

/**
 * 檢查 VLM 是否可用
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
    | "fallback_active";
  message: string;
}> {
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

  const vlmUrl = process.env.MINERU_VLM_URL || "http://127.0.0.1:11785/v1";

  try {
    const healthUrl = vlmUrl.replace("/v1", "/health");
    const response = await fetch(healthUrl, {
      method: "GET",
      signal: AbortSignal.timeout(3000),
    });

    if (response.ok) {
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
 * 取得有效的處理模式（考慮 VLM 可用性）
 * 如果用戶選擇 VLM 但 VLM 不可用，會自動回退到 pipeline
 */
export async function getEffectiveProcessingMode(
  userId: number,
): Promise<{ mode: ProcessingMode; isAutoFallback: boolean }> {
  const userMode = getUserProcessingMode(userId);

  if (userMode === "pipeline") {
    return { mode: "pipeline", isAutoFallback: false };
  }

  // 用戶選擇了 VLM，檢查可用性
  const vlmStatus = await checkVlmAvailability();

  if (vlmStatus.available) {
    return { mode: "vlm", isAutoFallback: false };
  }

  // VLM 不可用，自動回退
  return { mode: "pipeline", isAutoFallback: true };
}
