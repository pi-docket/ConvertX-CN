/**
 * SiliconFlow Translation Provider
 *
 * 整合 API key 取得與 SiliconFlow API 呼叫，
 * 提供簡單的翻譯介面。
 *
 * 使用流程：
 * 1. 向 Cloudflare Worker 請求 API key
 * 2. 解密 API key
 * 3. 呼叫 SiliconFlow API 翻譯
 * 4. 清除 API key
 *
 * 安全要求：
 * - API key 不寫入 log
 * - API key 不寫入檔案
 * - API key 使用完畢後立即清除
 */

import { getApiKey, clearApiKey } from "../security/keyProvider";
import { translateText as siliconflowTranslate, type SiliconFlowConfig } from "./siliconflowClient";
import type {
  TranslationProvider,
  TranslationRequest,
  TranslationResult,
} from "../helpers/translation/types";

/**
 * SiliconFlow 翻譯提供者
 *
 * 實作 TranslationProvider 介面，
 * 可整合到現有的翻譯架構中。
 */
export class SiliconFlowTranslationProvider implements TranslationProvider {
  readonly type = "siliconflow" as const;
  readonly name = "SiliconFlow (Hunyuan-MT-7B)";

  private config: SiliconFlowConfig | undefined;

  constructor(config?: SiliconFlowConfig) {
    this.config = config;
  }

  /**
   * 檢查服務是否可用
   *
   * SiliconFlow 使用內置密鑰，始終可用
   * 除非用戶自定義部署時配置錯誤
   */
  async isAvailable(): Promise<boolean> {
    try {
      // SiliconFlow 已內置密鑰，始終可用
      // 如果用戶使用 CONVERTX_ENCRYPTION_KEY 或 CONVERTX_WORKER_URL 自定義部署
      // getApiKey() 會在實際使用時檢查配置有效性
      return true;
    } catch (error) {
      console.warn(
        `[SiliconFlow] Availability check failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }

  /**
   * 執行翻譯
   *
   * @param request 翻譯請求
   * @returns 翻譯結果
   */
  async translate(request: TranslationRequest): Promise<TranslationResult> {
    const startTime = Date.now();
    let apiKey: string | undefined;

    try {
      // 1. 取得 API key
      apiKey = await getApiKey();

      // 2. 呼叫 SiliconFlow API
      const translatedText = await siliconflowTranslate({
        apiKey,
        text: request.text,
        targetLang: request.targetLang,
        ...(request.sourceLang && { sourceLang: request.sourceLang }),
        ...(this.config && { config: this.config }),
      });

      const elapsedMs = Date.now() - startTime;

      return {
        translatedText,
        detectedLang: request.sourceLang,
        elapsedMs,
        provider: this.type,
      };
    } catch (error) {
      throw new Error(
        `SiliconFlow translation failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      // 3. 清除 API key（關鍵安全步驟）
      if (apiKey) {
        clearApiKey(apiKey);
        apiKey = undefined; // 確保引用被清除
      }
    }
  }
}

/**
 * 快速翻譯函數（不依賴 TranslationProvider 介面）
 *
 * 適合簡單的翻譯需求，不需要建立 provider 實例。
 *
 * @param text 要翻譯的文字
 * @param targetLang 目標語言（預設：zh-CN）
 * @param sourceLang 來源語言（可選）
 * @returns 翻譯後的文字
 *
 * @example
 * ```typescript
 * const result = await translate("Hello world", "zh-CN");
 * console.log(result); // "你好世界"
 * ```
 */
export async function translate(
  text: string,
  targetLang = "zh-CN",
  sourceLang?: string,
): Promise<string> {
  let apiKey: string | undefined;

  try {
    // 1. 取得 API key
    apiKey = await getApiKey();

    // 2. 呼叫 SiliconFlow API
    const translatedText = await siliconflowTranslate({
      apiKey,
      text,
      targetLang,
      ...(sourceLang && { sourceLang }),
    });

    return translatedText;
  } catch (error) {
    throw new Error(
      `Translation failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  } finally {
    // 3. 清除 API key（關鍵安全步驟）
    if (apiKey) {
      clearApiKey(apiKey);
      apiKey = undefined; // 確保引用被清除
    }
  }
}

/**
 * 批次翻譯函數
 *
 * 將長文本分段處理，適合翻譯長文檔。
 *
 * @param text 要翻譯的文字
 * @param targetLang 目標語言（預設：zh-CN）
 * @param sourceLang 來源語言（可選）
 * @param maxChunkSize 每個分段的最大字數（預設：1000）
 * @returns 翻譯後的文字
 */
export async function translateBatch(
  text: string,
  targetLang = "zh-CN",
  sourceLang?: string,
  maxChunkSize = 1000,
): Promise<string> {
  // 如果文本不長，直接使用普通翻譯
  if (text.length <= maxChunkSize) {
    return translate(text, targetLang, sourceLang);
  }

  let apiKey: string | undefined;

  try {
    // 1. 取得 API key（只取得一次，用於所有分段）
    apiKey = await getApiKey();

    // 2. 分段翻譯
    const chunks: string[] = [];
    let currentChunk = "";

    // 按句子分割
    const sentences = text.split(/([.!?。！？\n]+)/);

    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length > maxChunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk);
        currentChunk = sentence;
      } else {
        currentChunk += sentence;
      }
    }

    if (currentChunk.length > 0) {
      chunks.push(currentChunk);
    }

    // 3. 逐段翻譯
    const translatedChunks: string[] = [];

    for (const chunk of chunks) {
      const translated = await siliconflowTranslate({
        apiKey,
        text: chunk,
        targetLang,
        ...(sourceLang && { sourceLang }),
      });
      translatedChunks.push(translated);
    }

    return translatedChunks.join("");
  } catch (error) {
    throw new Error(
      `Batch translation failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  } finally {
    // 4. 清除 API key
    if (apiKey) {
      clearApiKey(apiKey);
      apiKey = undefined;
    }
  }
}

/**
 * 建立 SiliconFlow 翻譯提供者實例
 *
 * @param config 可選的配置參數
 * @returns SiliconFlowTranslationProvider 實例
 */
export function createSiliconFlowProvider(
  config?: SiliconFlowConfig,
): SiliconFlowTranslationProvider {
  return new SiliconFlowTranslationProvider(config);
}
