/**
 * Translation Provider Types
 *
 * 定義翻譯服務的統一介面，支援多種翻譯後端：
 * - LocalLlama: 使用本地 llama.cpp + GGUF 模型
 * - OpenAI: 使用 OpenAI API
 * - DeepSeek: 使用 DeepSeek API
 * - Custom: 使用自訂 API 端點
 */

/**
 * 翻譯服務類型
 */
export type TranslationProviderType = "local" | "openai" | "deepseek" | "custom";

/**
 * 翻譯請求
 */
export interface TranslationRequest {
  /** 要翻譯的文字 */
  text: string;
  /** 來源語言（可選，自動偵測） */
  sourceLang?: string;
  /** 目標語言 */
  targetLang: string;
  /** 上下文提示（可選，用於提升翻譯品質） */
  context?: string;
}

/**
 * 翻譯結果
 */
export interface TranslationResult {
  /** 翻譯後的文字 */
  translatedText: string;
  /** 偵測到的來源語言（可能為 undefined） */
  detectedLang: string | undefined;
  /** 翻譯耗時（毫秒） */
  elapsedMs?: number;
  /** 使用的翻譯服務 */
  provider: TranslationProviderType;
}

/**
 * 翻譯服務配置
 */
export interface TranslationProviderConfig {
  /** 服務類型 */
  type: TranslationProviderType;
  /** API Key（適用於 API 服務） */
  apiKey?: string;
  /** API 端點 URL（適用於自訂服務） */
  baseUrl?: string;
  /** 模型名稱 */
  model?: string;
  /** 超時時間（毫秒） */
  timeout?: number;
}

/**
 * 翻譯服務提供者介面
 */
export interface TranslationProvider {
  /** 服務類型 */
  readonly type: TranslationProviderType;
  /** 服務名稱（用於顯示） */
  readonly name: string;
  /** 是否可用 */
  isAvailable(): Promise<boolean>;
  /** 執行翻譯 */
  translate(request: TranslationRequest): Promise<TranslationResult>;
}

/**
 * 預設翻譯服務類型
 * 當使用者未設定 API Key 時，自動使用本地翻譯
 */
export const DEFAULT_TRANSLATION_PROVIDER: TranslationProviderType = "local";

/**
 * 語言代碼標準化
 */
export function normalizeLanguageCode(lang: string): string {
  const langMap: Record<string, string> = {
    // 繁體中文
    "zh-tw": "zh-Hant",
    "zh-hant": "zh-Hant",
    zht: "zh-Hant",
    // 簡體中文
    "zh-cn": "zh-Hans",
    "zh-hans": "zh-Hans",
    zhs: "zh-Hans",
    zh: "zh-Hans",
    // 其他語言保持原樣
  };

  const lowerLang = lang.toLowerCase();
  return langMap[lowerLang] || lang;
}
