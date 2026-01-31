/**
 * =============================================================================
 * ConvertX-CN RAS API (Remote AI Service API)
 * =============================================================================
 *
 * 這是 ConvertX-CN 的對外公開 API 模組，專為外部系統整合設計。
 *
 * 📦 功能：
 *   - 引擎資訊查詢
 *   - 格式相容性檢查
 *   - 健康檢查
 *
 * 🔐 認證：
 *   - 所有端點：不需認證（公開查詢）
 *
 * 📖 使用方式：
 *   所有端點都在 /api/v1/ 前綴下
 *   回應格式統一為 JSON
 *
 * =============================================================================
 */

import Elysia, { t } from "elysia";
import { userService } from "./user";
import {
  getAllInputs,
  getAllTargets,
  getDisabledEngines,
  getPossibleTargets,
} from "../converters/main";
import os from "node:os";
import { randomUUID } from "node:crypto";

// ==============================================================================
// API 版本資訊
// ==============================================================================
const API_VERSION = "1.0.0";
const API_NAME = "ConvertX-CN RAS API";

// ==============================================================================
// 錯誤碼定義
// ==============================================================================
const ErrorCodes = {
  // 成功
  SUCCESS: "SUCCESS",

  // 客戶端錯誤 (4xx)
  BAD_REQUEST: "BAD_REQUEST",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  FILE_TOO_LARGE: "FILE_TOO_LARGE",
  UNSUPPORTED_FORMAT: "UNSUPPORTED_FORMAT",
  CONVERTER_NOT_FOUND: "CONVERTER_NOT_FOUND",
  ENGINE_NOT_FOUND: "ENGINE_NOT_FOUND",
  JOB_NOT_FOUND: "JOB_NOT_FOUND",

  // 伺服器錯誤 (5xx)
  INTERNAL_ERROR: "INTERNAL_ERROR",
  CONVERSION_FAILED: "CONVERSION_FAILED",
  ENGINE_UNAVAILABLE: "ENGINE_UNAVAILABLE",
} as const;

type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

// ==============================================================================
// 回應格式輔助函數
// ==============================================================================
interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: ErrorCode;
    message: string;
    details?: unknown;
  };
  meta?: {
    version: string;
    timestamp: string;
    requestId: string;
  };
}

function createSuccessResponse<T>(data: T, requestId?: string): ApiResponse<T> {
  return {
    success: true,
    data,
    meta: {
      version: API_VERSION,
      timestamp: new Date().toISOString(),
      requestId: requestId || randomUUID(),
    },
  };
}

function createErrorResponse(
  code: ErrorCode,
  message: string,
  details?: unknown,
  requestId?: string,
): ApiResponse {
  return {
    success: false,
    error: {
      code,
      message,
      details,
    },
    meta: {
      version: API_VERSION,
      timestamp: new Date().toISOString(),
      requestId: requestId || randomUUID(),
    },
  };
}

// ==============================================================================
// RAS API 模組
// ==============================================================================
export const rasApi = new Elysia({ prefix: "/api/v1" })
  .use(userService)

  // ============================================================================
  // 🌐 公開端點 - 不需認證
  // ============================================================================

  /**
   * API 健康檢查
   * 用於監控和負載均衡器健康探測
   */
  .get(
    "/health",
    () => {
      return createSuccessResponse({
        status: "healthy",
        service: API_NAME,
        version: API_VERSION,
        uptime: process.uptime(),
        platform: `${os.platform()}/${os.arch()}`,
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
          unit: "MB",
        },
      });
    },
    { auth: false },
  )

  /**
   * API 資訊
   * 提供 API 版本、功能列表等資訊
   */
  .get(
    "/info",
    () => {
      const allTargets = getAllTargets();
      const disabledEngines = getDisabledEngines();

      return createSuccessResponse({
        name: API_NAME,
        version: API_VERSION,
        description: "ConvertX-CN 檔案轉換服務 API",
        documentation: "/api/v1/docs",
        endpoints: {
          public: [
            "GET /api/v1/health",
            "GET /api/v1/info",
            "GET /api/v1/engines",
            "GET /api/v1/engines/:id",
            "GET /api/v1/formats",
            "GET /api/v1/formats/:format/targets",
            "POST /api/v1/validate",
          ],
          authenticated: [
            "POST /api/v1/convert",
            "GET /api/v1/jobs",
            "GET /api/v1/jobs/:id",
            "DELETE /api/v1/jobs/:id",
            "GET /api/v1/jobs/:id/download",
          ],
        },
        capabilities: {
          totalEngines: Object.keys(allTargets).length,
          availableEngines: Object.keys(allTargets).length - disabledEngines.length,
          disabledEngines: disabledEngines,
        },
      });
    },
    { auth: false },
  )

  /**
   * 列出所有轉換引擎
   */
  .get(
    "/engines",
    () => {
      const allTargets = getAllTargets();
      const disabledEngines = getDisabledEngines();

      const engines = Object.entries(allTargets).map(([name, outputs]) => {
        const inputs = getAllInputs(name);
        const isDisabled = disabledEngines.includes(name.toLowerCase());

        return {
          id: name,
          name: name,
          description: getEngineDescription(name),
          inputs: inputs,
          outputs: outputs,
          inputCount: inputs.length,
          outputCount: outputs.length,
          available: !isDisabled,
          disabledReason: isDisabled ? `Disabled on this platform` : null,
          category: getEngineCategory(name),
        };
      });

      return createSuccessResponse({
        engines,
        summary: {
          total: engines.length,
          available: engines.filter((e) => e.available).length,
          disabled: engines.filter((e) => !e.available).length,
        },
      });
    },
    { auth: false },
  )

  /**
   * 取得特定引擎詳情
   */
  .get(
    "/engines/:id",
    ({ params: { id } }) => {
      const allTargets = getAllTargets();
      const outputs = allTargets[id];
      const inputs = getAllInputs(id);
      const disabledEngines = getDisabledEngines();

      if (!outputs) {
        return createErrorResponse(ErrorCodes.ENGINE_NOT_FOUND, `Engine '${id}' not found`, {
          availableEngines: Object.keys(allTargets),
        });
      }

      const isDisabled = disabledEngines.includes(id.toLowerCase());

      return createSuccessResponse({
        engine: {
          id,
          name: id,
          description: getEngineDescription(id),
          inputs,
          outputs,
          inputCount: inputs.length,
          outputCount: outputs.length,
          available: !isDisabled,
          disabledReason: isDisabled ? `Disabled on this platform` : null,
          category: getEngineCategory(id),
          conversions: inputs.flatMap((input) =>
            outputs.map((output) => ({ from: input, to: output })),
          ),
        },
      });
    },
    { auth: false },
  )

  /**
   * 列出所有支援的格式
   */
  .get(
    "/formats",
    () => {
      const allTargets = getAllTargets();
      const allInputFormats = new Set<string>();
      const allOutputFormats = new Set<string>();

      for (const converterName in allTargets) {
        const inputs = getAllInputs(converterName);
        const outputs = allTargets[converterName];

        inputs.forEach((f) => allInputFormats.add(f));
        if (outputs) {
          outputs.forEach((f) => allOutputFormats.add(f));
        }
      }

      return createSuccessResponse({
        inputs: Array.from(allInputFormats).sort(),
        outputs: Array.from(allOutputFormats).sort(),
        inputCount: allInputFormats.size,
        outputCount: allOutputFormats.size,
      });
    },
    { auth: false },
  )

  /**
   * 查詢特定格式可轉換的目標格式
   */
  .get(
    "/formats/:format/targets",
    ({ params: { format } }) => {
      const targets = getPossibleTargets(format.toLowerCase());

      if (Object.keys(targets).length === 0) {
        return createErrorResponse(
          ErrorCodes.UNSUPPORTED_FORMAT,
          `Format '${format}' is not supported as input`,
          { format },
        );
      }

      return createSuccessResponse({
        inputFormat: format.toLowerCase(),
        converters: Object.entries(targets).map(([engine, outputs]) => ({
          engine,
          outputs,
          outputCount: outputs.length,
        })),
        allOutputs: [...new Set(Object.values(targets).flat())].sort(),
      });
    },
    { auth: false },
  )

  /**
   * 驗證轉換是否支援
   */
  .post(
    "/validate",
    ({ body }) => {
      const { inputFormat, outputFormat, engine } = body;

      const targets = getPossibleTargets(inputFormat.toLowerCase());

      if (Object.keys(targets).length === 0) {
        return createSuccessResponse({
          valid: false,
          reason: "INPUT_FORMAT_NOT_SUPPORTED",
          message: `Input format '${inputFormat}' is not supported`,
          suggestions: [],
        });
      }

      // 如果指定了引擎
      if (engine) {
        const engineOutputs = targets[engine];
        if (!engineOutputs) {
          return createSuccessResponse({
            valid: false,
            reason: "ENGINE_NOT_SUPPORT_INPUT",
            message: `Engine '${engine}' does not support input format '${inputFormat}'`,
            suggestions: Object.keys(targets),
          });
        }

        if (!engineOutputs.includes(outputFormat.toLowerCase())) {
          return createSuccessResponse({
            valid: false,
            reason: "ENGINE_NOT_SUPPORT_OUTPUT",
            message: `Engine '${engine}' cannot convert '${inputFormat}' to '${outputFormat}'`,
            suggestions: engineOutputs,
          });
        }

        return createSuccessResponse({
          valid: true,
          inputFormat: inputFormat.toLowerCase(),
          outputFormat: outputFormat.toLowerCase(),
          engine,
        });
      }

      // 未指定引擎，尋找可用的引擎
      const availableEngines = Object.entries(targets)
        .filter(([, outputs]) => outputs.includes(outputFormat.toLowerCase()))
        .map(([name]) => name);

      if (availableEngines.length === 0) {
        return createSuccessResponse({
          valid: false,
          reason: "OUTPUT_FORMAT_NOT_SUPPORTED",
          message: `Cannot convert '${inputFormat}' to '${outputFormat}'`,
          suggestions: [...new Set(Object.values(targets).flat())].sort(),
        });
      }

      return createSuccessResponse({
        valid: true,
        inputFormat: inputFormat.toLowerCase(),
        outputFormat: outputFormat.toLowerCase(),
        availableEngines,
        recommendedEngine: availableEngines[0],
      });
    },
    {
      auth: false,
      body: t.Object({
        inputFormat: t.String(),
        outputFormat: t.String(),
        engine: t.Optional(t.String()),
      }),
    },
  );

// ==============================================================================
// 輔助函數
// ==============================================================================

/**
 * 取得引擎描述
 */
function getEngineDescription(engine: string): string {
  const descriptions: Record<string, string> = {
    inkscape: "SVG 向量圖形編輯器，支援 SVG 與點陣圖格式轉換",
    libjxl: "JPEG XL 格式編解碼器",
    resvg: "高效能 SVG 渲染引擎",
    vips: "高效能影像處理庫",
    libheif: "HEIF/HEIC 格式編解碼器",
    xelatex: "LaTeX 文件編譯器",
    calibre: "電子書格式轉換工具",
    dasel: "結構化資料格式轉換工具 (JSON/YAML/TOML)",
    libreoffice: "辦公文件格式轉換 (DOC/DOCX/XLS/PPT → PDF)",
    pandoc: "萬用文件格式轉換器 (Markdown/HTML/LaTeX)",
    msgconvert: "Outlook MSG 檔案轉換",
    dvisvgm: "DVI 轉 SVG 轉換器",
    imagemagick: "萬用影像格式轉換與處理",
    graphicsmagick: "高效能影像處理 (ImageMagick 分支)",
    assimp: "3D 模型格式轉換",
    ffmpeg: "多媒體格式轉換 (影片/音訊)",
    potrace: "點陣圖轉向量圖 (黑白)",
    vtracer: "點陣圖轉向量圖 (彩色)",
    vcf: "vCard 聯絡人格式轉換",
    markitDown: "Office 文件轉 Markdown",
    MinerU: "PDF 高品質解析與萃取",
    PDFMathTranslate: "PDF 學術翻譯 (保留公式)",
    BabelDOC: "PDF 學術翻譯 (BabelDOC 引擎)",
    OCRmyPDF: "PDF OCR 文字辨識",
    "PDF Packager": "PDF 打包工具",
    deark: "舊格式圖檔解碼",
  };

  return descriptions[engine] || `${engine} 轉換引擎`;
}

/**
 * 取得引擎分類
 */
function getEngineCategory(engine: string): string {
  const categories: Record<string, string> = {
    inkscape: "vector",
    libjxl: "image",
    resvg: "vector",
    vips: "image",
    libheif: "image",
    xelatex: "document",
    calibre: "ebook",
    dasel: "data",
    libreoffice: "document",
    pandoc: "document",
    msgconvert: "email",
    dvisvgm: "document",
    imagemagick: "image",
    graphicsmagick: "image",
    assimp: "3d",
    ffmpeg: "media",
    potrace: "vector",
    vtracer: "vector",
    vcf: "data",
    markitDown: "document",
    MinerU: "ai",
    PDFMathTranslate: "ai",
    BabelDOC: "ai",
    OCRmyPDF: "ai",
    "PDF Packager": "document",
    deark: "image",
  };

  return categories[engine] || "other";
}
