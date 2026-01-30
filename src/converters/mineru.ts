import { execFile as execFileOriginal } from "node:child_process";
import { mkdirSync, existsSync, readdirSync, unlinkSync, rmdirSync } from "node:fs";
import { join, basename, dirname } from "node:path";
import { ExecFileFn } from "./types";
import { getArchiveFileName } from "../transfer";

export const properties = {
  from: {
    document: ["pdf", "ppt", "pptx", "xls", "xlsx", "doc", "docx"],
  },
  to: {
    document: ["md-t", "md-i"],
  },
  outputMode: "archive" as const,
};

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

export async function convert(
  filePath: string,
  fileType: string,
  convertTo: string,
  targetPath: string,
  options?: unknown,
  execFile: ExecFileFn = execFileOriginal,
): Promise<string> {
  // Create a temporary output directory for MinerU
  const outputDir = dirname(targetPath);
  const inputFileName = basename(filePath, `.${fileType}`);
  const mineruOutputDir = join(outputDir, `${inputFileName}_mineru_${convertTo}`);

  // Ensure output directory exists
  if (!existsSync(mineruOutputDir)) {
    mkdirSync(mineruOutputDir, { recursive: true });
  }

  /**
   * 執行 MinerU 並處理 vLLM 相容性問題
   * 如果 --table-mode 參數導致 vLLM 錯誤，會自動重試不帶此參數
   */
  const runMinerU = (useTableMode: boolean): Promise<void> => {
    return new Promise((resolve, reject) => {
      // Build MinerU command arguments
      // MinerU CLI: mineru -p <input> -o <output_dir> -m <method>
      // 注意：MinerU 2.7+ 版本 -m/--method 有效值為 'auto', 'txt', 'ocr'
      // - auto: 自動偵測（推薦，會根據 PDF 類型選擇最佳方法）
      // - txt: 直接提取文字（適用於有文字層的 PDF）
      // - ocr: 強制使用 OCR（適用於掃描版 PDF）
      const args = ["-p", filePath, "-o", mineruOutputDir, "-m", "auto"];

      // 表格模式支援（可能與某些 vLLM 版本不相容）
      if (useTableMode) {
        if (convertTo === "md-i") {
          args.push("--table-mode", "image");
        } else {
          args.push("--table-mode", "markdown");
        }
      }

      console.log(`[MinerU] Running: mineru ${args.join(" ")}`);

      execFile("mineru", args, (error, stdout, stderr) => {
        if (stdout) {
          console.log(`mineru stdout: ${stdout}`);
        }

        if (stderr) {
          console.error(`mineru stderr: ${stderr}`);
        }

        if (error) {
          // 檢查是否為 vLLM table_mode 相容性錯誤
          const errorStr = String(error) + String(stderr);
          if (useTableMode && errorStr.includes("table_mode")) {
            console.warn(`[MinerU] ⚠️ table_mode 與 vLLM 不相容，重試不帶此參數...`);
            reject(new Error("RETRY_WITHOUT_TABLE_MODE"));
          } else if (errorStr.includes("vlm") && errorStr.includes("not configured")) {
            // VLM 模型路徑未配置錯誤
            console.error(`[MinerU] ❌ VLM 模型路徑未配置`);
            console.error(`[MinerU] 💡 使用 -m txt 或 -m ocr 模式避免 VLM 需求`);
            console.error(`[MinerU] 💡 或配置 mineru.json 中的 vlm 路徑`);
            reject(
              new Error(
                "MINERU_VLM_ERROR: VLM 模型未配置。請使用 txt/ocr 模式或配置 VLM 模型路徑。",
              ),
            );
          } else if (errorStr.includes("torch") || errorStr.includes("NameError")) {
            // PyTorch 未安裝或版本不兼容錯誤
            console.error(`[MinerU] ❌ PyTorch 未安裝或版本不相容`);
            console.error(`[MinerU] 💡 請確保 Docker Image 中已安裝 PyTorch`);
            console.error(`[MinerU] 💡 對於 GPU 加速，請使用 Dockerfile.full 並啟用 PyTorch CUDA`);
            reject(
              new Error(
                "MINERU_PYTORCH_ERROR: PyTorch 未正確安裝，請重新 build Docker Image 或使用 Dockerfile.full",
              ),
            );
          } else {
            reject(new Error(`mineru error: ${error}`));
          }
          return;
        }

        resolve();
      });
    });
  };

  // 嘗試執行 MinerU（自動處理 vLLM 相容性）
  try {
    await runMinerU(true);
  } catch (error) {
    if (error instanceof Error && error.message === "RETRY_WITHOUT_TABLE_MODE") {
      // 清理輸出目錄並重試
      removeDir(mineruOutputDir);
      mkdirSync(mineruOutputDir, { recursive: true });
      await runMinerU(false);
    } else {
      throw error;
    }
  }

  // 建立 .tar 封裝
  try {
    // MinerU outputs to a subdirectory, find the actual output
    const mineruActualOutput = join(mineruOutputDir, "auto");

    // Create .tar archive from the output directory (不使用壓縮)
    // 強制使用 .tar 格式，禁止 .tar.gz
    const tarPath = getArchiveFileName(targetPath);
    console.log(`[MinerU] Target tar path: ${tarPath}`);

    // Ensure the parent directory exists
    const tarDir = dirname(tarPath);
    if (!existsSync(tarDir)) {
      mkdirSync(tarDir, { recursive: true });
    }

    // Use the actual MinerU output directory for archiving
    // MinerU 產生完整資料夾結構，全部封裝進 .tar
    const outputToArchive = existsSync(mineruActualOutput) ? mineruActualOutput : mineruOutputDir;

    console.log(`[MinerU] Archiving directory: ${outputToArchive}`);

    // 列出要封裝的內容
    if (existsSync(outputToArchive)) {
      const contents = readdirSync(outputToArchive);
      console.log(`[MinerU] Archive contents: ${contents.join(", ")}`);
    }

    await createTarArchive(outputToArchive, tarPath, execFile);
    console.log(`[MinerU] Created archive: ${tarPath}`);

    // Clean up the temporary directory
    removeDir(mineruOutputDir);

    return "Done";
  } catch (tarError) {
    throw new Error(`Failed to create .tar archive: ${tarError}`);
  }
}
