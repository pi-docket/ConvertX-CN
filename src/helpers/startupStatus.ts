/**
 * 啟動狀態偵測與顯示模組
 *
 * 動態偵測並顯示實際運行中的服務與 Port，
 * 而不是顯示寫死的預設值。
 */

import * as net from "node:net";
import { WEBROOT } from "./env";
import { checkLlamaServerAvailability, type LlamaServerCheckResult } from "./llamaServerCheck";

// ==============================================================================
// 環境變數
// ==============================================================================

/** Web UI Port（從環境變數或預設 3000） */
export const WEB_PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

/** API Server Port（從環境變數或預設 7890） */
export const RAS_API_PORT = process.env.RAS_API_PORT ? Number(process.env.RAS_API_PORT) : 7890;

/** LLM Server URL（從環境變數或預設 http://127.0.0.1:11785） */
export const LLAMA_SERVER_URL = process.env.LLAMA_SERVER_URL || "http://127.0.0.1:11785";

/** API Server Host（從環境變數或預設 0.0.0.0） */
export const RAS_API_HOST = process.env.RAS_API_HOST || "0.0.0.0";

// ==============================================================================
// 服務狀態類型
// ==============================================================================

export interface ServiceStatus {
  name: string;
  icon: string;
  status: "running" | "stopped" | "unknown";
  url?: string;
  message?: string;
}

// ==============================================================================
// 健康檢查函數
// ==============================================================================

/**
 * 檢查 HTTP 服務是否可用
 */
async function checkHttpHealth(url: string, timeoutMs = 3000): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * 檢查 TCP Port 是否開啟
 */
async function checkPortOpen(host: string, port: number, timeoutMs = 2000): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();

    const timer = setTimeout(() => {
      socket.destroy();
      resolve(false);
    }, timeoutMs);

    socket.on("connect", () => {
      clearTimeout(timer);
      socket.destroy();
      resolve(true);
    });

    socket.on("error", () => {
      clearTimeout(timer);
      socket.destroy();
      resolve(false);
    });

    socket.connect(port, host);
  });
}

// ==============================================================================
// 服務偵測函數
// ==============================================================================

/** 快取的 llama server 檢查結果 */
let cachedLlamaCheckResult: LlamaServerCheckResult | null = null;

/**
 * 偵測 LLM Server 狀態（包含依賴檢查）
 */
export async function detectLlmServerStatus(): Promise<
  ServiceStatus & { checkResult?: LlamaServerCheckResult }
> {
  const url = LLAMA_SERVER_URL;
  const healthUrl = `${url}/health`;

  // 首先檢查服務是否在運行
  try {
    const isHealthy = await checkHttpHealth(healthUrl);

    if (isHealthy) {
      return {
        name: "LLM Server",
        icon: "🧠",
        status: "running",
        url,
      };
    }

    // 如果 /health 不回應，嘗試檢查 port 是否開啟
    const urlObj = new URL(url);
    const port = Number(urlObj.port) || 80;
    const host = urlObj.hostname;

    const isPortOpen = await checkPortOpen(host, port);

    if (isPortOpen) {
      return {
        name: "LLM Server",
        icon: "🧠",
        status: "running",
        url,
        message: "port open, health check failed",
      };
    }
  } catch {
    // 連線失敗
  }

  // 服務未運行，檢查是否可以啟動（只在 Linux 環境執行）
  if (process.platform === "linux") {
    try {
      // 使用快取或執行新檢查
      if (!cachedLlamaCheckResult) {
        cachedLlamaCheckResult = await checkLlamaServerAvailability();
      }
      const checkResult = cachedLlamaCheckResult;

      if (!checkResult.available) {
        // 依賴檢查失敗
        let message = "未啟動";

        if (checkResult.missingLibraries.length > 0) {
          message = `缺少動態庫: ${checkResult.missingLibraries.slice(0, 2).join(", ")}`;
        } else if (checkResult.errorReason) {
          message = checkResult.errorReason.substring(0, 30);
        }

        return {
          name: "LLM Server",
          icon: "🧠",
          status: "stopped",
          message,
          checkResult,
        };
      }
    } catch {
      // 依賴檢查失敗
    }
  }

  return {
    name: "LLM Server",
    icon: "🧠",
    status: "stopped",
    message: "未啟動",
  };
}

/**
 * 偵測 API Server 狀態（RAS API）
 */
export async function detectApiServerStatus(): Promise<ServiceStatus> {
  const port = RAS_API_PORT;
  const host = RAS_API_HOST === "0.0.0.0" ? "127.0.0.1" : RAS_API_HOST;
  const url = `http://${host}:${port}`;

  // 檢查是否有設定 API Server
  const apiServerEnabled =
    process.env.RAS_API_PORT !== undefined || process.env.ENABLE_RAS_API === "true";

  try {
    // 嘗試檢查 port
    const isPortOpen = await checkPortOpen(host, port);

    if (isPortOpen) {
      return {
        name: "API Server",
        icon: "🔌",
        status: "running",
        url,
      };
    }

    // Port 未開啟
    if (apiServerEnabled) {
      return {
        name: "API Server",
        icon: "🔌",
        status: "stopped",
        message: "已設定但未啟動",
      };
    }

    return {
      name: "API Server",
      icon: "🔌",
      status: "stopped",
      message: "未啟動（獨立部署）",
    };
  } catch {
    return {
      name: "API Server",
      icon: "🔌",
      status: "stopped",
      message: "未啟動",
    };
  }
}

/**
 * 獲取 Web UI 狀態（從 Elysia server 實例取得實際 port）
 */
export function getWebUIStatus(
  server: { hostname?: string | null | undefined; port: number } | null,
): ServiceStatus {
  if (!server) {
    return {
      name: "Web UI",
      icon: "🌐",
      status: "stopped",
      message: "未啟動",
    };
  }

  const hostname = server.hostname || "localhost";
  const port = server.port;
  const webroot = WEBROOT || "";
  const url = `http://${hostname === "0.0.0.0" ? "localhost" : hostname}:${port}${webroot}`;

  return {
    name: "Web UI",
    icon: "🌐",
    status: "running",
    url,
  };
}

// ==============================================================================
// 格式化輸出函數
// ==============================================================================

/**
 * 格式化單個服務狀態行
 */
function formatServiceLine(service: ServiceStatus): string {
  const label = `${service.icon} ${service.name}`.padEnd(15);

  if (service.status === "running" && service.url) {
    return `│ ${label}: ${service.url}`;
  }

  const message = service.message || "未啟動";
  return `│ ${label}: ${message}`;
}

/**
 * 計算最長行的長度
 */
function getMaxLineLength(lines: string[]): number {
  return Math.max(...lines.map((line) => line.length));
}

/**
 * 輸出啟動摘要（表格格式）
 */
export async function printStartupSummary(
  server: { hostname?: string | null | undefined; port: number } | null,
): Promise<void> {
  // 收集所有服務狀態
  const webUI = getWebUIStatus(server);
  const [apiServer, llmServer] = await Promise.all([
    detectApiServerStatus(),
    detectLlmServerStatus(),
  ]);

  // 構建表格內容
  const lines = [
    formatServiceLine(webUI),
    formatServiceLine(apiServer),
    formatServiceLine(llmServer),
  ];

  // 計算邊框寬度
  const maxLen = Math.max(getMaxLineLength(lines), 40);
  const topBorder = `┌${"─".repeat(maxLen)}┐`;
  const bottomBorder = `└${"─".repeat(maxLen)}┘`;

  // 填充每行到相同寬度
  const paddedLines = lines.map((line) => {
    const padding = maxLen - line.length;
    return `${line}${" ".repeat(padding)}│`;
  });

  // 輸出表格
  console.log("");
  console.log(topBorder);
  for (const line of paddedLines) {
    console.log(line);
  }
  console.log(bottomBorder);

  // 輸出額外提示
  printAdditionalInfo(apiServer, llmServer);
}

/**
 * 輸出額外資訊提示
 */
function printAdditionalInfo(
  apiServer: ServiceStatus,
  llmServer: ServiceStatus & { checkResult?: LlamaServerCheckResult },
): void {
  console.log("");

  // API Server 提示
  if (apiServer.status === "stopped") {
    if (process.env.RAS_API_PORT || process.env.ENABLE_RAS_API === "true") {
      console.log("⚠️  API Server 已設定但未偵測到運行中的服務");
      console.log("   提示：API Server 需獨立部署，請參考 api-server/ 目錄");
    } else {
      console.log("ℹ️  API Server 為獨立服務，需另行部署（詳見 api-server/）");
    }
  }

  // LLM Server 提示（增強版）
  if (llmServer.status === "stopped") {
    const checkResult = llmServer.checkResult;

    if (checkResult && checkResult.missingLibraries.length > 0) {
      // 有缺失的動態庫
      console.log("⚠️  LLM Server 無法啟動（缺少動態連結庫）");
      console.log(`   缺失: ${checkResult.missingLibraries.join(", ")}`);
      console.log("");
      console.log("   💡 解決方案：");
      console.log("      • 使用 Docker 環境（推薦）");
      console.log("      • 或從 llama.cpp 官方 Release 下載完整版本");
      console.log("");
      console.log("   📊 目前模式: pipeline（功能正常，但無本地 VLM）");
    } else if (checkResult && !checkResult.executableExists) {
      // 執行檔不存在
      console.log("ℹ️  LLM Server 未安裝（llama-server 不存在）");
      console.log("   提示：Docker 環境會自動包含 llama.cpp server");
    } else if (process.env.SKIP_LLAMA_SERVER !== "1") {
      // 一般未啟動
      console.log("ℹ️  LLM Server 未啟動（本地翻譯功能將無法使用）");
      console.log("   提示：Docker 環境會自動啟動 llama.cpp server");
    }
  }

  console.log("");
}

/**
 * 簡易啟動訊息（向後相容）
 */
export function printSimpleStartup(
  server: { hostname?: string | null | undefined; port: number } | null,
): void {
  if (!server) {
    console.log("❌ Server failed to start");
    return;
  }

  const hostname = server.hostname || "localhost";
  const port = server.port;
  const webroot = WEBROOT || "";
  const displayHost = hostname === "0.0.0.0" ? "localhost" : hostname;

  console.log(`🦊 Elysia is running at http://${displayHost}:${port}${webroot}`);
}

// ==============================================================================
// 導出主函數
// ==============================================================================

export interface StartupDisplayOptions {
  /** 使用詳細表格格式（預設：production 環境） */
  verbose?: boolean;
  /** 顯示服務狀態偵測結果 */
  showStatus?: boolean;
}

/**
 * 顯示啟動資訊
 *
 * @param server - Elysia server 實例
 * @param options - 顯示選項
 */
export async function displayStartupInfo(
  server: { hostname?: string | null | undefined; port: number } | null,
  options: StartupDisplayOptions = {},
): Promise<void> {
  const isProduction = process.env.NODE_ENV === "production";
  const verbose = options.verbose ?? isProduction;
  const showStatus = options.showStatus ?? true;

  // 總是顯示基本啟動訊息
  printSimpleStartup(server);

  // 在 production 環境或明確指定時顯示詳細狀態
  if (showStatus && verbose) {
    await printStartupSummary(server);
  }
}
