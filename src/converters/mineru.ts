import { execFile as execFileOriginal } from "node:child_process";
import { mkdirSync, existsSync, readdirSync, unlinkSync, rmdirSync } from "node:fs";
import { join, basename, dirname } from "node:path";
import { ExecFileFn } from "./types";
import { getArchiveFileName } from "../transfer";
import {
  getEffectiveProcessingMode,
  setUserProcessingMode,
  type ProcessingMode,
} from "../helpers/processingMode";
import { ensureVlmServer, getVlmUrl, isVlmConfigured, markVlmUsed } from "../helpers/vlmServer";

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
  // 從 options 中提取 userId
  const userId =
    options && typeof options === "object" && "userId" in options
      ? (options as { userId?: number }).userId
      : undefined;

  // 取得使用者的處理模式設定
  let userProcessingMode: ProcessingMode = "pipeline";
  if (userId !== undefined) {
    const effectiveMode = await getEffectiveProcessingMode(userId);
    userProcessingMode = effectiveMode.mode;
    console.log(
      `[MinerU] User ${userId} processing mode: ${userProcessingMode} (fallback: ${effectiveMode.isAutoFallback})`,
    );
  }

  // Create a temporary output directory for MinerU
  const outputDir = dirname(targetPath);
  const inputFileName = basename(filePath, `.${fileType}`);
  const mineruOutputDir = join(outputDir, `${inputFileName}_mineru_${convertTo}`);

  // Ensure output directory exists
  if (!existsSync(mineruOutputDir)) {
    mkdirSync(mineruOutputDir, { recursive: true });
  }

  // ===========================================================================
  // MinerU CLI 參數說明
  // ===========================================================================
  // -p <input>       : 輸入檔案路徑
  // -o <output_dir>  : 輸出目錄
  // -m <method>      : 解析方法 (auto/txt/ocr)
  // -b <backend>     : 後端選擇
  // -u <url>         : VLM server URL (用於 http-client 模式)
  //
  // 📌 後端選項：
  //   - pipeline:           純 OCR 模式，使用 PDF-Extract-Kit-1.0
  //   - vlm-http-client:    連接外部 VLM server（如 llama.cpp）
  //   - hybrid-http-client: 混合模式 + 外部 VLM server
  //   - vlm-auto-engine:    本地 transformers VLM（需要大量資源）
  //   - hybrid-auto-engine: 混合模式 + 本地 VLM（預設，但需要模型）
  //
  // 💡 GGUF VLM 架構：
  //   - llama.cpp server 載入 GGUF 模型
  //   - MinerU 使用 vlm-http-client 連接
  //   - 不需要 transformers 直接載入模型
  //
  // ===========================================================================

  // 後端選擇邏輯（優先順序）：
  // 1. forceBackend 參數（VLM 失敗回退時使用）
  // 2. 環境變數 MINERU_BACKEND（全局覆蓋）
  // 3. 使用者設定的處理模式（userProcessingMode）
  // 4. 預設 pipeline（純 OCR，最穩定）
  const vlmServerUrl = process.env.MINERU_VLM_URL || getVlmUrl();

  // 決定初始後端 - 移到函數外部以便追蹤
  let initialBackend: string;
  if (process.env.MINERU_BACKEND) {
    initialBackend = process.env.MINERU_BACKEND;
  } else if (userProcessingMode === "vlm") {
    // 使用者選擇 VLM 模式，檢查配置是否可用
    if (isVlmConfigured()) {
      initialBackend = "vlm-http-client";
    } else {
      console.warn(`[MinerU] ⚠️ VLM 配置不可用，回退到 Pipeline 模式`);
      initialBackend = "pipeline";
    }
  } else {
    initialBackend = "pipeline";
  }

  // 追蹤是否使用 VLM 模式（用於判斷是否需要回退）
  const isVlmBackend = (backend: string) => backend.includes("vlm");
  let actualBackendUsed = initialBackend;

  // 如果需要使用 VLM，按需啟動 VLM server
  if (isVlmBackend(initialBackend)) {
    console.log(`[MinerU] 檢查 VLM server 狀態...`);
    const vlmReady = await ensureVlmServer();
    if (!vlmReady) {
      console.warn(`[MinerU] ⚠️ VLM server 啟動失敗，回退到 Pipeline 模式`);
      initialBackend = "pipeline";
    } else {
      console.log(`[MinerU] ✅ VLM server 已就緒`);
    }
  }

  /**
   * 執行 MinerU 並處理 vLLM 相容性問題
   * 如果 --table-mode 參數導致 vLLM 錯誤，會自動重試不帶此參數
   * @param useTableMode 是否使用 table-mode 參數
   * @param forceBackend 強制使用的後端（用於 VLM 失敗時回退）
   */
  const runMinerU = (useTableMode: boolean, forceBackend?: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      let backend: string;

      if (forceBackend) {
        backend = forceBackend;
        console.log(`[MinerU] 強制使用後端: ${backend}`);
      } else {
        backend = initialBackend;
        if (process.env.MINERU_BACKEND) {
          console.log(`[MinerU] 使用環境變數後端: ${backend}`);
        } else if (userProcessingMode === "vlm" && isVlmBackend(backend)) {
          console.log(`[MinerU] 使用者選擇 VLM 模式`);
        } else {
          console.log(`[MinerU] 使用 Pipeline 模式`);
        }
      }

      // 更新實際使用的後端
      actualBackendUsed = backend;

      const args = ["-p", filePath, "-o", mineruOutputDir, "-m", "auto", "-b", backend];

      // 如果使用 http-client 後端，添加 server URL
      if (backend.endsWith("-http-client") && vlmServerUrl) {
        args.push("-u", vlmServerUrl);
        console.log(`[MinerU] 使用 VLM server: ${vlmServerUrl}`);
      }

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
          } else if (
            backend.includes("vlm") &&
            (errorStr.includes("ServerError") ||
              errorStr.includes("status code") ||
              errorStr.includes("500") ||
              errorStr.includes("failed to process") ||
              errorStr.includes("server_error") ||
              errorStr.includes("unreachable") ||
              errorStr.includes("Connection refused"))
          ) {
            // VLM server 錯誤（500、連接失敗等），需要回退到 pipeline
            console.warn(`[MinerU] ⚠️ VLM server 錯誤，自動回退到 Pipeline 模式`);
            console.warn(`[MinerU] 錯誤詳情: ${errorStr.substring(0, 500)}`);
            reject(new Error("VLM_SERVER_ERROR_FALLBACK"));
          } else if (errorStr.includes("vlm") && errorStr.includes("not configured")) {
            // VLM 模型路徑未配置錯誤
            console.error(`[MinerU] ❌ VLM 模型路徑未配置`);
            console.error(`[MinerU] 💡 使用 -m txt 或 -m ocr 模式避免 VLM 需求`);
            console.error(`[MinerU] 💡 或配置 mineru.json 中的 vlm 路徑`);
            reject(new Error("VLM_SERVER_ERROR_FALLBACK"));
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

  // 記錄是否使用了 VLM 模式（根據實際使用的後端判斷，不只是使用者設定）
  // 這樣即使環境變數設定了 VLM 模式，也能正確回退
  let usedFallback = false;

  // 嘗試執行 MinerU（自動處理 vLLM 相容性和 VLM 錯誤回退）
  try {
    await runMinerU(true);
  } catch (error) {
    if (error instanceof Error && error.message === "RETRY_WITHOUT_TABLE_MODE") {
      // 清理輸出目錄並重試（不帶 table-mode）
      removeDir(mineruOutputDir);
      mkdirSync(mineruOutputDir, { recursive: true });
      try {
        await runMinerU(false);
      } catch (retryError) {
        // 再次失敗，檢查是否需要 VLM 回退
        if (
          retryError instanceof Error &&
          retryError.message === "VLM_SERVER_ERROR_FALLBACK" &&
          isVlmBackend(actualBackendUsed)
        ) {
          console.warn(
            `[MinerU] ⚠️ VLM 模式失敗（後端: ${actualBackendUsed}），自動切換到 Pipeline 模式重試...`,
          );
          removeDir(mineruOutputDir);
          mkdirSync(mineruOutputDir, { recursive: true });
          await runMinerU(false, "pipeline");
          usedFallback = true;
        } else {
          throw retryError;
        }
      }
    } else if (
      error instanceof Error &&
      error.message === "VLM_SERVER_ERROR_FALLBACK" &&
      isVlmBackend(actualBackendUsed)
    ) {
      // VLM server 錯誤，自動回退到 pipeline 模式
      console.warn(
        `[MinerU] ⚠️ VLM 模式失敗（後端: ${actualBackendUsed}），自動切換到 Pipeline 模式重試...`,
      );
      removeDir(mineruOutputDir);
      mkdirSync(mineruOutputDir, { recursive: true });
      await runMinerU(true, "pipeline");
      usedFallback = true;
    } else {
      throw error;
    }
  }

  // 如果使用了回退，更新使用者設定（這樣下次就會直接使用 pipeline）
  if (usedFallback && userId !== undefined) {
    console.log(`[MinerU] 自動將使用者 ${userId} 的處理模式切換為 Pipeline（因 VLM 不可用）`);
    setUserProcessingMode(userId, "pipeline");
  }

  // 標記 VLM 正在使用中，防止閒置超時（長時間轉換時）
  if (isVlmBackend(actualBackendUsed) && !usedFallback) {
    markVlmUsed();
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
