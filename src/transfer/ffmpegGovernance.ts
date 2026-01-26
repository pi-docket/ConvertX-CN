/**
 * ConvertX-CN FFmpeg 輸出治理
 *
 * 核心治理原則：
 * 1. 禁止使用 deprecated pixel format（yuvj420p 等）
 * 2. 多輸出任務必須自動進入 TRA 封裝流程
 * 3. 單張 vs 多張輸出自動判斷
 */

import { existsSync, readdirSync, mkdirSync } from "node:fs";
import { join, dirname, basename, extname } from "node:path";
import { PIXEL_FORMAT_GOVERNANCE } from "./traTypes";

/**
 * FFmpeg 輸出治理配置
 */
export interface FFmpegGovernanceConfig {
  /** 是否啟用 pixel format 治理 */
  enforcePixelFormat: boolean;
  /** 是否啟用多輸出偵測 */
  detectMultiOutput: boolean;
  /** 是否自動封裝多輸出 */
  autoPackageMultiOutput: boolean;
}

/**
 * 預設治理配置
 */
export const DEFAULT_FFMPEG_GOVERNANCE: FFmpegGovernanceConfig = {
  enforcePixelFormat: true,
  detectMultiOutput: true,
  autoPackageMultiOutput: true,
};

/**
 * 圖片輸出格式
 */
const IMAGE_OUTPUT_FORMATS = new Set([
  "jpg",
  "jpeg",
  "png",
  "bmp",
  "tiff",
  "tif",
  "webp",
  "gif",
  "ppm",
  "pgm",
  "pbm",
  "pam",
]);

/**
 * 檢查是否為 sequence 輸出格式
 */
export function isSequenceOutput(outputPath: string): boolean {
  // 檢查是否包含 printf 格式指定符
  return /%\d*d/.test(outputPath);
}

/**
 * 檢查是否為圖片輸出格式
 */
export function isImageOutput(outputPath: string): boolean {
  const ext = extname(outputPath).toLowerCase().slice(1);
  return IMAGE_OUTPUT_FORMATS.has(ext);
}

/**
 * 判斷是否需要 -frames:v 1 參數
 *
 * 規則：
 * - 若輸出檔名是「單一檔名」且為圖片格式：需要 -frames:v 1
 * - 若是 sequence 格式（包含 %d）：不需要
 */
export function needsSingleFrameLimit(outputPath: string): boolean {
  // 如果是 sequence 格式，不需要限制
  if (isSequenceOutput(outputPath)) {
    return false;
  }

  // 如果是圖片格式且不是 sequence，需要限制
  return isImageOutput(outputPath);
}

/**
 * 修正 deprecated pixel format 的 FFmpeg 參數
 *
 * 問題來源：
 * - yuvj420p 已被 FFmpeg 標示為 deprecated
 * - 會產生大量 swscaler warning
 *
 * ConvertX-CN 統一修正規則（強制）：
 * - ❌ 禁止使用 yuvj420p
 * - ✅ 強制指定：-pix_fmt yuv420p -color_range 1
 *
 * 若涉及 scale：
 * - -vf "scale=in_range=pc:out_range=pc" -pix_fmt yuv420p
 */
export function getPixelFormatArgs(options: {
  /** 目標輸出格式 */
  outputFormat: string;
  /** 是否涉及 scale */
  hasScale?: boolean;
  /** 現有的 -vf 參數 */
  existingVideoFilter?: string;
}): string[] {
  const args: string[] = [];

  // 對於圖片輸出，強制使用正確的 pixel format
  if (isImageOutput(options.outputFormat) || options.outputFormat === "jpg" || options.outputFormat === "jpeg") {
    if (options.hasScale && options.existingVideoFilter) {
      // 如果已有 video filter，需要串接
      const scaleFilter = PIXEL_FORMAT_GOVERNANCE.SCALE_FILTER;
      args.push("-vf", `${options.existingVideoFilter},${scaleFilter}`);
    } else if (options.hasScale) {
      // 單純 scale 的情況
      args.push("-vf", PIXEL_FORMAT_GOVERNANCE.SCALE_FILTER);
    }

    // 加入 pixel format 和 color range
    args.push("-pix_fmt", "yuv420p");
    args.push("-color_range", "pc");
  }

  return args;
}

/**
 * 取得序列輸出的正確檔名格式
 *
 * 規則：
 * - 如果實際產出 > 1：必須使用 sequence 命名
 * - 預設格式：basename_%04d.ext
 */
export function getSequenceOutputPath(basePath: string): string {
  const dir = dirname(basePath);
  const ext = extname(basePath);
  const name = basename(basePath, ext);

  return join(dir, `${name}_%04d${ext}`);
}

/**
 * 計算輸出檔案數量
 */
export function countOutputFiles(outputDir: string, format: string): number {
  if (!existsSync(outputDir)) {
    return 0;
  }

  const ext = `.${format.toLowerCase()}`;
  const files = readdirSync(outputDir, { withFileTypes: true }).filter(
    (f) => f.isFile() && f.name.toLowerCase().endsWith(ext),
  );

  return files.length;
}

/**
 * 建立治理後的 FFmpeg 參數
 *
 * 這是 ConvertX-CN FFmpeg 轉換的核心治理函數
 */
export function buildGovernedFFmpegArgs(options: {
  /** 輸入檔案路徑 */
  inputPath: string;
  /** 輸出檔案路徑 */
  outputPath: string;
  /** 輸出格式 */
  outputFormat: string;
  /** 額外的輸入參數 */
  inputArgs?: string[];
  /** 額外的輸出參數 */
  outputArgs?: string[];
  /** 是否為 sequence 輸出 */
  isSequence?: boolean;
  /** 是否涉及 scale */
  hasScale?: boolean;
  /** 現有的 video filter */
  videoFilter?: string;
  /** 治理配置 */
  governance?: FFmpegGovernanceConfig;
}): string[] {
  const config = options.governance ?? DEFAULT_FFMPEG_GOVERNANCE;
  const args: string[] = [];

  // 輸入參數
  if (options.inputArgs) {
    args.push(...options.inputArgs);
  }

  // 輸入檔案
  args.push("-i", options.inputPath);

  // 輸出參數
  if (options.outputArgs) {
    args.push(...options.outputArgs);
  }

  // 1️⃣ 像素格式治理
  if (config.enforcePixelFormat) {
    const pixelFormatArgs = getPixelFormatArgs({
      outputFormat: options.outputFormat,
      ...(options.hasScale !== undefined && { hasScale: options.hasScale }),
      ...(options.videoFilter !== undefined && { existingVideoFilter: options.videoFilter }),
    });
    args.push(...pixelFormatArgs);
  }

  // 2️⃣ 單張 vs 多張輸出判斷
  if (config.detectMultiOutput) {
    // 如果是圖片輸出且不是 sequence，加入 -frames:v 1
    if (needsSingleFrameLimit(options.outputPath) && !options.isSequence) {
      args.push("-frames:v", "1");
    }
  }

  // 輸出檔案
  args.push(options.outputPath);

  return args;
}

/**
 * 驗證 FFmpeg 參數是否符合治理規則
 */
export function validateFFmpegArgs(args: string[]): {
  valid: boolean;
  warnings: string[];
  errors: string[];
} {
  const warnings: string[] = [];
  const errors: string[] = [];

  // 檢查 deprecated pixel format
  const pixFmtIndex = args.indexOf("-pix_fmt");
  if (pixFmtIndex !== -1 && pixFmtIndex + 1 < args.length) {
    const pixFmt = args[pixFmtIndex + 1];
    if (pixFmt && (PIXEL_FORMAT_GOVERNANCE.DEPRECATED as readonly string[]).includes(pixFmt)) {
      errors.push(
        `Deprecated pixel format: ${pixFmt}. Use ${
          PIXEL_FORMAT_GOVERNANCE.REPLACEMENT[pixFmt as keyof typeof PIXEL_FORMAT_GOVERNANCE.REPLACEMENT]?.pixFmt ?? "yuv420p"
        } with -color_range pc instead.`,
      );
    }
  }

  // 檢查是否有 -vf 參數但沒有處理 color range
  const vfIndex = args.indexOf("-vf");
  if (vfIndex !== -1) {
    const vfValue = args[vfIndex + 1] ?? "";
    if (vfValue.includes("scale") && !vfValue.includes("range")) {
      warnings.push(
        "Scale filter detected without color range handling. Consider using: scale=in_range=pc:out_range=pc",
      );
    }
  }

  // 檢查 image2 + 固定檔名 + 無 -frames:v 1 的情況
  const outputPath = args[args.length - 1];
  if (outputPath && isImageOutput(outputPath) && !isSequenceOutput(outputPath)) {
    const hasFramesLimit = args.includes("-frames:v") || args.includes("-vframes");
    if (!hasFramesLimit) {
      warnings.push(
        "Image output without -frames:v 1 may produce unexpected results. " +
          "Consider adding -frames:v 1 for single image output, or use sequence naming (%04d) for multiple frames.",
      );
    }
  }

  return {
    valid: errors.length === 0,
    warnings,
    errors,
  };
}

/**
 * 取得修正後的 FFmpeg 參數
 *
 * 自動修正：
 * - deprecated pixel format → yuv420p + color_range pc
 * - scale filter → 加入 range 處理
 * - 單張圖片輸出 → 加入 -frames:v 1
 */
export function fixFFmpegArgs(args: string[]): string[] {
  const fixed = [...args];

  // 修正 deprecated pixel format
  const pixFmtIndex = fixed.indexOf("-pix_fmt");
  if (pixFmtIndex !== -1 && pixFmtIndex + 1 < fixed.length) {
    const pixFmt = fixed[pixFmtIndex + 1];
    const replacement =
      PIXEL_FORMAT_GOVERNANCE.REPLACEMENT[pixFmt as keyof typeof PIXEL_FORMAT_GOVERNANCE.REPLACEMENT];

    if (replacement) {
      fixed[pixFmtIndex + 1] = replacement.pixFmt;

      // 加入 color_range（如果還沒有）
      if (!fixed.includes("-color_range")) {
        fixed.splice(pixFmtIndex + 2, 0, "-color_range", replacement.colorRange);
      }
    }
  }

  // 修正 scale filter（加入 range 處理）
  const vfIndex = fixed.indexOf("-vf");
  if (vfIndex !== -1 && vfIndex + 1 < fixed.length) {
    let vfValue = fixed[vfIndex + 1];
    if (vfValue && vfValue.includes("scale") && !vfValue.includes("range")) {
      // 在 scale filter 後加入 range 處理
      vfValue = vfValue.replace(
        /scale=([^:,]+):([^:,]+)/g,
        "scale=$1:$2:in_range=pc:out_range=pc",
      );
      fixed[vfIndex + 1] = vfValue;
    }
  }

  // 確保圖片輸出有 -frames:v 1
  const outputPath = fixed[fixed.length - 1];
  if (outputPath && isImageOutput(outputPath) && !isSequenceOutput(outputPath)) {
    if (!fixed.includes("-frames:v") && !fixed.includes("-vframes")) {
      // 在輸出檔案前插入
      fixed.splice(fixed.length - 1, 0, "-frames:v", "1");
    }
  }

  return fixed;
}
