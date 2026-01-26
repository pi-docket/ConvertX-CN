/**
 * ConvertX-CN TRA 封裝管理器
 *
 * TRA (Transfer Result Archive) 是 ConvertX-CN 的標準輸出格式
 * 用於封裝多輸出結果，確保使用者只需下載一個檔案
 *
 * 核心設計原則：
 * - 任何「多輸出結果」禁止直接交付使用者
 * - 使用者只能拿到一個檔案
 * - 結構化、可理解、不可誤用
 */

import {
  existsSync,
  mkdirSync,
  readdirSync,
  copyFileSync,
  writeFileSync,
  statSync,
  readFileSync,
} from "node:fs";
import { join, extname, dirname } from "node:path";
import * as tar from "tar";
import { TRAManifest, MultiOutputResult, OutputArtifact, TaskType } from "./traTypes";
import { TRA_STRUCTURE } from "./constants";

/**
 * TRA 封裝選項
 */
export interface TRAPackageOptions {
  /** 任務 ID */
  jobId: string;
  /** 使用的轉換引擎 */
  engine: string;
  /** 來源格式 */
  sourceFormat: string;
  /** 輸出格式 */
  outputFormat: string;
  /** 額外的 metadata */
  metadata?: Record<string, unknown>;
  /** 預覽檔案選擇器（預設取第一個） */
  previewSelector?: (artifacts: OutputArtifact[]) => OutputArtifact | undefined;
}

/**
 * TRA 檔案副檔名
 */
export const TRA_EXTENSION = ".tra";

/**
 * 判斷是否為多輸出任務
 *
 * 符合以下任一條件即視為多輸出任務：
 * - FFmpeg image2 / sequence（%03d, %04d）
 * - video → 多張圖片
 * - PDF → 多頁圖片 / 多頁 PDF
 * - CAD → 多視角 / 多零件
 * - 模型 → shards / chunks
 * - split / batch / page / frame / tile
 */
export function isMultiOutputTask(
  outputDir: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _outputFormat: string,
): { isMulti: boolean; reason?: string; fileCount: number } {
  if (!existsSync(outputDir)) {
    return { isMulti: false, fileCount: 0 };
  }

  const files = readdirSync(outputDir, { withFileTypes: true })
    .filter((f) => f.isFile() && !f.name.startsWith("."))
    .map((f) => f.name);

  // 排除 manifest.json 和已封裝的 .tra 檔案
  const outputFiles = files.filter((f) => !f.endsWith(".tra") && f !== TRA_STRUCTURE.MANIFEST_FILE);

  // ========== 唯一判斷標準：只看數量 ==========
  // = 1 → 單檔輸出
  // ≥ 2 → 多檔輸出，必須 TRA
  if (outputFiles.length <= 1) {
    return { isMulti: false, fileCount: outputFiles.length };
  }

  // 多檔輸出（≥ 2）
  return {
    isMulti: true,
    reason: `Multiple output files: ${outputFiles.length}`,
    fileCount: outputFiles.length,
  };
}

/**
 * 收集輸出目錄中的所有檔案
 */
export function collectOutputArtifacts(outputDir: string): OutputArtifact[] {
  if (!existsSync(outputDir)) {
    return [];
  }

  const artifacts: OutputArtifact[] = [];
  const files = readdirSync(outputDir, { withFileTypes: true });

  for (const file of files) {
    if (file.isFile() && !file.name.startsWith(".")) {
      // 排除 manifest 和已封裝的 tra 檔案
      if (file.name === TRA_STRUCTURE.MANIFEST_FILE || file.name.endsWith(TRA_EXTENSION)) {
        continue;
      }

      const filePath = join(outputDir, file.name);
      const stats = statSync(filePath);
      const ext = extname(file.name).toLowerCase().slice(1);

      artifacts.push({
        fileName: file.name,
        filePath: filePath,
        format: ext,
        size: stats.size,
        createdAt: stats.birthtime.toISOString(),
      });
    }
  }

  // 按檔名排序（確保序列順序正確）
  artifacts.sort((a, b) => a.fileName.localeCompare(b.fileName, undefined, { numeric: true }));

  return artifacts;
}

/**
 * 選擇預覽檔案
 *
 * 預設邏輯：
 * 1. 取第一個產出（序列的第一個）
 * 2. 或語意上最能代表結果的輸出
 */
export function selectPreviewFile(
  artifacts: OutputArtifact[],
  customSelector?: (artifacts: OutputArtifact[]) => OutputArtifact | undefined,
): OutputArtifact | undefined {
  if (artifacts.length === 0) {
    return undefined;
  }

  // 使用自定義選擇器
  if (customSelector) {
    const selected = customSelector(artifacts);
    if (selected) {
      return selected;
    }
  }

  // 預設：取第一個
  return artifacts[0];
}

/**
 * 建立標準輸出結構
 *
 * output_root/
 * ├── preview.<ext>        ← 封面 / 代表輸出（必須）
 * ├── artifacts/           ← 其餘所有輸出
 * │   ├── item_001.<ext>
 * │   ├── item_002.<ext>
 * │   └── ...
 * └── manifest.json        ← 結構與語意描述（必須）
 */
export async function createStandardOutputStructure(
  sourceDir: string,
  targetDir: string,
  options: TRAPackageOptions,
): Promise<MultiOutputResult> {
  // 確保目標目錄存在
  if (!existsSync(targetDir)) {
    mkdirSync(targetDir, { recursive: true });
  }

  // 收集所有輸出檔案
  const artifacts = collectOutputArtifacts(sourceDir);

  if (artifacts.length === 0) {
    throw new Error("No output artifacts found");
  }

  // 選擇預覽檔案
  const previewArtifact = selectPreviewFile(artifacts, options.previewSelector);
  if (!previewArtifact) {
    throw new Error("Cannot select preview file");
  }

  // 建立 artifacts 目錄
  const artifactsDir = join(targetDir, TRA_STRUCTURE.ARTIFACTS_DIR);
  if (!existsSync(artifactsDir)) {
    mkdirSync(artifactsDir, { recursive: true });
  }

  // 複製預覽檔案
  const previewExt = extname(previewArtifact.fileName);
  const previewFileName = `${TRA_STRUCTURE.PREVIEW_PREFIX}${previewExt}`;
  const previewPath = join(targetDir, previewFileName);
  copyFileSync(previewArtifact.filePath, previewPath);

  // 複製其餘檔案到 artifacts 目錄
  const otherArtifacts: OutputArtifact[] = [];
  for (const artifact of artifacts) {
    const targetPath = join(artifactsDir, artifact.fileName);
    copyFileSync(artifact.filePath, targetPath);
    otherArtifacts.push({
      ...artifact,
      filePath: targetPath,
    });
  }

  // 建立 manifest
  const manifest: TRAManifest = {
    platform: "ConvertX-CN",
    version: "1.0.0",
    task_type: "multi-output" as TaskType,
    job_id: options.jobId,
    engine: options.engine,
    source_format: options.sourceFormat,
    output_format: options.outputFormat,
    preview: previewFileName,
    artifacts_dir: TRA_STRUCTURE.ARTIFACTS_DIR,
    artifact_count: artifacts.length,
    packaged_as: "TRA",
    created_at: new Date().toISOString(),
    note: "Auto-packaged due to multiple outputs",
    ...options.metadata,
  };

  // 寫入 manifest.json
  const manifestPath = join(targetDir, TRA_STRUCTURE.MANIFEST_FILE);
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");

  return {
    success: true,
    previewFile: previewPath,
    artifactsDir: artifactsDir,
    manifestPath: manifestPath,
    artifactCount: artifacts.length,
    manifest: manifest,
  };
}

/**
 * 封裝成 .TRA 檔案
 *
 * .TRA 內含：
 * - preview 檔案
 * - artifacts/ 整個資料夾
 * - manifest.json
 */
export async function createTRAPackage(
  sourceDir: string,
  outputPath: string,
  options: TRAPackageOptions,
): Promise<string> {
  // 確保輸出路徑有 .tra 副檔名
  const traPath = outputPath.endsWith(TRA_EXTENSION) ? outputPath : `${outputPath}${TRA_EXTENSION}`;

  // 確保輸出目錄存在
  const outputDir = dirname(traPath);
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  // 先建立標準輸出結構
  const tempDir = join(dirname(sourceDir), `_tra_temp_${options.jobId}`);
  const result = await createStandardOutputStructure(sourceDir, tempDir, options);

  try {
    // 取得要封裝的檔案列表
    const files = readdirSync(tempDir);

    // 建立 .tra 檔案（使用 tar 格式，無壓縮）
    await tar.create(
      {
        file: traPath,
        cwd: tempDir,
        gzip: false,
      },
      files,
    );

    console.log(`[TRA] Created package: ${traPath}`);
    console.log(`[TRA] Contains ${result.artifactCount} artifacts`);

    return traPath;
  } finally {
    // 清理暫存目錄
    // removeDir(tempDir); // 可選：保留用於除錯
  }
}

/**
 * 自動處理多輸出封裝
 *
 * 這是 ConvertX-CN 的核心治理函數
 * 所有轉換器應在完成後呼叫此函數
 */
export async function autoPackageMultiOutput(
  outputDir: string,
  options: TRAPackageOptions,
): Promise<{ packagePath: string; manifest: TRAManifest } | null> {
  const { isMulti, reason, fileCount } = isMultiOutputTask(outputDir, options.outputFormat);

  if (!isMulti) {
    console.log(`[TRA] Single output detected (${fileCount} files), no packaging needed`);
    return null;
  }

  console.log(`[TRA] Multi-output detected: ${reason}`);
  console.log(`[TRA] Starting TRA packaging for job: ${options.jobId}`);

  const traFileName = `${options.jobId}${TRA_EXTENSION}`;
  const traPath = join(dirname(outputDir), traFileName);

  await createTRAPackage(outputDir, traPath, options);

  // 讀取 manifest
  const manifestPath = join(outputDir, TRA_STRUCTURE.MANIFEST_FILE);
  const manifest = existsSync(manifestPath)
    ? (JSON.parse(readFileSync(manifestPath, "utf-8")) as TRAManifest)
    : ({
        platform: "ConvertX-CN",
        task_type: "multi-output",
        job_id: options.jobId,
        artifact_count: fileCount,
        packaged_as: "TRA",
      } as TRAManifest);

  return {
    packagePath: traPath,
    manifest: manifest,
  };
}
