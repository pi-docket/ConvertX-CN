import { execFile as execFileOriginal } from "node:child_process";
import {
  mkdirSync,
  existsSync,
  readdirSync,
  unlinkSync,
  rmdirSync,
  copyFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join, basename, dirname } from "node:path";
import { ExecFileFn } from "./types";
import { getArchiveFileName } from "../transfer";
import { ensureSearchablePdf, cleanupOcrTempFile } from "../helpers/pdfOcr";
import { getApiKey, clearApiKey } from "../security/keyProvider";
import { BABELDOC_ENGINE } from "../helpers/env";

/**
 * BabelDOC Content Engine
 *
 * 用於翻譯 PDF 文件的引擎，基於 BabelDOC CLI 工具。
 * 與 PDFMathTranslate 類似，但使用 babeldoc 命令進行翻譯。
 *
 * 所有輸出一律打包為 .tar 檔案，包含：
 *   - translated-<lang>.pdf（翻譯後的 PDF）
 *   - 其他 BabelDOC 產生的輔助檔案
 *
 * 必須在 Docker build 階段預先下載所需資源（--warmup），
 * 不允許在 runtime 隱式下載。
 */

// 支援的目標語言列表（與 PDFMathTranslate 保持一致）
const SUPPORTED_LANGUAGES = [
  "en", // English
  "zh", // Chinese (Simplified)
  "zh-TW", // Chinese (Traditional)
  "ja", // Japanese
  "ko", // Korean
  "de", // German
  "fr", // French
  "es", // Spanish
  "it", // Italian
  "pt", // Portuguese
  "ru", // Russian
  "ar", // Arabic
  "hi", // Hindi
  "vi", // Vietnamese
  "th", // Thai
] as const;

// 支援的輸出格式
const SUPPORTED_OUTPUT_FORMATS = ["pdf", "md", "html"] as const;
type OutputFormat = (typeof SUPPORTED_OUTPUT_FORMATS)[number];

// BabelDOC 快取路徑（Docker 環境中）
const BABELDOC_CACHE_PATH = process.env.BABELDOC_CACHE_PATH || "/root/.cache/babeldoc";

// 生成 from/to 格式映射
function generateLanguageMappings(): {
  from: Record<string, string[]>;
  to: Record<string, string[]>;
} {
  // BabelDOC 輸出格式：
  // - pdf-<lang>: 輸出 PDF
  // - md-<lang>: 輸出 Markdown
  // - html-<lang>: 輸出 HTML
  const outputFormats: string[] = [];

  for (const format of SUPPORTED_OUTPUT_FORMATS) {
    for (const lang of SUPPORTED_LANGUAGES) {
      outputFormats.push(`${format}-${lang}`);
    }
  }

  return {
    from: {
      document: ["pdf"],
    },
    to: {
      document: outputFormats,
    },
  };
}

export const properties = {
  ...generateLanguageMappings(),
  outputMode: "archive" as const,
};

/**
 * 從 convertTo 格式中提取目標語言和輸出格式
 * @param convertTo 格式如 "pdf-zh"、"md-en"、"html-ja"
 * @returns { lang: 目標語言代碼, format: 輸出格式 }
 */
function extractTargetInfo(convertTo: string): { lang: string; format: OutputFormat } {
  // convertTo 格式: <format>-<lang>
  // 例如: pdf-zh, md-en, html-ja
  const match = convertTo.match(/^(pdf|md|html)-(.+)$/);
  if (!match || !match[1] || !match[2]) {
    throw new Error(
      `Invalid convertTo format: ${convertTo}. Expected <format>-<lang> (format: pdf/md/html)`,
    );
  }
  return {
    format: match[1] as OutputFormat,
    lang: match[2],
  };
}

/**
 * 檢查 BabelDOC 資源是否已預先下載
 * @returns 資源是否存在
 */
function checkResourcesExist(): boolean {
  if (!existsSync(BABELDOC_CACHE_PATH)) {
    console.warn(`[BabelDOC] Cache directory not found: ${BABELDOC_CACHE_PATH}`);
    console.warn(`[BabelDOC] Resources should be pre-downloaded via --warmup during Docker build.`);
    return false;
  }
  return true;
}

/**
 * Helper function to create a .tar archive from a directory (no compression)
 *
 * ⚠️ 重要：僅使用 .tar 格式，禁止 .tar.gz / .tgz / .zip
 */
function createTarArchive(
  sourceDir: string,
  outputTar: string,
  execFile: ExecFileFn,
): Promise<void> {
  return new Promise((resolve, reject) => {
    // Use tar command to create archive (without gzip compression)
    // tar -cf <output.tar> -C <sourceDir> .
    // 注意：使用 -cf 而非 -czf，避免 gzip 壓縮
    execFile("tar", ["-cf", outputTar, "-C", sourceDir, "."], (error, stdout, stderr) => {
      if (error) {
        reject(`tar error: ${error}`);
        return;
      }
      if (stdout) {
        console.log(`tar stdout: ${stdout}`);
      }
      if (stderr) {
        console.error(`tar stderr: ${stderr}`);
      }
      resolve();
    });
  });
}

/**
 * Helper function to remove a directory recursively
 */
function removeDir(dirPath: string): void {
  if (existsSync(dirPath)) {
    const files = readdirSync(dirPath, { withFileTypes: true });
    for (const file of files) {
      const filePath = join(dirPath, file.name);
      if (file.isDirectory()) {
        removeDir(filePath);
      } else {
        unlinkSync(filePath);
      }
    }
    rmdirSync(dirPath);
  }
}

/**
 * BabelDOC 語言代碼轉換
 * BabelDOC 可能使用不同的語言代碼格式
 */
function toBabelDocLang(lang: string): string {
  // BabelDOC 語言代碼映射
  const langMap: Record<string, string> = {
    "zh-TW": "zh-Hant",
    zh: "zh-Hans",
  };
  return langMap[lang] || lang;
}

/**
 * 取得 BabelDOC 輸出格式對應的副檔名
 */
function getOutputExtension(format: OutputFormat): string {
  const extMap: Record<OutputFormat, string> = {
    pdf: "pdf",
    md: "md",
    html: "html",
  };
  return extMap[format];
}

function toBabelDocConfigLang(lang: string): string {
  const langMap: Record<string, string> = {
    "zh-TW": "zh-tw",
    zh: "zh-cn",
  };
  return langMap[lang] || lang.toLowerCase();
}

function yamlQuote(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

interface BabelDocRuntimeConfig {
  configPath: string;
  modelName: string;
  cleanup: () => void;
}

function xorDecryptHex(hexValue: string, key: string): string {
  const encoded = Buffer.from(hexValue, "hex").toString("latin1");
  return [...encoded]
    .map((char, i) => String.fromCharCode(char.charCodeAt(0) ^ key.charCodeAt(i % key.length)))
    .join("");
}

const BABELDOC_SECRET_KEY_PARTS = ["c0n", "v3r", "tx-", "bdo", "c"] as const;
const BABELDOC_SECRET_KEY = BABELDOC_SECRET_KEY_PARTS.join("");
const BABELDOC_MODEL_ENCRYPTED = "17550015561c005765170a1616025e433b675f433a";
const BABELDOC_BASE_URL_ENCRYPTED = "0b441a0640485b574c120d41100a5c07155c1c121442154a0c0d4c465f";

/**
 * 取得翻譯服務的 CLI 參數
 *
 * 目前支援 SiliconFlow 翻譯服務，透過 Cloudflare Worker 取得 API key。
 * API key 會在使用後自動清除。
 *
 * @param userId 使用者 ID（可選，暫時未使用）
 * @returns Promise<{ args: string[], cleanup: () => void }> CLI 參數陣列和清理函數
 */
async function createTempBabelDocConfig(
  outputDir: string,
  targetLang: string,
  fetchApiKey: () => Promise<string>,
  userId?: number,
): Promise<BabelDocRuntimeConfig> {
  void userId;

  const engine = BABELDOC_ENGINE.toLowerCase();

  // 如果是 placeholder 或未配置，拋出錯誤
  if (engine === "placeholder" || !engine) {
    throw new Error(
      "Translation is not configured. Please set BABELDOC_ENGINE to one of: siliconflow, openai, deepseek, custom",
    );
  }

  // SiliconFlow 翻譯服務
  if (engine === "siliconflow") {
    let apiKey = "";
    let configPath = "";

    try {
      // 每次請求都重新取得 API key，禁止重用快取。
      apiKey = await fetchApiKey();

      const modelName = xorDecryptHex(BABELDOC_MODEL_ENCRYPTED, BABELDOC_SECRET_KEY);
      const baseUrl = xorDecryptHex(BABELDOC_BASE_URL_ENCRYPTED, BABELDOC_SECRET_KEY);
      const configLang = toBabelDocConfigLang(targetLang);
      configPath = join(
        outputDir,
        `.babeldoc-config-${Date.now()}-${Math.random().toString(36).slice(2)}.yaml`,
      );

      const configContent = [
        "model:",
        "  provider: openai",
        `  model: ${yamlQuote(modelName)}`,
        `  base_url: ${yamlQuote(baseUrl)}`,
        `  api_key: ${yamlQuote(apiKey)}`,
        "",
        "translation:",
        `  target_lang: ${yamlQuote(configLang)}`,
        "",
      ].join("\n");

      writeFileSync(configPath, configContent, { encoding: "utf8" });

      return {
        configPath,
        modelName,
        cleanup: () => {
          if (configPath && existsSync(configPath)) {
            unlinkSync(configPath);
          }
          clearApiKey(apiKey);
          apiKey = "";
        },
      };
    } catch (error) {
      // 部分建立成功時仍要確保清理。
      if (configPath && existsSync(configPath)) {
        unlinkSync(configPath);
      }
      if (apiKey) {
        clearApiKey(apiKey);
        apiKey = "";
      }
      void error;
      throw new Error("Failed to fetch BabelDOC credentials");
    }
  }

  // 其他翻譯引擎（尚未實作）
  throw new Error(
    `Translation engine "${engine}" is not supported. Available: siliconflow, placeholder`,
  );
}

/**
 * 執行 babeldoc 命令進行 PDF 翻譯
 *
 * @param inputPath 輸入 PDF 路徑
 * @param outputPath 輸出檔案路徑
 * @param targetLang 目標語言
 * @param outputFormat 輸出格式（pdf/md/html）
 * @param execFile 執行函數
 * @param userId 使用者 ID（用於取得翻譯設定）
 */
async function runBabelDoc(
  inputPath: string,
  outputPath: string,
  targetLang: string,
  outputFormat: OutputFormat,
  execFile: ExecFileFn,
  fetchApiKey: () => Promise<string>,
  userId?: number,
): Promise<string> {
  const outputDir = dirname(outputPath);
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  const { configPath, modelName, cleanup } = await createTempBabelDocConfig(
    outputDir,
    targetLang,
    fetchApiKey,
    userId,
  );

  try {
    console.log("[BabelDOC] Translation started");
    console.log(`[BabelDOC] Model: ${modelName}`);
    console.log("[BabelDOC] Config created");

    return await new Promise<string>((resolve, reject) => {
      const babelLang = toBabelDocLang(targetLang);
      const args = ["--files", inputPath, "--output", outputDir, "-c", configPath];

      console.log("[BabelDOC] Running translation");

      execFile("babeldoc", args, (error, stdout, stderr) => {
        if (error) {
          void stdout;
          void stderr;
          reject(new Error("BabelDOC translation failed"));
          return;
        }

        // 新版 babeldoc 輸出到目錄，需要找到輸出檔案
        // 輸出檔案可能是 <input>-mono.pdf 或 <input>-dual.pdf
        const inputBasename = basename(inputPath, ".pdf");
        const possibleOutputs = [
          join(outputDir, `${inputBasename}-mono.pdf`),
          join(outputDir, `${inputBasename}-dual.pdf`),
          join(outputDir, `${inputBasename}.pdf`),
          outputPath,
        ];

        for (const possibleOutput of possibleOutputs) {
          if (existsSync(possibleOutput)) {
            // 如果找到的不是預期的輸出路徑，複製過去
            if (possibleOutput !== outputPath && existsSync(possibleOutput)) {
              copyFileSync(possibleOutput, outputPath);
            }
            resolve(outputPath);
            return;
          }
        }

        // 如果都找不到，嘗試找任何 PDF 檔案
        const files = readdirSync(outputDir);
        const expectedExt = `.${getOutputExtension(outputFormat)}`;
        const translatedFile = files.find(
          (f) => f.endsWith(expectedExt) && f.includes(inputBasename),
        );
        if (translatedFile) {
          const foundPath = join(outputDir, translatedFile);
          if (foundPath !== outputPath) {
            copyFileSync(foundPath, outputPath);
          }
          resolve(outputPath);
          return;
        }

        reject(new Error(`No BabelDOC output generated for language ${babelLang}`));
      });
    });
  } finally {
    // 無論成功或失敗都必須立刻刪除暫存設定檔。
    cleanup();
    console.log("[BabelDOC] Config deleted");
  }
}

/**
 * 主要轉換函數
 *
 * @param filePath 輸入 PDF 檔案路徑
 * @param fileType 檔案類型（應為 "pdf"）
 * @param convertTo 目標格式（如 "pdf-babel-zh"、"md-babel-en"、"html-babel-ja"）
 * @param targetPath 輸出路徑
 * @param options 額外選項（包含 userId）
 * @param execFile 執行函數覆寫
 */
export async function convert(
  filePath: string,
  fileType: string,
  convertTo: string,
  targetPath: string,
  options?: unknown,
  execFile: ExecFileFn = execFileOriginal,
): Promise<string> {
  // 從 options 中安全提取 userId
  const userId =
    options && typeof options === "object" && "userId" in options
      ? (options as { userId?: number }).userId
      : undefined;

  const fetchApiKey =
    options &&
    typeof options === "object" &&
    "_babeldocGetApiKey" in options &&
    typeof (options as { _babeldocGetApiKey?: unknown })._babeldocGetApiKey === "function"
      ? ((options as { _babeldocGetApiKey: () => Promise<string> })
          ._babeldocGetApiKey as () => Promise<string>)
      : () => getApiKey({ disableCache: true });

  let ocrTempFile: string | undefined;
  let tempDir: string | undefined;

  try {
    // 1. 自動偵測掃描版 PDF 並進行 OCR 處理
    console.log(`[BabelDOC] Checking if PDF needs OCR...`);
    const ocrResult = await ensureSearchablePdf(filePath, execFile);
    const inputPdf = ocrResult.path;
    ocrTempFile = ocrResult.tempFile;

    if (ocrResult.wasOcred) {
      console.log(`[BabelDOC] ✅ Scanned PDF detected and OCR'd automatically`);
    }

    // 2. 檢查資源（警告但不阻止）
    checkResourcesExist();

    // 3. 提取目標語言和輸出格式
    const { lang: targetLang, format: outputFormat } = extractTargetInfo(convertTo);
    const outputExt = getOutputExtension(outputFormat);
    console.log(`[BabelDOC] Translating to: ${targetLang}, format: ${outputFormat}`);

    // 4. 建立臨時輸出目錄
    const outputDir = dirname(targetPath);
    const inputFileName = basename(filePath, `.${fileType}`);
    tempDir = join(outputDir, `${inputFileName}_babeldoc_${Date.now()}`);

    if (!existsSync(tempDir)) {
      mkdirSync(tempDir, { recursive: true });
    }

    // 5. 建立封裝用目錄
    const archiveDir = join(tempDir, "archive");
    mkdirSync(archiveDir, { recursive: true });

    // 6. 設定 BabelDOC 輸出路徑（依輸出格式決定副檔名）
    const translatedFilePath = join(tempDir, `${inputFileName}-translated.${outputExt}`);

    // 7. 執行 babeldoc 翻譯（使用 OCR 處理後的 PDF，根據使用者設定選擇翻譯服務）
    await runBabelDoc(
      inputPdf,
      translatedFilePath,
      targetLang,
      outputFormat,
      execFile,
      fetchApiKey,
      userId,
    );

    // 8. 複製翻譯後的檔案到封裝目錄
    const translatedDest = join(archiveDir, `translated-${targetLang}.${outputExt}`);
    copyFileSync(translatedFilePath, translatedDest);
    console.log(`[BabelDOC] Copied translated ${outputFormat.toUpperCase()} to archive`);

    // 9. 檢查是否有其他 BabelDOC 產生的輔助檔案
    const translatedBaseName = `${inputFileName}-translated.${outputExt}`;
    const tempFiles = readdirSync(tempDir);
    for (const file of tempFiles) {
      const fileTempPath = join(tempDir, file);
      // 跳過 archive 目錄和已處理的主檔案
      if (file === "archive" || file === translatedBaseName) {
        continue;
      }
      // 複製其他產生的檔案（如 debug 輸出、中間結果等）
      const destPath = join(archiveDir, file);
      if (existsSync(fileTempPath) && !existsSync(destPath)) {
        try {
          const stats = statSync(fileTempPath);
          if (stats.isFile()) {
            copyFileSync(fileTempPath, destPath);
            console.log(`[BabelDOC] Copied auxiliary file: ${file}`);
          }
        } catch {
          // 忽略複製失敗的輔助檔案
        }
      }
    }

    // 9. 建立 .tar 封裝
    const tarPath = getArchiveFileName(targetPath);
    const tarDir = dirname(tarPath);
    if (!existsSync(tarDir)) {
      mkdirSync(tarDir, { recursive: true });
    }

    await createTarArchive(archiveDir, tarPath, execFile);
    console.log(`[BabelDOC] Created archive: ${tarPath}`);

    // 10. 清理臨時目錄
    return "Done";
  } catch (error) {
    void error;
    throw new Error("BabelDOC translation failed");
  } finally {
    if (tempDir && existsSync(tempDir)) {
      removeDir(tempDir);
    }
    cleanupOcrTempFile(ocrTempFile);
  }
}
