/**
 * 多語言翻譯 E2E 測試
 *
 * 測試涵蓋：
 * - PDFMathTranslate (pdf2zh)
 * - 支援語言：中文（簡繁）、英文、日文、韓文、德文、法文等
 *
 * 注意：這些測試需要：
 * 1. 網路連接（使用翻譯 API）
 * 2. 設置翻譯服務 API 金鑰
 * 3. PDF 測試檔案
 *
 * 執行方式：
 *   bun test tests/e2e/translation.e2e.test.ts
 */

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { existsSync, mkdirSync, writeFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

// =============================================================================
// 配置
// =============================================================================

const E2E_OUTPUT_DIR = "tests/e2e/output/translation";
const E2E_FIXTURES_DIR = "tests/e2e/fixtures";
const TIMEOUT = 300_000; // 5 分鐘（翻譯可能很慢）

// =============================================================================
// 語言定義
// =============================================================================

interface Language {
  code: string;
  name: string;
  nativeName: string;
  testPhrase: string;
}

const SUPPORTED_LANGUAGES: Language[] = [
  { code: "zh", name: "Simplified Chinese", nativeName: "简体中文", testPhrase: "这是一个测试" },
  {
    code: "zh-TW",
    name: "Traditional Chinese",
    nativeName: "繁體中文",
    testPhrase: "這是一個測試",
  },
  { code: "en", name: "English", nativeName: "English", testPhrase: "This is a test" },
  { code: "ja", name: "Japanese", nativeName: "日本語", testPhrase: "これはテストです" },
  { code: "ko", name: "Korean", nativeName: "한국어", testPhrase: "이것은 테스트입니다" },
  { code: "de", name: "German", nativeName: "Deutsch", testPhrase: "Das ist ein Test" },
  { code: "fr", name: "French", nativeName: "Français", testPhrase: "C'est un test" },
  { code: "es", name: "Spanish", nativeName: "Español", testPhrase: "Esta es una prueba" },
  { code: "ru", name: "Russian", nativeName: "Русский", testPhrase: "Это тест" },
  { code: "pt", name: "Portuguese", nativeName: "Português", testPhrase: "Isso é um teste" },
  { code: "it", name: "Italian", nativeName: "Italiano", testPhrase: "Questo è un test" },
  { code: "ar", name: "Arabic", nativeName: "العربية", testPhrase: "هذا اختبار" },
  { code: "th", name: "Thai", nativeName: "ไทย", testPhrase: "นี่คือการทดสอบ" },
  {
    code: "vi",
    name: "Vietnamese",
    nativeName: "Tiếng Việt",
    testPhrase: "Đây là một bài kiểm tra",
  },
];

// =============================================================================
// 工具檢測
// =============================================================================

interface TranslatorStatus {
  name: string;
  available: boolean;
  version?: string;
}

function checkTranslator(command: string): TranslatorStatus {
  try {
    const result = spawnSync(command, ["--version"], {
      timeout: 10000,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return {
      name: command,
      available: result.status === 0,
      version: result.stdout?.split("\n")[0]?.trim(),
    };
  } catch {
    return { name: command, available: false };
  }
}

// =============================================================================
// 測試 Fixture 生成
// =============================================================================

function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/**
 * 使用 LaTeX 創建一個簡單的 PDF 測試檔案
 * 如果 xelatex 不可用，則創建一個基本的文字 PDF
 */
async function createTestPdf(path: string): Promise<boolean> {
  const texContent = `\\documentclass{article}
\\usepackage{fontspec}
\\usepackage{xeCJK}
\\setCJKmainfont{Noto Sans CJK SC}

\\begin{document}

\\section{Introduction}

This is a test document for translation testing.
The quick brown fox jumps over the lazy dog.

\\section{Technical Content}

Machine learning is a subset of artificial intelligence.
Neural networks are inspired by the human brain.

\\subsection{Mathematical Formulas}

$E = mc^2$

$\\int_0^\\infty e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}$

\\section{Conclusion}

This document is used for testing multilingual translation capabilities.

\\end{document}
`;

  const texPath = path.replace(".pdf", ".tex");
  writeFileSync(texPath, texContent);

  try {
    // 嘗試使用 xelatex
    const result = spawnSync(
      "xelatex",
      ["-interaction=nonstopmode", "-output-directory=" + join(path, ".."), texPath],
      {
        timeout: 60000,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      },
    );

    return result.status === 0 && existsSync(path);
  } catch {
    // 如果 xelatex 不可用，創建一個簡單的文字檔案作為替代
    // 注意：這不是真正的 PDF，但可以用於基本測試
    console.log("  ⚠️ xelatex 不可用，使用替代方法");
    return false;
  }
}

// =============================================================================
// 測試結果追蹤
// =============================================================================

interface TranslationResult {
  translator: string;
  sourceLang: string;
  targetLang: string;
  success: boolean;
  duration: number;
  inputSize: number;
  outputSize: number;
  error?: string;
}

interface TestStats {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  results: TranslationResult[];
}

const stats: TestStats = {
  total: 0,
  passed: 0,
  failed: 0,
  skipped: 0,
  results: [],
};

// =============================================================================
// 測試套件
// =============================================================================

let translators: Record<string, TranslatorStatus> = {};
let testPdfPath: string;

beforeAll(async () => {
  console.log("\n🔧 初始化翻譯測試... Initializing translation tests...\n");

  ensureDir(E2E_OUTPUT_DIR);

  // 檢測翻譯工具
  console.log("  檢測翻譯工具...");
  translators = {
    pdf2zh: checkTranslator("pdf2zh"),
  };

  for (const [name, status] of Object.entries(translators)) {
    const icon = status.available ? "✅" : "❌";
    console.log(
      `    ${icon} ${name}: ${status.available ? status.version || "available" : "not found"}`,
    );
  }

  // 檢查或創建測試 PDF
  testPdfPath = join(E2E_FIXTURES_DIR, "sample.pdf");
  if (!existsSync(testPdfPath)) {
    console.log("\n  📄 創建測試 PDF...");
    const created = await createTestPdf(testPdfPath);
    if (!created) {
      console.log("    ⚠️ 無法創建測試 PDF，某些測試將被跳過");
    }
  } else {
    console.log(`\n  ✅ 使用現有測試 PDF: ${testPdfPath}`);
  }

  console.log();
});

afterAll(() => {
  console.log("\n" + "=".repeat(70));
  console.log("📊 多語言翻譯測試摘要 Multilingual Translation Test Summary");
  console.log("=".repeat(70));
  console.log(`總測試數 Total: ${stats.total}`);
  console.log(`✅ 通過 Passed: ${stats.passed}`);
  console.log(`❌ 失敗 Failed: ${stats.failed}`);
  console.log(`⏭ 跳過 Skipped: ${stats.skipped}`);
  console.log(
    `成功率 Success Rate: ${((stats.passed / (stats.total - stats.skipped || 1)) * 100).toFixed(1)}%`,
  );
  console.log("=".repeat(70));

  // 生成報告
  const reportPath = join(E2E_OUTPUT_DIR, "translation-report.json");
  writeFileSync(
    reportPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        translators,
        stats,
      },
      null,
      2,
    ),
  );
  console.log(`📁 報告已保存: ${reportPath}`);
});

// =============================================================================
// PDFMathTranslate 測試
// =============================================================================

describe("📚 PDFMathTranslate (pdf2zh)", () => {
  // 主要語言測試
  describe("主要語言翻譯 Primary Languages", () => {
    const primaryLanguages = SUPPORTED_LANGUAGES.filter((l) =>
      ["zh", "en", "ja", "ko"].includes(l.code),
    );

    for (const lang of primaryLanguages) {
      test(
        `英文 → ${lang.nativeName} (${lang.code})`,
        async () => {
          stats.total++;

          if (!translators.pdf2zh?.available) {
            stats.skipped++;
            console.log(`  ⏭ 跳過: pdf2zh 不可用`);
            return;
          }

          if (!existsSync(testPdfPath)) {
            stats.skipped++;
            console.log(`  ⏭ 跳過: 測試 PDF 不存在`);
            return;
          }

          const outputPath = join(E2E_OUTPUT_DIR, `pdf2zh_en_to_${lang.code}.tar`);
          const startTime = Date.now();
          const inputSize = statSync(testPdfPath).size;

          try {
            // 動態導入轉換器
            const module = await import("../../src/converters/pdfmathtranslate");

            // 設置目標語言（透過環境變數或參數）
            process.env.PDF2ZH_TARGET_LANG = lang.code;

            await module.convert(testPdfPath, "pdf", "tar", outputPath);

            const duration = Date.now() - startTime;
            const outputSize = existsSync(outputPath) ? statSync(outputPath).size : 0;
            const success = outputSize > 0;

            stats.results.push({
              translator: "pdf2zh",
              sourceLang: "en",
              targetLang: lang.code,
              success,
              duration,
              inputSize,
              outputSize,
            });

            if (success) {
              stats.passed++;
              console.log(
                `  ✓ en → ${lang.code}: ${outputSize} bytes (${(duration / 1000).toFixed(1)}s)`,
              );
            } else {
              stats.failed++;
              console.log(`  ✗ en → ${lang.code}: 輸出為空`);
            }

            expect(success).toBe(true);
          } catch (error) {
            const duration = Date.now() - startTime;
            stats.failed++;
            stats.results.push({
              translator: "pdf2zh",
              sourceLang: "en",
              targetLang: lang.code,
              success: false,
              duration,
              inputSize,
              outputSize: 0,
              error: String(error),
            });
            console.log(`  ✗ en → ${lang.code}: ${error}`);
            throw error;
          }
        },
        TIMEOUT,
      );
    }
  });

  // 次要語言測試（可選）
  describe("次要語言翻譯 Secondary Languages", () => {
    const secondaryLanguages = SUPPORTED_LANGUAGES.filter((l) =>
      ["de", "fr", "es", "ru"].includes(l.code),
    );

    for (const lang of secondaryLanguages) {
      test.skip(`英文 → ${lang.nativeName} (${lang.code})`, async () => {
        // 這些測試預設跳過，可以手動啟用
        stats.total++;
        stats.skipped++;
        console.log(`  ⏭ 跳過: 次要語言測試已禁用`);
      });
    }
  });
});

// =============================================================================

describe("🔤 語言矩陣測試 Language Matrix", () => {
  test("生成支援語言矩陣", () => {
    console.log("\n📋 支援的語言 Supported Languages:\n");
    console.log("| 代碼 | 名稱 | 本地名稱 | 測試短語 |");
    console.log("|------|------|----------|----------|");

    for (const lang of SUPPORTED_LANGUAGES) {
      console.log(
        `| ${lang.code.padEnd(6)} | ${lang.name.padEnd(20)} | ${lang.nativeName} | ${lang.testPhrase} |`,
      );
    }

    // 生成語言矩陣報告
    const matrixPath = join(E2E_OUTPUT_DIR, "language-matrix.json");
    writeFileSync(
      matrixPath,
      JSON.stringify(
        {
          languages: SUPPORTED_LANGUAGES,
          translators: Object.keys(translators),
          generatedAt: new Date().toISOString(),
        },
        null,
        2,
      ),
    );

    console.log(`\n📁 語言矩陣已保存: ${matrixPath}`);
    expect(SUPPORTED_LANGUAGES.length).toBeGreaterThan(0);
  });
});

// =============================================================================
// 翻譯品質測試（概念性）
// =============================================================================

describe("📊 翻譯品質指標 Translation Quality Metrics", () => {
  test.skip("驗證翻譯輸出完整性", async () => {
    // 這個測試會檢查翻譯輸出是否包含所有預期的頁面
    // 需要實際的翻譯輸出來執行
  });

  test.skip("驗證數學公式保留", async () => {
    // 檢查數學公式是否正確保留在翻譯後的文檔中
  });

  test.skip("驗證格式保持", async () => {
    // 檢查翻譯後的文檔格式是否與原始文檔一致
  });
});
