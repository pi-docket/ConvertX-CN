/**
 * llama.cpp Server 依賴檢查與狀態偵測模組
 *
 * 在啟動 llama-server 前檢查所有必要條件，
 * 避免因 shared library 缺失而崩潰。
 */

import { exec } from "node:child_process";
import { existsSync, accessSync, constants } from "node:fs";
import { promisify } from "node:util";

const execAsync = promisify(exec);

// ==============================================================================
// 類型定義
// ==============================================================================

export interface LlamaServerDependency {
  name: string;
  path: string;
  found: boolean;
  reason?: string;
}

export interface LlamaServerCheckResult {
  available: boolean;
  executable: string | null;
  executableExists: boolean;
  isExecutable: boolean;
  missingLibraries: string[];
  allDependencies: LlamaServerDependency[];
  errorReason?: string;
  suggestion?: string;
}

export interface VlmServerStatus {
  status: "available" | "unavailable" | "degraded";
  mode: "vlm-http-client" | "pipeline";
  reason?: string;
  suggestion?: string;
}

// ==============================================================================
// 常量
// ==============================================================================

/** llama-server 可能的安裝路徑 */
const LLAMA_SERVER_PATHS = [
  "/usr/local/bin/llama-server",
  "/usr/bin/llama-server",
  "/opt/convertx/bin/llama-server",
  process.env.LLAMA_SERVER_PATH,
].filter(Boolean) as string[];

/** 已知的必要 shared libraries */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const KNOWN_DEPENDENCIES = [
  "libmtmd.so", // llama.cpp multimodal library
  "libggml.so", // GGML core library
  "libllama.so", // LLaMA library
  "libcurl.so", // HTTP client (optional)
];

/** 關鍵的必要 libraries（缺失會導致無法啟動） */
const CRITICAL_DEPENDENCIES = [
  "libmtmd.so", // multimodal 必須有
];

// ==============================================================================
// 依賴檢查函數
// ==============================================================================

/**
 * 尋找 llama-server 執行檔
 */
export function findLlamaServer(): string | null {
  // 優先使用環境變數指定的路徑
  if (process.env.LLAMA_SERVER_PATH && existsSync(process.env.LLAMA_SERVER_PATH)) {
    return process.env.LLAMA_SERVER_PATH;
  }

  // 檢查預設路徑
  for (const path of LLAMA_SERVER_PATHS) {
    if (existsSync(path)) {
      return path;
    }
  }

  // 嘗試使用 which 命令
  try {
    const result = Bun.spawnSync(["which", "llama-server"]);
    const output = result.stdout.toString().trim();
    if (output && existsSync(output)) {
      return output;
    }
  } catch {
    // which 失敗
  }

  return null;
}

/**
 * 檢查檔案是否可執行
 */
export function isExecutable(path: string): boolean {
  try {
    accessSync(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * 使用 ldd 檢查動態連結依賴
 * 回傳缺失的 library 列表
 */
export async function checkSharedLibraries(executablePath: string): Promise<{
  missing: string[];
  all: LlamaServerDependency[];
}> {
  const missing: string[] = [];
  const all: LlamaServerDependency[] = [];

  try {
    const { stdout, stderr } = await execAsync(`ldd "${executablePath}" 2>&1`);
    const output = stdout + stderr;

    // 解析 ldd 輸出
    const lines = output.split("\n");
    for (const line of lines) {
      // 格式：libname.so.x => /path/to/lib (0x...)
      // 或：libname.so.x => not found
      const notFoundMatch = line.match(/^\s*(\S+)\s+=>\s+not found/);
      if (notFoundMatch && notFoundMatch[1]) {
        const libName = notFoundMatch[1];
        missing.push(libName);
        all.push({
          name: libName,
          path: "",
          found: false,
          reason: "not found",
        });
        continue;
      }

      const foundMatch = line.match(/^\s*(\S+)\s+=>\s+(\S+)\s+\(/);
      if (foundMatch && foundMatch[1] && foundMatch[2]) {
        all.push({
          name: foundMatch[1],
          path: foundMatch[2],
          found: true,
        });
      }
    }

    return { missing, all };
  } catch (error) {
    // ldd 執行失敗（可能在 Windows 或其他平台）
    console.warn("[LlamaCheck] ldd 執行失敗:", error);
    return { missing: [], all: [] };
  }
}

/**
 * 嘗試直接執行 llama-server 取得版本（驗證是否可運行）
 */
export async function verifyLlamaServerExecutable(path: string): Promise<{
  canRun: boolean;
  version?: string;
  error?: string;
}> {
  try {
    const { stdout, stderr } = await execAsync(`"${path}" --version`, {
      timeout: 5000,
    });
    const output = stdout || stderr;
    const versionLine = output.trim().split("\n")[0];
    if (versionLine) {
      return {
        canRun: true,
        version: versionLine,
      };
    }
    return {
      canRun: true,
    };
  } catch (error: unknown) {
    const err = error as { message?: string; stderr?: string };
    // 分析錯誤類型
    const errorMessage = err.message || err.stderr || String(error);

    if (errorMessage.includes("cannot open shared object file")) {
      // 提取缺失的 library 名稱
      const match = errorMessage.match(/error while loading shared libraries: (\S+)/);
      const missingLib = match ? match[1] : "unknown library";
      return {
        canRun: false,
        error: `缺少動態連結庫: ${missingLib}`,
      };
    }

    return {
      canRun: false,
      error: errorMessage,
    };
  }
}

// ==============================================================================
// 主要檢查函數
// ==============================================================================

/**
 * 完整檢查 llama-server 是否可用
 */
export async function checkLlamaServerAvailability(): Promise<LlamaServerCheckResult> {
  const result: LlamaServerCheckResult = {
    available: false,
    executable: null,
    executableExists: false,
    isExecutable: false,
    missingLibraries: [],
    allDependencies: [],
  };

  // Step 1: 尋找執行檔
  const execPath = findLlamaServer();
  result.executable = execPath;

  if (!execPath) {
    result.errorReason = "llama-server 執行檔不存在";
    result.suggestion = "請使用 Docker 環境，或從 llama.cpp 官方 Release 下載預編譯版本";
    return result;
  }

  result.executableExists = true;

  // Step 2: 檢查執行權限
  if (!isExecutable(execPath)) {
    result.errorReason = "llama-server 無執行權限";
    result.suggestion = `請執行: chmod +x ${execPath}`;
    return result;
  }

  result.isExecutable = true;

  // Step 3: 檢查動態連結依賴
  const { missing, all } = await checkSharedLibraries(execPath);
  result.missingLibraries = missing;
  result.allDependencies = all;

  if (missing.length > 0) {
    // 檢查是否有關鍵依賴缺失
    const criticalMissing = missing.filter((lib) =>
      CRITICAL_DEPENDENCIES.some((dep) => lib.includes(dep.replace(".so", ""))),
    );

    if (criticalMissing.length > 0) {
      result.errorReason = `缺少關鍵動態連結庫: ${criticalMissing.join(", ")}`;
      result.suggestion = generateSuggestionForMissingLibs(criticalMissing);
      return result;
    }
  }

  // Step 4: 嘗試實際執行
  const execResult = await verifyLlamaServerExecutable(execPath);

  if (!execResult.canRun) {
    result.errorReason = execResult.error || "無法執行 llama-server";
    result.suggestion = "建議使用 Docker 環境，確保所有依賴正確配置";
    return result;
  }

  // 全部通過
  result.available = true;
  return result;
}

/**
 * 根據缺失的 libraries 生成建議
 */
function generateSuggestionForMissingLibs(missingLibs: string[]): string {
  const suggestions: string[] = [];

  // libmtmd.so 是 llama.cpp 自己編譯產生的
  if (missingLibs.some((lib) => lib.includes("libmtmd"))) {
    suggestions.push(
      "libmtmd.so 是 llama.cpp 多模態功能的核心庫，需要與 llama-server 一起編譯",
      "",
      "🔧 解決方案（擇一）：",
      "",
      "1️⃣ 使用 Docker（推薦）：",
      "   docker pull convertx/convertx-cn:latest",
      "",
      "2️⃣ 下載完整的 llama.cpp release：",
      "   從 https://github.com/ggml-org/llama.cpp/releases 下載",
      "   確保下載包含所有 .so 檔案的版本",
      "",
      "3️⃣ 從源碼編譯 llama.cpp：",
      "   git clone https://github.com/ggml-org/llama.cpp",
      "   cd llama.cpp && cmake -B build && cmake --build build",
      "   將 build/bin/llama-server 和 build/lib/*.so 複製到系統路徑",
    );
  }

  return suggestions.join("\n");
}

// ==============================================================================
// 狀態摘要函數
// ==============================================================================

/**
 * 取得 VLM Server 狀態摘要（用於啟動時顯示）
 */
export async function getVlmServerStatus(): Promise<VlmServerStatus> {
  const checkResult = await checkLlamaServerAvailability();

  if (checkResult.available) {
    return {
      status: "available",
      mode: "vlm-http-client",
    };
  }

  // 不可用，分析原因
  const result: VlmServerStatus = {
    status: "unavailable",
    mode: "pipeline",
  };

  if (checkResult.errorReason) {
    result.reason = checkResult.errorReason;
  }
  if (checkResult.suggestion) {
    result.suggestion = checkResult.suggestion;
  }

  return result;
}

/**
 * 輸出詳細的依賴檢查報告
 */
export function printDependencyReport(result: LlamaServerCheckResult): void {
  console.log("");
  console.log("┌─────────────────────────────────────────────────────────────┐");
  console.log("│ 🔍 llama-server 依賴檢查報告                                │");
  console.log("├─────────────────────────────────────────────────────────────┤");

  // 執行檔狀態
  if (result.executable) {
    const status = result.available ? "✅" : "❌";
    console.log(`│ ${status} 執行檔: ${result.executable.padEnd(43)}│`);
  } else {
    console.log("│ ❌ 執行檔: 未找到                                           │");
  }

  // 權限狀態
  if (result.executableExists) {
    const permStatus = result.isExecutable ? "✅" : "❌";
    console.log(
      `│ ${permStatus} 執行權限: ${result.isExecutable ? "是" : "否"}                                          │`,
    );
  }

  // 缺失的 libraries
  if (result.missingLibraries.length > 0) {
    console.log("├─────────────────────────────────────────────────────────────┤");
    console.log("│ ⚠️  缺少以下動態連結庫:                                      │");
    for (const lib of result.missingLibraries) {
      console.log(`│    • ${lib.padEnd(55)}│`);
    }
  }

  // 錯誤原因
  if (result.errorReason) {
    console.log("├─────────────────────────────────────────────────────────────┤");
    console.log("│ ❌ 錯誤: " + result.errorReason.substring(0, 52).padEnd(52) + "│");
  }

  console.log("└─────────────────────────────────────────────────────────────┘");

  // 建議（在表格外顯示，因為可能很長）
  if (result.suggestion) {
    console.log("");
    console.log(result.suggestion);
  }
}
