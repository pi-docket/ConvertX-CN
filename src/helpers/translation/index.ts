/**
 * Translation Module
 *
 * 提供統一的翻譯服務介面。
 *
 * 目前翻譯功能僅保留 placeholder，
 * 實際線上 API 翻譯將於後續版本實作。
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

// Manager
export {
  TranslationServiceManager,
  getUserTranslationProvider,
  setUserTranslationProvider,
} from "./manager";
