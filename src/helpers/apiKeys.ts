/**
 * API Keys Helper
 *
 * 提供統一的 API Keys 存取介面，供各模組使用。
 * API Keys 儲存在資料庫中，依使用者分離。
 */

import db from "../db/db";
import { ApiKey } from "../db/types";

// API Key 名稱常量
export const API_KEY_NAMES = {
  OPENAI: "openai_api_key",
  DEEPSEEK: "deepseek_api_key",
  OTHER_LLM: "other_llm_api_key",
} as const;

export type ApiKeyName = (typeof API_KEY_NAMES)[keyof typeof API_KEY_NAMES];

/**
 * 取得使用者的單一 API Key
 */
export function getUserApiKey(userId: number, keyName: string): string {
  const result = db
    .query("SELECT key_value FROM api_keys WHERE user_id = ? AND key_name = ?")
    .as(ApiKey)
    .get(userId, keyName);
  return result?.key_value ?? "";
}

/**
 * 取得使用者的所有 API Keys
 */
export function getApiKeys(userId: number): {
  openai_api_key: string;
  deepseek_api_key: string;
  other_llm_api_key: string;
} {
  return {
    openai_api_key: getUserApiKey(userId, API_KEY_NAMES.OPENAI),
    deepseek_api_key: getUserApiKey(userId, API_KEY_NAMES.DEEPSEEK),
    other_llm_api_key: getUserApiKey(userId, API_KEY_NAMES.OTHER_LLM),
  };
}

/**
 * 將使用者的 API Keys 設定到環境變數中
 * 這樣轉換器就可以透過 process.env 存取
 *
 * 注意：這會暫時設定環境變數，供後續的轉換操作使用
 */
export function setApiKeysToEnv(userId: number): void {
  const keys = getApiKeys(userId);

  // 設定 OpenAI API Key
  if (keys.openai_api_key) {
    process.env.OPENAI_API_KEY = keys.openai_api_key;
  }

  // 設定 DeepSeek API Key
  if (keys.deepseek_api_key) {
    process.env.DEEPSEEK_API_KEY = keys.deepseek_api_key;
  }

  // 設定其他 LLM API Key（可用於兼容的服務）
  if (keys.other_llm_api_key) {
    process.env.OTHER_LLM_API_KEY = keys.other_llm_api_key;
  }
}

/**
 * 清除環境變數中的 API Keys
 * 在轉換完成後呼叫以保持安全
 */
export function clearApiKeysFromEnv(): void {
  delete process.env.OPENAI_API_KEY;
  delete process.env.DEEPSEEK_API_KEY;
  delete process.env.OTHER_LLM_API_KEY;
}

/**
 * 在執行需要 API 的操作前後包裝 API Keys
 * 自動設定和清除環境變數
 */
export async function withApiKeys<T>(userId: number, operation: () => Promise<T>): Promise<T> {
  try {
    setApiKeysToEnv(userId);
    return await operation();
  } finally {
    clearApiKeysFromEnv();
  }
}
