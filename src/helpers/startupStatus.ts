/**
 * 啟動狀態偵測與顯示模組
 *
 * 動態偵測並顯示實際運行中的服務與 Port，
 * 而不是顯示寫死的預設值。
 */

import * as net from "node:net";
import { WEBROOT } from "./env";
import type { LlamaServerCheckResult } from "./llamaServerCheck";

// ==============================================================================
// 環境變數
// ==============================================================================

/** Web UI Port（從環境變數或預設 3000） */
export const WEB_PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

/** API Server Port（從環境變數或預設 7890） */
export const RAS_API_PORT = process.env.RAS_API_PORT ? Number(process.env.RAS_API_PORT) : 7890;

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

/**
 * 偵測 LLM Server 狀態（包含依賴檢查）
 */
export async function detectLlmServerStatus(): Promise<
  ServiceStatus & { checkResult?: LlamaServerCheckResult }
> {
  return {
    name: "LLM Server",
    icon: "🧠",
    status: "stopped",
    message: "已移除（placeholder）",
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
    void llmServer;
    console.log("ℹ️  本地 LLM / llama.cpp 功能已移除");
    console.log("   目前維持 pipeline 模式運行");
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
