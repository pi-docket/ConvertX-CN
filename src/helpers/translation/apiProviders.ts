/**
 * OpenAI Translation Provider
 *
 * 使用 OpenAI API 提供翻譯服務。
 * 需要有效的 API Key。
 */

import {
  TranslationProvider,
  TranslationProviderConfig,
  TranslationRequest,
  TranslationResult,
  normalizeLanguageCode,
} from "./types";

// OpenAI API 端點
const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

// 預設模型
const DEFAULT_MODEL = "gpt-4o-mini";

// 超時時間（毫秒）
const TRANSLATION_TIMEOUT = 60000;

/**
 * 語言代碼轉換為人類可讀名稱
 */
function getLanguageName(lang: string): string {
  const langNames: Record<string, string> = {
    en: "English",
    zh: "Simplified Chinese",
    "zh-Hans": "Simplified Chinese",
    "zh-Hant": "Traditional Chinese",
    "zh-TW": "Traditional Chinese",
    ja: "Japanese",
    ko: "Korean",
    de: "German",
    fr: "French",
    es: "Spanish",
    it: "Italian",
    pt: "Portuguese",
    ru: "Russian",
    ar: "Arabic",
    hi: "Hindi",
    vi: "Vietnamese",
    th: "Thai",
  };

  const normalized = normalizeLanguageCode(lang);
  return langNames[normalized] || langNames[lang] || lang;
}

/**
 * OpenAI 翻譯服務
 */
export class OpenAITranslationProvider implements TranslationProvider {
  readonly type = "openai" as const;
  readonly name = "OpenAI";

  private apiKey: string;
  private baseUrl: string;
  private model: string;
  private timeout: number;

  constructor(config: TranslationProviderConfig) {
    if (!config.apiKey) {
      throw new Error("OpenAI API Key is required");
    }

    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || OPENAI_API_URL;
    this.model = config.model || DEFAULT_MODEL;
    this.timeout = config.timeout || TRANSLATION_TIMEOUT;
  }

  /**
   * 檢查服務是否可用
   */
  async isAvailable(): Promise<boolean> {
    // OpenAI 服務可用性取決於是否有 API Key
    return Boolean(this.apiKey);
  }

  /**
   * 執行翻譯
   */
  async translate(request: TranslationRequest): Promise<TranslationResult> {
    const startTime = Date.now();

    const targetLangName = getLanguageName(request.targetLang);
    const sourceLangName = request.sourceLang ? getLanguageName(request.sourceLang) : null;

    // 建構翻譯 prompt
    const systemPrompt = `You are a professional translator. Translate the given text accurately and naturally. Only output the translation, no explanations.`;

    let userPrompt: string;
    if (sourceLangName) {
      userPrompt = `Translate the following text from ${sourceLangName} to ${targetLangName}:\n\n${request.text}`;
    } else {
      userPrompt = `Translate the following text to ${targetLangName}:\n\n${request.text}`;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(this.baseUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.3,
          max_tokens: 4096,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
      }

      const result = (await response.json()) as {
        choices: Array<{ message: { content: string } }>;
      };

      const translatedText = result.choices[0]?.message?.content?.trim() || "";

      return {
        translatedText,
        detectedLang: request.sourceLang,
        elapsedMs: Date.now() - startTime,
        provider: "openai",
      };
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        throw new Error(`翻譯超時（${this.timeout / 1000} 秒）`);
      }
      throw error;
    }
  }
}

/**
 * DeepSeek 翻譯服務（使用 OpenAI 相容 API）
 */
export class DeepSeekTranslationProvider implements TranslationProvider {
  readonly type = "deepseek" as const;
  readonly name = "DeepSeek";

  private provider: OpenAITranslationProvider;

  constructor(config: TranslationProviderConfig) {
    // DeepSeek 使用 OpenAI 相容 API
    this.provider = new OpenAITranslationProvider({
      ...config,
      baseUrl: config.baseUrl || "https://api.deepseek.com/v1/chat/completions",
      model: config.model || "deepseek-chat",
    });
  }

  async isAvailable(): Promise<boolean> {
    return this.provider.isAvailable();
  }

  async translate(request: TranslationRequest): Promise<TranslationResult> {
    const result = await this.provider.translate(request);
    return {
      ...result,
      provider: "deepseek",
    };
  }
}

/**
 * 自訂 API 翻譯服務（使用 OpenAI 相容 API）
 */
export class CustomAPITranslationProvider implements TranslationProvider {
  readonly type = "custom" as const;
  readonly name = "Custom API";

  private provider: OpenAITranslationProvider;

  constructor(config: TranslationProviderConfig) {
    if (!config.baseUrl) {
      throw new Error("Custom API base URL is required");
    }

    this.provider = new OpenAITranslationProvider(config);
  }

  async isAvailable(): Promise<boolean> {
    return this.provider.isAvailable();
  }

  async translate(request: TranslationRequest): Promise<TranslationResult> {
    const result = await this.provider.translate(request);
    return {
      ...result,
      provider: "custom",
    };
  }
}

/**
 * 建立 OpenAI 翻譯服務實例
 */
export function createOpenAIProvider(config: TranslationProviderConfig): OpenAITranslationProvider {
  return new OpenAITranslationProvider(config);
}

/**
 * 建立 DeepSeek 翻譯服務實例
 */
export function createDeepSeekProvider(
  config: TranslationProviderConfig,
): DeepSeekTranslationProvider {
  return new DeepSeekTranslationProvider(config);
}

/**
 * 建立自訂 API 翻譯服務實例
 */
export function createCustomAPIProvider(
  config: TranslationProviderConfig,
): CustomAPITranslationProvider {
  return new CustomAPITranslationProvider(config);
}
