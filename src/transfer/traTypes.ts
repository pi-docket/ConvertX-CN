/**
 * ConvertX-CN TRA 類型定義
 *
 * Transfer Result Archive (TRA) 的核心類型系統
 */

/**
 * 任務類型
 */
export type TaskType =
  | "single-output" // 單一輸出
  | "multi-output" // 多輸出（需要 TRA 封裝）
  | "sequence" // 序列輸出（如影片轉圖片序列）
  | "batch" // 批次處理
  | "split" // 分割輸出
  | "pages"; // 頁面輸出（如 PDF 轉多頁圖片）

/**
 * 輸出工件（單一輸出檔案）
 */
export interface OutputArtifact {
  /** 檔案名稱 */
  fileName: string;
  /** 完整檔案路徑 */
  filePath: string;
  /** 檔案格式（副檔名） */
  format: string;
  /** 檔案大小（bytes） */
  size: number;
  /** 建立時間 */
  createdAt: string;
  /** 額外 metadata */
  metadata?: Record<string, unknown>;
}

/**
 * TRA Manifest 標準格式
 *
 * 這是 ConvertX-CN 的標準輸出描述格式
 * 每個 .tra 檔案都必須包含此 manifest
 */
export interface TRAManifest {
  /** 平台標識（固定為 ConvertX-CN） */
  platform: "ConvertX-CN";
  /** Manifest 版本 */
  version: string;
  /** 任務類型 */
  task_type: TaskType;
  /** 任務 ID */
  job_id: string;
  /** 使用的轉換引擎 */
  engine: string;
  /** 來源格式（MIME type 或副檔名） */
  source_format: string;
  /** 輸出格式（MIME type 或副檔名） */
  output_format: string;
  /** 預覽檔案名稱 */
  preview: string;
  /** artifacts 目錄名稱 */
  artifacts_dir: string;
  /** 輸出檔案數量 */
  artifact_count: number;
  /** 封裝格式 */
  packaged_as: "TRA";
  /** 建立時間 */
  created_at: string;
  /** 備註 */
  note?: string;

  // ========== 可選的 metadata ==========

  /** 影片相關：FPS */
  fps?: number;
  /** 影片相關：解析度 */
  resolution?: string;
  /** 影片相關：色彩空間 */
  color_space?: string;
  /** 影片相關：像素格式 */
  pixel_format?: string;
  /** 影片相關：色彩範圍 */
  color_range?: string;

  /** PDF 相關：頁數 */
  page_count?: number;
  /** PDF 相關：DPI */
  dpi?: number;

  /** 模型相關：shard 數量 */
  shard_count?: number;

  /** 額外自訂欄位 */
  [key: string]: unknown;
}

/**
 * 多輸出結果
 */
export interface MultiOutputResult {
  /** 是否成功 */
  success: boolean;
  /** 預覽檔案路徑 */
  previewFile: string;
  /** artifacts 目錄路徑 */
  artifactsDir: string;
  /** manifest 檔案路徑 */
  manifestPath: string;
  /** 輸出檔案數量 */
  artifactCount: number;
  /** manifest 內容 */
  manifest: TRAManifest;
}

/**
 * TRA 封裝結果
 */
export interface TRAPackageResult {
  /** 是否成功 */
  success: boolean;
  /** .tra 檔案路徑 */
  traPath: string;
  /** manifest 內容 */
  manifest: TRAManifest;
  /** 錯誤訊息（如果失敗） */
  error?: string;
}

/**
 * 多輸出任務偵測模式
 */
export const MULTI_OUTPUT_PATTERNS = {
  /** 序列命名模式 */
  SEQUENCE: [
    /%\d*d/, // printf 格式（如 %03d）
    /_\d{2,4}\./, // _0001.jpg
    /-\d{2,4}\./, // -0001.jpg
  ],
  /** 頁面命名模式 */
  PAGES: [/page[-_]?\d+/i, /p[-_]?\d+/i],
  /** 影格命名模式 */
  FRAMES: [/frame[-_]?\d+/i, /f[-_]?\d+/i],
  /** 分割命名模式 */
  SPLIT: [/chunk[-_]?\d+/i, /part[-_]?\d+/i, /shard[-_]?\d+/i, /segment[-_]?\d+/i],
  /** 圖塊命名模式 */
  TILES: [/tile[-_]?\d+/i, /block[-_]?\d+/i],
} as const;

/**
 * 引擎多輸出特性
 */
export interface EngineMultiOutputConfig {
  /** 引擎名稱 */
  name: string;
  /** 是否可能產生多輸出 */
  canProduceMultiOutput: boolean;
  /** 多輸出觸發條件 */
  triggers?: string[];
  /** 預設輸出命名模式 */
  outputPattern?: string;
}

/**
 * 各引擎的多輸出配置
 */
export const ENGINE_MULTI_OUTPUT_CONFIG: Record<string, EngineMultiOutputConfig> = {
  ffmpeg: {
    name: "FFmpeg",
    canProduceMultiOutput: true,
    triggers: ["image2", "sequence", "%d", "fps", "frame", "-r"],
    outputPattern: "%04d",
  },
  imagemagick: {
    name: "ImageMagick",
    canProduceMultiOutput: true,
    triggers: ["[", "]", "-scene", "-adjoin"],
    outputPattern: "-%04d",
  },
  graphicsmagick: {
    name: "GraphicsMagick",
    canProduceMultiOutput: true,
    triggers: ["[", "]", "-scene", "+adjoin"],
    outputPattern: "-%04d",
  },
  libreoffice: {
    name: "LibreOffice",
    canProduceMultiOutput: true,
    triggers: ["pdf", "pages"],
    outputPattern: "_page_%04d",
  },
  pandoc: {
    name: "Pandoc",
    canProduceMultiOutput: true,
    triggers: ["--split-level", "--epub-chapter"],
    outputPattern: "chapter_%03d",
  },
  pdfpackager: {
    name: "PDF Packager",
    canProduceMultiOutput: true,
    triggers: ["png-*", "jpg-*", "jpeg-*", "all-*"],
    outputPattern: "page_%04d",
  },
  mineru: {
    name: "MinerU",
    canProduceMultiOutput: true,
    triggers: ["md-t", "md-i"],
    // outputPattern 省略，因為 MinerU 已使用 tar 封裝
  },
  assimp: {
    name: "Assimp",
    canProduceMultiOutput: true,
    triggers: ["multi-mesh", "scene"],
    outputPattern: "mesh_%03d",
  },
};

/**
 * FFmpeg 像素格式治理
 *
 * 禁止使用 deprecated 格式，強制使用正確替代方案
 */
export const PIXEL_FORMAT_GOVERNANCE = {
  /** 禁止使用的格式 */
  DEPRECATED: [
    "yuvj420p",
    "yuvj422p",
    "yuvj444p",
    "yuvj440p",
  ],
  /** 正確的替代格式 */
  REPLACEMENT: {
    yuvj420p: { pixFmt: "yuv420p", colorRange: "pc" },
    yuvj422p: { pixFmt: "yuv422p", colorRange: "pc" },
    yuvj444p: { pixFmt: "yuv444p", colorRange: "pc" },
    yuvj440p: { pixFmt: "yuv440p", colorRange: "pc" },
  },
  /** 標準參數 */
  STANDARD_ARGS: ["-pix_fmt", "yuv420p", "-color_range", "pc"],
  /** 含 scale 的標準參數 */
  SCALE_FILTER: "scale=in_range=pc:out_range=pc",
} as const;
