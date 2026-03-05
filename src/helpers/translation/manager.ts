/**
 * Translation Service Manager
 *
 * 目前僅保留 placeholder，
 * 不提供本地翻譯與 API Key 翻譯實作。
 */

import {
  TranslationProvider,
  TranslationProviderType,
  TranslationRequest,
  TranslationResult,
  DEFAULT_TRANSLATION_PROVIDER,
} from "./types";

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
    void type;
    return this.provider;
  }

  /**
   * 取得最佳可用的翻譯服務
   *
   * 優先順序：
   * 1. 環境變數設定的服務（如果可用）
   * 2. 本地翻譯服務（預設 fallback）
   */
  async getBestProvider(): Promise<TranslationProvider> {
    throw createNotImplementedError();
  }

  /**
   * 執行翻譯
   */
  async translate(request: TranslationRequest): Promise<TranslationResult> {
    void request;
    throw createNotImplementedError();
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
    void type;
    return false;
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
  return new PlaceholderTranslationProvider();
}
