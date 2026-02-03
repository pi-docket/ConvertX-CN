/**
 * API Keys Helper
 *
 * 提供統一的 API Keys 存取介面，供各模組使用。
 * 所有 API Keys 來自環境變數，不再支援使用者個別設定。
 *
 * 支援的環境變數：
 * - OPENAI_API_KEY: OpenAI API 金鑰
 * - DEEPSEEK_API_KEY: DeepSeek API 金鑰
 * - OTHER_LLM_API_KEY: 其他 LLM API 金鑰
 */

// API Key 名稱常量
export const API_KEY_NAMES = {
  OPENAI: "openai_api_key",
  DEEPSEEK: "deepseek_api_key",
  OTHER_LLM: "other_llm_api_key",
} as const;

/**
 * 從環境變數取得 API Key
 * @param keyName - API Key 名稱（API_KEY_NAMES 常量）
 * @returns API Key 值，若未設定則返回空字串
 */
export function getApiKey(keyName: string): string {
  switch (keyName) {
    case API_KEY_NAMES.OPENAI:
      return process.env.OPENAI_API_KEY ?? "";
    case API_KEY_NAMES.DEEPSEEK:
      return process.env.DEEPSEEK_API_KEY ?? "";
    case API_KEY_NAMES.OTHER_LLM:
      return process.env.OTHER_LLM_API_KEY ?? "";
    default:
      return "";
  }
}

/**
 * 取得 API Key（保留舊介面以維持相容性）
 * @deprecated 建議使用 getApiKey()
 * @param _userId - 使用者 ID（已忽略，API Keys 現在來自環境變數）
 * @param keyName - API Key 名稱
 */
export function getUserApiKey(_userId: number, keyName: string): string {
  return getApiKey(keyName);
}

/**
 * 取得所有 API Keys
 * @param __userId - 使用者 ID（已忽略，API Keys 現在來自環境變數）
 */
export function getApiKeys(_userId?: number): {
  openai_api_key: string;
  deepseek_api_key: string;
  other_llm_api_key: string;
} {
  return {
    openai_api_key: process.env.OPENAI_API_KEY ?? "",
    deepseek_api_key: process.env.DEEPSEEK_API_KEY ?? "",
    other_llm_api_key: process.env.OTHER_LLM_API_KEY ?? "",
  };
}

/**
 * 檢查是否有任何 API Key 已設定
 */
export function hasAnyApiKey(): boolean {
  const keys = getApiKeys();
  return !!(keys.openai_api_key || keys.deepseek_api_key || keys.other_llm_api_key);
}

/**
 * 設定 API Keys 到環境變數（已不再需要，保留以維持相容性）
 * @deprecated API Keys 現在直接從環境變數讀取
 */
export function setApiKeysToEnv(_userId: number): void {
  // 不再需要操作，API Keys 已經在環境變數中
  console.log("[API Keys] API Keys are now read directly from environment variables");
}

/**
 * 清除環境變數中的 API Keys（已不再需要，保留以維持相容性）
 * @deprecated API Keys 現在直接從環境變數讀取，不應清除
 */
export function clearApiKeysFromEnv(): void {
  // 不再清除環境變數中的 API Keys
  // 因為它們是由部署者設定的，不應該被程式碼刪除
}
