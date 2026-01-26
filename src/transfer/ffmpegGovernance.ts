/**
 * ConvertX-CN FFmpeg 輸出治理
 *
 * 核心治理原則：
 * 1. 禁止使用 deprecated pixel format（yuvj420p 等）
 * 2. 多輸出任務必須自動進入 TRA 封裝流程
 * 3. 單張 vs 多張輸出自動判斷
 */

import { extname } from "node:path";
import { PIXEL_FORMAT_GOVERNANCE } from "./traTypes";

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
  if (
    isImageOutput(options.outputFormat) ||
    options.outputFormat === "jpg" ||
    options.outputFormat === "jpeg"
  ) {
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
          PIXEL_FORMAT_GOVERNANCE.REPLACEMENT[
            pixFmt as keyof typeof PIXEL_FORMAT_GOVERNANCE.REPLACEMENT
          ]?.pixFmt ?? "yuv420p"
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
