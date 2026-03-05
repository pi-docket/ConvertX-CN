/**
 * Translation Service Manager
 *
 * 管理翻譯服務提供者，支援 SiliconFlow 等多種翻譯後端。
 */

import {
  TranslationProvider,
  TranslationProviderType,
  TranslationRequest,
  TranslationResult,
  DEFAULT_TRANSLATION_PROVIDER,
} from "./types";
import { SiliconFlowTranslationProvider } from "../../ai/translator";
import {
  OpenAITranslationProvider,
  DeepSeekTranslationProvider,
  CustomTranslationProvider,
} from "../../ai/translationProviders";
import { BABELDOC_ENGINE } from "../env";

function createNotImplementedError(): Error {
  const error = new Error(
    "Local translation has been removed. Online API translation will be implemented later.",
  );
  error.name = "NotImplementedError";
  return error;
}

class PlaceholderTranslationProvider implements TranslationProvider {
  readonly type = DEFAULT_TRANSLATION_PROVIDER;
  readonly name = "Translation Placeholder";

  async isAvailable(): Promise<boolean> {
    return false;
  }

  async translate(_request: TranslationRequest): Promise<TranslationResult> {
    throw createNotImplementedError();
  }
}

/**
 * 從環境變數取得設定的翻譯服務
 * @returns 翻譯服務類型
 */
export function getConfiguredTranslationProvider(): TranslationProviderType {
  const engine = BABELDOC_ENGINE.toLowerCase();

  // 支援的翻譯類型
  const validTypes: TranslationProviderType[] = [
    "siliconflow",
    "openai",
    "deepseek",
    "custom",
    "local",
    "placeholder",
  ];

  if (validTypes.includes(engine as TranslationProviderType)) {
    return engine as TranslationProviderType;
  }

  return DEFAULT_TRANSLATION_PROVIDER;
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
  private provider = new PlaceholderTranslationProvider();
  private preferredProvider: TranslationProviderType;

  constructor(_userId?: number) {
    // userId 參數保留以維持相容性，但已不再使用
    this.preferredProvider = getConfiguredTranslationProvider();
  }

  /**
   * 取得或建立翻譯服務實例
   */
  private getOrCreateProvider(type: TranslationProviderType): TranslationProvider | null {
    switch (type) {
      case "siliconflow":
        return new SiliconFlowTranslationProvider();
      case "openai":
        return new OpenAITranslationProvider();
      case "deepseek":
        return new DeepSeekTranslationProvider();
      case "custom":
        return new CustomTranslationProvider();
      case "placeholder":
      case "local":
      default:
        return new PlaceholderTranslationProvider();
    }
  }

  /**
   * 取得最佳可用的翻譯服務
   *
   * 優先順序：
   * 1. 環境變數設定的服務（如果可用）
   * 2. SiliconFlow（預設 fallback）
   * 3. Placeholder（如果都不可用）
   */
  async getBestProvider(): Promise<TranslationProvider> {
    // 嘗試環境變數設定的服務
    const preferredProvider = this.getOrCreateProvider(this.preferredProvider);
    if (preferredProvider) {
      const available = await preferredProvider.isAvailable();
      if (available) {
        return preferredProvider;
      }
    }

    // Fallback: 嘗試 SiliconFlow
    if (this.preferredProvider !== "siliconflow") {
      const siliconflow = this.getOrCreateProvider("siliconflow");
      if (siliconflow) {
        const available = await siliconflow.isAvailable();
        if (available) {
          return siliconflow;
        }
      }
    }

    // 最後回傳 placeholder（會拋出錯誤）
    return new PlaceholderTranslationProvider();
  }

  /**
   * 執行翻譯
   */
  async translate(request: TranslationRequest): Promise<TranslationResult> {
    const provider = await this.getBestProvider();
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
  return manager.getBestProvider();
}
