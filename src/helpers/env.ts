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

export const WEBROOT = process.env.WEBROOT ?? "";

export const LANGUAGE = process.env.LANGUAGE?.toLowerCase() || "en";

export const MAX_CONVERT_PROCESS =
  process.env.MAX_CONVERT_PROCESS && Number(process.env.MAX_CONVERT_PROCESS) > 0
    ? Number(process.env.MAX_CONVERT_PROCESS)
    : 0;

export const UNAUTHENTICATED_USER_SHARING =
  process.env.UNAUTHENTICATED_USER_SHARING?.toLowerCase() === "true" || false;

export const TIMEZONE = process.env.TZ || undefined;

// ========== 新增：處理模式與翻譯服務設定 ==========

/**
 * MinerU 處理模式
 * - pipeline: 穩定的 OCR 處理模式（預設）
 * - vlm: 視覺語言模型處理模式（進階）
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
 * BabelDOC 翻譯引擎
 * - local: 本地 llama-server（預設）
 * - openai: OpenAI API
 * - deepseek: DeepSeek API
 * - custom: 自訂 API
 */
export const BABELDOC_ENGINE = ((): "local" | "openai" | "deepseek" | "custom" => {
  const engine = process.env.BABELDOC_ENGINE?.toLowerCase();
  switch (engine) {
    case "openai":
      return "openai";
    case "deepseek":
      return "deepseek";
    case "custom":
      return "custom";
    default:
      return "local";
  }
})();

/**
 * API Keys（從環境變數讀取）
 */
export const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "";
export const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY ?? "";
export const OTHER_LLM_API_KEY = process.env.OTHER_LLM_API_KEY ?? "";
export const CUSTOM_LLM_BASE_URL = process.env.CUSTOM_LLM_BASE_URL ?? "";
