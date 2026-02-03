/**
 * Translation Service Manager
 *
 * 統一管理翻譯服務的選擇和使用。
 * 根據環境變數自動選擇合適的翻譯服務。
 *
 * 環境變數：
 * - BABELDOC_ENGINE: 翻譯引擎（local | openai | deepseek | custom）
 * - OPENAI_API_KEY: OpenAI API 金鑰
 * - DEEPSEEK_API_KEY: DeepSeek API 金鑰
 * - OTHER_LLM_API_KEY: 自訂 LLM API 金鑰
 * - CUSTOM_LLM_BASE_URL: 自訂 API 端點
 */

import {
  TranslationProvider,
  TranslationProviderType,
  TranslationRequest,
  TranslationResult,
  DEFAULT_TRANSLATION_PROVIDER,
} from "./types";
import { createLocalTranslationProvider } from "./localProvider";
import {
  createOpenAIProvider,
  createDeepSeekProvider,
  createCustomAPIProvider,
} from "./apiProviders";

/**
 * 從環境變數取得設定的翻譯服務
 * @returns 翻譯服務類型
 */
export function getConfiguredTranslationProvider(): TranslationProviderType {
  const engine = process.env.BABELDOC_ENGINE?.toLowerCase();

  switch (engine) {
    case "openai":
      return "openai";
    case "deepseek":
      return "deepseek";
    case "custom":
      return "custom";
    case "local":
    default:
      return DEFAULT_TRANSLATION_PROVIDER;
  }
}

/**
 * 取得使用者的翻譯服務設定
 * @deprecated 翻譯服務現在由環境變數控制，userId 參數已忽略
 */
export function getUserTranslationProvider(_userId: number): TranslationProviderType {
  return getConfiguredTranslationProvider();
}

/**
 * 設定使用者的翻譯服務（已停用）
 * @deprecated 翻譯服務現在由環境變數控制，此函數不再有效
 */
export function setUserTranslationProvider(
  _userId: number,
  _provider: TranslationProviderType,
): boolean {
  console.warn(
    "[Translation] setUserTranslationProvider is deprecated. Use BABELDOC_ENGINE environment variable.",
  );
  return false;
}

/**
 * 翻譯服務管理器
 */
export class TranslationServiceManager {
  private providers: Map<TranslationProviderType, TranslationProvider> = new Map();
  private preferredProvider: TranslationProviderType;

  constructor(_userId?: number) {
    // userId 參數保留以維持相容性，但已不再使用
    this.preferredProvider = getConfiguredTranslationProvider();
  }

  /**
   * 取得或建立翻譯服務實例
   */
  private getOrCreateProvider(type: TranslationProviderType): TranslationProvider | null {
    // 檢查快取
    const cached = this.providers.get(type);
    if (cached) {
      return cached;
    }

    // 建立新實例
    let provider: TranslationProvider | null = null;

    switch (type) {
      case "local":
        provider = createLocalTranslationProvider();
        break;

      case "openai": {
        const openaiKey = process.env.OPENAI_API_KEY;
        if (openaiKey) {
          provider = createOpenAIProvider({
            type: "openai",
            apiKey: openaiKey,
          });
        }
        break;
      }

      case "deepseek": {
        const deepseekKey = process.env.DEEPSEEK_API_KEY;
        if (deepseekKey) {
          provider = createDeepSeekProvider({
            type: "deepseek",
            apiKey: deepseekKey,
          });
        }
        break;
      }

      case "custom": {
        const customKey = process.env.OTHER_LLM_API_KEY;
        const customBaseUrl = process.env.CUSTOM_LLM_BASE_URL;
        if (customKey && customBaseUrl) {
          provider = createCustomAPIProvider({
            type: "custom",
            apiKey: customKey,
            baseUrl: customBaseUrl,
          });
        }
        break;
      }
    }

    if (provider) {
      this.providers.set(type, provider);
    }

    return provider;
  }

  /**
   * 取得最佳可用的翻譯服務
   *
   * 優先順序：
   * 1. 環境變數設定的服務（如果可用）
   * 2. 本地翻譯服務（預設 fallback）
   */
  async getBestProvider(): Promise<TranslationProvider> {
    // 嘗試環境變數設定的服務
    const preferred = this.getOrCreateProvider(this.preferredProvider);
    if (preferred && (await preferred.isAvailable())) {
      return preferred;
    }

    // Fallback 到本地翻譯
    if (this.preferredProvider !== "local") {
      console.log(
        `[Translation] ${this.preferredProvider} not available, falling back to local translation`,
      );
      const local = this.getOrCreateProvider("local");
      if (local && (await local.isAvailable())) {
        return local;
      }
    }

    // 如果本地翻譯也不可用，嘗試其他 API 服務
    const apiProviders: TranslationProviderType[] = ["openai", "deepseek", "custom"];
    for (const providerType of apiProviders) {
      if (providerType === this.preferredProvider) continue;

      const provider = this.getOrCreateProvider(providerType);
      if (provider && (await provider.isAvailable())) {
        return provider;
      }
    }

    // 沒有可用的翻譯服務
    throw new Error("沒有可用的翻譯服務。請確認 llama-server 正在運行，或設定 API Key。");
  }

  /**
   * 執行翻譯
   */
  async translate(request: TranslationRequest): Promise<TranslationResult> {
    const provider = await this.getBestProvider();
    console.log(`[Translation] Using provider: ${provider.name}`);
    return provider.translate(request);
  }

  /**
   * 取得當前設定的翻譯服務類型
   */
  getPreferredProvider(): TranslationProviderType {
    return this.preferredProvider;
  }

  /**
   * 檢查特定翻譯服務是否可用
   */
  async checkProviderAvailability(type: TranslationProviderType): Promise<boolean> {
    const provider = this.getOrCreateProvider(type);
    if (!provider) {
      return false;
    }
    return provider.isAvailable();
  }
}

/**
 * 建立翻譯服務管理器
 */
export function createTranslationManager(userId?: number): TranslationServiceManager {
  return new TranslationServiceManager(userId);
}

/**
 * 取得系統預設的翻譯服務（不需要使用者 ID）
 * 用於匿名使用者或系統任務
 */
export async function getDefaultTranslationProvider(): Promise<TranslationProvider> {
  const manager = new TranslationServiceManager();

  try {
    return await manager.getBestProvider();
  } catch {
    // 如果都失敗，返回 local（即使可能不可用）
    return createLocalTranslationProvider();
  }
}
