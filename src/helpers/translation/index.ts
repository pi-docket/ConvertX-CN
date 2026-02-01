/**
 * Translation Module
 *
 * 提供統一的翻譯服務介面，支援：
 * - 本地 llama.cpp 翻譯（預設）
 * - OpenAI API
 * - DeepSeek API
 * - 自訂 API
 */

// Types
export type {
  TranslationProviderType,
  TranslationRequest,
  TranslationResult,
  TranslationProvider,
  TranslationProviderConfig,
} from "./types";

export { DEFAULT_TRANSLATION_PROVIDER, normalizeLanguageCode } from "./types";

// Providers
export { LocalLlamaTranslationProvider, createLocalTranslationProvider } from "./localProvider";

export {
  OpenAITranslationProvider,
  DeepSeekTranslationProvider,
  CustomAPITranslationProvider,
  createOpenAIProvider,
  createDeepSeekProvider,
  createCustomAPIProvider,
} from "./apiProviders";

// Manager
export {
  TranslationServiceManager,
  getUserTranslationProvider,
  setUserTranslationProvider,
} from "./manager";
