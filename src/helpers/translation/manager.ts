/**
 * Translation Service Manager
 *
 * 統一管理翻譯服務的選擇和使用。
 * 根據使用者設定自動選擇合適的翻譯服務。
 */

import db from "../../db/db";
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
import { getUserApiKey, API_KEY_NAMES } from "../apiKeys";

// 設定 key
const TRANSLATION_PROVIDER_KEY = "translation_provider";

/**
 * 確保 settings 表存在
 */
function ensureSettingsTable(): void {
  db.query(
    `
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(user_id, key)
    )
  `,
  ).run();
}

/**
 * 取得使用者的翻譯服務設定
 */
export function getUserTranslationProvider(userId: number): TranslationProviderType {
  ensureSettingsTable();

  const result = db
    .query("SELECT value FROM settings WHERE user_id = ? AND key = ?")
    .get(userId, TRANSLATION_PROVIDER_KEY) as { value: string } | null;

  if (result?.value) {
    const value = result.value as TranslationProviderType;
    if (["local", "openai", "deepseek", "custom"].includes(value)) {
      return value;
    }
  }

  return DEFAULT_TRANSLATION_PROVIDER;
}

/**
 * 設定使用者的翻譯服務
 */
export function setUserTranslationProvider(
  userId: number,
  provider: TranslationProviderType,
): boolean {
  ensureSettingsTable();

  // 檢查當前值
  const currentProvider = getUserTranslationProvider(userId);
  if (currentProvider === provider) {
    return false; // 沒有變更
  }

  const now = new Date().toISOString();
  const existing = db
    .query("SELECT id FROM settings WHERE user_id = ? AND key = ?")
    .get(userId, TRANSLATION_PROVIDER_KEY);

  if (existing) {
    db.query("UPDATE settings SET value = ?, updated_at = ? WHERE user_id = ? AND key = ?").run(
      provider,
      now,
      userId,
      TRANSLATION_PROVIDER_KEY,
    );
  } else {
    db.query(
      "INSERT INTO settings (user_id, key, value, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
    ).run(userId, TRANSLATION_PROVIDER_KEY, provider, now, now);
  }

  console.log(`[Translation] User ${userId} translation provider set to: ${provider}`);
  return true;
}

/**
 * 翻譯服務管理器
 */
export class TranslationServiceManager {
  private providers: Map<TranslationProviderType, TranslationProvider> = new Map();
  private userId: number;
  private preferredProvider: TranslationProviderType;

  constructor(userId: number) {
    this.userId = userId;
    this.preferredProvider = getUserTranslationProvider(userId);
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
        const openaiKey = getUserApiKey(this.userId, API_KEY_NAMES.OPENAI);
        if (openaiKey) {
          provider = createOpenAIProvider({
            type: "openai",
            apiKey: openaiKey,
          });
        }
        break;
      }

      case "deepseek": {
        const deepseekKey = getUserApiKey(this.userId, API_KEY_NAMES.DEEPSEEK);
        if (deepseekKey) {
          provider = createDeepSeekProvider({
            type: "deepseek",
            apiKey: deepseekKey,
          });
        }
        break;
      }

      case "custom": {
        const customKey = getUserApiKey(this.userId, API_KEY_NAMES.OTHER_LLM);
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
   * 1. 使用者偏好的服務（如果可用）
   * 2. 本地翻譯服務（預設 fallback）
   */
  async getBestProvider(): Promise<TranslationProvider> {
    // 嘗試使用者偏好的服務
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
export function createTranslationManager(userId: number): TranslationServiceManager {
  return new TranslationServiceManager(userId);
}

/**
 * 取得系統預設的翻譯服務（不需要使用者 ID）
 * 用於匿名使用者或系統任務
 */
export async function getDefaultTranslationProvider(): Promise<TranslationProvider> {
  // 優先使用本地翻譯
  const local = createLocalTranslationProvider();
  if (await local.isAvailable()) {
    return local;
  }

  // 檢查環境變數中的 API Key
  if (process.env.OPENAI_API_KEY) {
    return createOpenAIProvider({
      type: "openai",
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  if (process.env.DEEPSEEK_API_KEY) {
    return createDeepSeekProvider({
      type: "deepseek",
      apiKey: process.env.DEEPSEEK_API_KEY,
    });
  }

  throw new Error("沒有可用的翻譯服務。");
}
