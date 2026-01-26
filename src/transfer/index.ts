/**
 * ConvertX-CN 全域檔案傳輸模組
 *
 * 統一匯出所有傳輸相關功能
 *
 * 核心治理原則：
 * - 任何「多輸出結果」禁止直接交付使用者
 * - 使用者只能拿到一個檔案（.tra 封裝）
 * - 結構化、可理解、不可誤用
 */

// 常數
export {
  CHUNK_THRESHOLD_BYTES,
  CHUNK_SIZE_BYTES,
  UPLOAD_SESSION_TIMEOUT_MS,
  CHUNK_TEMP_DIR,
  ALLOWED_ARCHIVE_FORMAT,
  FORBIDDEN_ARCHIVE_FORMATS,
  TRA_FORMAT,
  TRA_STRUCTURE,
  MULTI_OUTPUT_THRESHOLD,
} from "./constants";

// 類型
export type {
  ChunkUploadResponse,
  DirectUploadResponse,
  ChunkDownloadInfo,
  UploadSession,
  TransferMode,
} from "./types";

export { getTransferMode } from "./types";

// TRA 類型（ConvertX-CN 標準多輸出封裝）
export type {
  TRAManifest,
  MultiOutputResult,
  TRAPackageResult,
  OutputArtifact,
  TaskType,
  EngineMultiOutputConfig,
} from "./traTypes";

export {
  MULTI_OUTPUT_PATTERNS,
  ENGINE_MULTI_OUTPUT_CONFIG,
  PIXEL_FORMAT_GOVERNANCE,
} from "./traTypes";

// 上傳管理
export {
  uploadSessionManager,
  shouldUseChunkedUpload,
  handleDirectUpload,
  handleChunkUpload,
  calculateChunkCount,
} from "./uploadManager";

// 下載管理
export {
  shouldUseChunkedDownload,
  getChunkDownloadInfo,
  getChunk,
  createChunkDownloadHeaders,
} from "./downloadManager";

// 封裝管理（傳統 tar）
export {
  validateArchiveFormat,
  getArchiveFileName,
  createTarArchive,
  createJobArchive,
} from "./archiveManager";

// TRA 封裝管理（ConvertX-CN 標準多輸出封裝）
export {
  TRA_EXTENSION,
  isMultiOutputTask,
  collectOutputArtifacts,
  selectPreviewFile,
  createStandardOutputStructure,
  createTRAPackage,
  autoPackageMultiOutput,
} from "./traPackager";

// FFmpeg 輸出治理
export {
  DEFAULT_FFMPEG_GOVERNANCE,
  isSequenceOutput,
  isImageOutput,
  needsSingleFrameLimit,
  getPixelFormatArgs,
  getSequenceOutputPath,
  countOutputFiles,
  buildGovernedFFmpegArgs,
  validateFFmpegArgs,
  fixFFmpegArgs,
} from "./ffmpegGovernance";

export type { FFmpegGovernanceConfig } from "./ffmpegGovernance";
