// 預設開放註冊（開箱即用），管理者可設為 false 來關閉
export const ACCOUNT_REGISTRATION = process.env.ACCOUNT_REGISTRATION?.toLowerCase() !== "false";

export const HTTP_ALLOWED = process.env.HTTP_ALLOWED?.toLowerCase() === "true" || false;

// Trust proxy headers (X-Forwarded-*) for correct HTTPS detection behind reverse proxy
export const TRUST_PROXY = process.env.TRUST_PROXY?.toLowerCase() === "true" || false;

export const ALLOW_UNAUTHENTICATED =
  process.env.ALLOW_UNAUTHENTICATED?.toLowerCase() === "true" || false;

export const AUTO_DELETE_EVERY_N_HOURS = process.env.AUTO_DELETE_EVERY_N_HOURS
  ? Number(process.env.AUTO_DELETE_EVERY_N_HOURS)
  : 24;

export const HIDE_HISTORY = process.env.HIDE_HISTORY?.toLowerCase() === "true" || false;
export const BRANDING = process.env.BRANDING ?? "ConvertX-CN";

export const WEBROOT = process.env.WEBROOT ?? "";

export const LANGUAGE = process.env.LANGUAGE?.toLowerCase() || "en";

export const DATA_DIR = process.env.DATA_DIR?.trim() || "./data";

const DEFAULT_HTTP_ALLOWED_FILE_SIZE = 500 * 1024 * 1024;

function parsePositiveIntegerEnv(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;

  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer number of bytes`);
  }
  return value;
}

export const HTTP_ALLOWED_FILE_SIZE = parsePositiveIntegerEnv(
  "HTTP_ALLOWED_FILE_SIZE",
  DEFAULT_HTTP_ALLOWED_FILE_SIZE,
);

export const MAX_FILES_PER_JOB = parsePositiveIntegerEnv("MAX_FILES_PER_JOB", 100);
export const MAX_UPLOAD_SESSIONS_PER_USER = parsePositiveIntegerEnv(
  "MAX_UPLOAD_SESSIONS_PER_USER",
  100,
);

export const JWT_SECRET_FILE =
  process.env.JWT_SECRET_FILE?.trim() || `${DATA_DIR}/.secrets/jwt-secret`;

export const MAX_CONVERT_PROCESS =
  process.env.MAX_CONVERT_PROCESS && Number(process.env.MAX_CONVERT_PROCESS) > 0
    ? Number(process.env.MAX_CONVERT_PROCESS)
    : 0;

export const UNAUTHENTICATED_USER_SHARING =
  process.env.UNAUTHENTICATED_USER_SHARING?.toLowerCase() === "true" || false;

export const TIMEZONE = process.env.TZ || undefined;

// ========== 新增：處理模式設定 ==========

/**
 * MinerU 處理模式
 * - pipeline: 穩定的 OCR 處理模式（預設）
 *
 * 注意：本地 VLM / llama.cpp 功能已移除，
 * 即使設定 vlm 也會由呼叫端回退到 pipeline。
 */
export const MINERU_MODE = ((): "pipeline" | "vlm" => {
  const mode = process.env.MINERU_MODE?.toLowerCase();
  if (mode === "vlm") return "vlm";
  // 相容舊的 MINERU_BACKEND 設定
  const backend = process.env.MINERU_BACKEND?.toLowerCase();
  if (backend?.includes("vlm")) return "vlm";
  return "pipeline";
})();

/**
 * API Keys（從環境變數讀取）
 */
export const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "";
export const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY ?? "";
export const OTHER_LLM_API_KEY = process.env.OTHER_LLM_API_KEY ?? "";
export const CUSTOM_LLM_BASE_URL = process.env.CUSTOM_LLM_BASE_URL ?? "";
