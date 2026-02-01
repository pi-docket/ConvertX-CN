/**
 * Local Llama Translation Provider
 *
 * 使用本地 llama.cpp + GGUF 翻譯模型提供翻譯服務。
 * 這是預設的翻譯服務，不需要任何 API Key。
 *
 * 模型選擇：使用 NLLB（No Language Left Behind）的量化版本
 * - 模型：facebook/nllb-200-distilled-600M 的 GGUF 量化版
 * - 大小：約 600MB（Q4 量化後約 300MB）
 * - 支援 200+ 語言
 * - 專為翻譯任務優化
 */

import {
  TranslationProvider,
  TranslationRequest,
  TranslationResult,
  normalizeLanguageCode,
} from "./types";

// llama-server 端點（與 VLM 使用相同的 server，預設 port 11785）
const LLAMA_SERVER_URL = process.env.LLAMA_SERVER_URL || "http://127.0.0.1:11785";

// 翻譯超時時間（毫秒）
const TRANSLATION_TIMEOUT = 60000;

// NLLB 語言代碼映射（轉換為 NLLB-200 的 flores-200 格式）
const NLLB_LANG_CODES: Record<string, string> = {
  en: "eng_Latn",
  zh: "zho_Hans",
  "zh-Hans": "zho_Hans",
  "zh-Hant": "zho_Hant",
  "zh-TW": "zho_Hant",
  ja: "jpn_Jpan",
  ko: "kor_Hang",
  de: "deu_Latn",
  fr: "fra_Latn",
  es: "spa_Latn",
  it: "ita_Latn",
  pt: "por_Latn",
  ru: "rus_Cyrl",
  ar: "arb_Arab",
  hi: "hin_Deva",
  vi: "vie_Latn",
  th: "tha_Thai",
};

/**
 * 將標準語言代碼轉換為 NLLB-200 格式
 */
function toNllbLangCode(lang: string): string {
  const normalized = normalizeLanguageCode(lang);
  return NLLB_LANG_CODES[normalized] || NLLB_LANG_CODES[lang] || lang;
}

/**
 * 本地 Llama 翻譯服務
 */
export class LocalLlamaTranslationProvider implements TranslationProvider {
  readonly type = "local" as const;
  readonly name = "內建本地翻譯";

  private serverAvailable: boolean | null = null;
  private lastHealthCheck = 0;
  private readonly healthCheckInterval = 30000; // 30 秒

  /**
   * 檢查翻譯服務是否可用
   */
  async isAvailable(): Promise<boolean> {
    const now = Date.now();

    // 使用快取的結果（避免頻繁檢查）
    if (this.serverAvailable !== null && now - this.lastHealthCheck < this.healthCheckInterval) {
      return this.serverAvailable;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${LLAMA_SERVER_URL}/health`, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      this.serverAvailable = response.ok;
      this.lastHealthCheck = now;

      if (this.serverAvailable) {
        console.log("[LocalTranslation] llama-server is available");
      }

      return this.serverAvailable;
    } catch (error) {
      console.warn("[LocalTranslation] llama-server not available:", error);
      this.serverAvailable = false;
      this.lastHealthCheck = now;
      return false;
    }
  }

  /**
   * 執行翻譯
   */
  async translate(request: TranslationRequest): Promise<TranslationResult> {
    const startTime = Date.now();

    // 檢查服務可用性
    const available = await this.isAvailable();
    if (!available) {
      throw new Error("本地翻譯服務不可用。請確認 llama-server 正在運行。");
    }

    const targetLangCode = toNllbLangCode(request.targetLang);
    const sourceLangCode = request.sourceLang ? toNllbLangCode(request.sourceLang) : "auto";

    // 建構翻譯 prompt
    // 使用簡潔的指令格式，適合翻譯任務
    const prompt = this.buildTranslationPrompt(request.text, sourceLangCode, targetLangCode);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TRANSLATION_TIMEOUT);

      const response = await fetch(`${LLAMA_SERVER_URL}/completion`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt,
          n_predict: 2048,
          temperature: 0.1, // 低溫度確保翻譯穩定
          top_p: 0.9,
          stop: ["</s>", "\n\n", "---"],
          stream: false,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`翻譯請求失敗: ${response.status} ${response.statusText}`);
      }

      const result = (await response.json()) as { content: string };
      const translatedText = this.extractTranslation(result.content);

      return {
        translatedText,
        detectedLang: sourceLangCode === "auto" ? undefined : request.sourceLang,
        elapsedMs: Date.now() - startTime,
        provider: "local",
      };
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        throw new Error(`翻譯超時（${TRANSLATION_TIMEOUT / 1000} 秒）`);
      }
      throw error;
    }
  }

  /**
   * 建構翻譯 prompt
   */
  private buildTranslationPrompt(text: string, sourceLang: string, targetLang: string): string {
    // 使用清晰的翻譯指令格式
    // 這種格式適用於大多數翻譯模型
    if (sourceLang === "auto") {
      return `Translate the following text to ${targetLang}:

${text}

Translation:`;
    }

    return `Translate from ${sourceLang} to ${targetLang}:

${text}

Translation:`;
  }

  /**
   * 從模型輸出中提取翻譯結果
   */
  private extractTranslation(content: string): string {
    // 移除可能的前綴和後綴
    let result = content.trim();

    // 移除可能的引號
    if (
      (result.startsWith('"') && result.endsWith('"')) ||
      (result.startsWith("'") && result.endsWith("'"))
    ) {
      result = result.slice(1, -1);
    }

    // 移除可能的翻譯標記
    result = result.replace(/^Translation:\s*/i, "");

    return result.trim();
  }
}

/**
 * 建立本地翻譯服務實例
 */
export function createLocalTranslationProvider(): LocalLlamaTranslationProvider {
  return new LocalLlamaTranslationProvider();
}
