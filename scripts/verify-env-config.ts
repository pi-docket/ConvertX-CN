/**
 * 環境變數設定驗證腳本
 *
 * 用於驗證 ConvertX-CN 的環境變數設定邏輯：
 * 1. 沒有設定任何環境變數 → 使用 pipeline
 * 2. MINERU_MODE=vlm 仍會由呼叫端回退 pipeline
 * 3. BabelDOC 目前為 placeholder（尚未實作線上 API 翻譯）
 */

import {
  getConfiguredProcessingMode,
  getEffectiveProcessingMode,
  DEFAULT_PROCESSING_MODE,
} from "../src/helpers/processingMode";
import { getConfiguredTranslationProvider } from "../src/helpers/translation/manager";
import { getApiKeys, hasAnyApiKey } from "../src/helpers/apiKeys";
import { MINERU_MODE, BABELDOC_ENGINE, OPENAI_API_KEY, DEEPSEEK_API_KEY } from "../src/helpers/env";

console.log("=== ConvertX-CN 環境變數設定驗證 ===\n");

// 測試 1: 處理模式設定
console.log("📋 處理模式 (MINERU_MODE):");
console.log(`  設定值: ${process.env.MINERU_MODE || "(未設定)"}`);
console.log(`  解析結果: ${getConfiguredProcessingMode()}`);
console.log(`  預設值: ${DEFAULT_PROCESSING_MODE}`);
console.log(`  env.ts 導出: ${MINERU_MODE}`);

// 測試 2: 翻譯引擎設定
console.log("\n📋 翻譯引擎 (BABELDOC_ENGINE):");
console.log(`  設定值: ${process.env.BABELDOC_ENGINE || "(未設定)"}`);
console.log(`  解析結果: ${getConfiguredTranslationProvider()}`);
console.log(`  env.ts 導出: ${BABELDOC_ENGINE}`);

// 測試 3: API Keys 設定
console.log("\n📋 API Keys:");
console.log(
  `  OPENAI_API_KEY: ${OPENAI_API_KEY ? "已設定 (" + OPENAI_API_KEY.substring(0, 8) + "...)" : "(未設定)"}`,
);
console.log(
  `  DEEPSEEK_API_KEY: ${DEEPSEEK_API_KEY ? "已設定 (" + DEEPSEEK_API_KEY.substring(0, 8) + "...)" : "(未設定)"}`,
);
console.log(`  hasAnyApiKey(): ${hasAnyApiKey()}`);

const apiKeys = getApiKeys();
console.log(
  `  getApiKeys(): ${JSON.stringify({
    openai: apiKeys.openai_api_key ? "有" : "無",
    deepseek: apiKeys.deepseek_api_key ? "有" : "無",
    other: apiKeys.other_llm_api_key ? "有" : "無",
  })}`,
);

// 測試 4: 有效處理模式（考慮 VLM 可用性）
console.log("\n📋 有效處理模式（考慮 VLM 可用性）:");
getEffectiveProcessingMode().then((result) => {
  console.log(`  模式: ${result.mode}`);
  console.log(`  是否自動回退: ${result.isAutoFallback}`);
  if (result.reason) {
    console.log(`  回退原因: ${result.reason}`);
  }

  console.log("\n=== 驗證完成 ===");

  // 驗證邏輯
  const issues: string[] = [];

  // 確保預設為 pipeline
  if (DEFAULT_PROCESSING_MODE !== "pipeline") {
    issues.push("❌ 預設處理模式不是 pipeline");
  }

  // 確保沒有設定時使用 pipeline
  if (!process.env.MINERU_MODE && getConfiguredProcessingMode() !== "pipeline") {
    issues.push("❌ 未設定 MINERU_MODE 時應使用 pipeline");
  }

  // 確保翻譯服務目前為 placeholder（manager 仍保留 legacy type）
  if (BABELDOC_ENGINE !== "placeholder") {
    issues.push("❌ BABELDOC_ENGINE 應為 placeholder");
  }

  if (issues.length === 0) {
    console.log("\n✅ 所有驗證通過！");
  } else {
    console.log("\n⚠️ 發現問題：");
    issues.forEach((issue) => console.log(`  ${issue}`));
  }
});
