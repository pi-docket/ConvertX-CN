/**
 * VLM Server 管理模組
 *
 * 提供按需啟動（on-demand）的 llama.cpp VLM server 管理功能
 * - 首次需要時自動啟動
 * - 閒置後自動關閉
 * - 健康檢查與錯誤恢復
 */

import { spawn, ChildProcess, exec } from "node:child_process";
import { existsSync } from "node:fs";

// VLM Server 配置
const VLM_CONFIG = {
  host: process.env.LLAMA_SERVER_HOST || "127.0.0.1",
  port: parseInt(process.env.LLAMA_SERVER_PORT || "11785", 10),
  model:
    process.env.VLM_GGUF_MODEL ||
    "/opt/convertx/models/vlm/mineru2.5-2509-1.2b/MinerU2.5-2509-1.2B.Q6_K.gguf",
  mmproj:
    process.env.VLM_GGUF_MMPROJ ||
    "/opt/convertx/models/vlm/mineru2.5-2509-1.2b/MinerU2.5-2509-1.2B.mmproj-Q8_0.gguf",
  llamaPath: process.env.LLAMA_PATH || "/usr/local/bin/llama-server",
  ctxSize: parseInt(process.env.LLAMA_CTX_SIZE || "16384", 10),
  batchSize: parseInt(process.env.LLAMA_BATCH_SIZE || "2048", 10),
  ubatchSize: parseInt(process.env.LLAMA_UBATCH_SIZE || "512", 10),
  imageMaxTokens: parseInt(process.env.LLAMA_IMAGE_MAX_TOKENS || "4096", 10),
  // 閒置超時（毫秒）- 預設 5 分鐘
  idleTimeout: parseInt(process.env.VLM_IDLE_TIMEOUT || "300000", 10),
  // 啟動超時（毫秒）- 預設 120 秒（CPU 模式較慢）
  startupTimeout: parseInt(process.env.VLM_STARTUP_TIMEOUT || "120000", 10),
};

// VLM Server 狀態
interface VlmServerState {
  process: ChildProcess | null;
  isStarting: boolean;
  isReady: boolean;
  lastUsed: number;
  startPromise: Promise<boolean> | null;
  idleTimer: ReturnType<typeof setTimeout> | null;
}

const state: VlmServerState = {
  process: null,
  isStarting: false,
  isReady: false,
  lastUsed: 0,
  startPromise: null,
  idleTimer: null,
};

/**
 * 檢查 VLM 配置是否可用（不啟動 server）
 */
export function isVlmConfigured(): boolean {
  return (
    existsSync(VLM_CONFIG.llamaPath) &&
    existsSync(VLM_CONFIG.model) &&
    existsSync(VLM_CONFIG.mmproj)
  );
}

/**
 * 取得 VLM server URL
 */
export function getVlmUrl(): string {
  return `http://${VLM_CONFIG.host}:${VLM_CONFIG.port}/v1`;
}

/**
 * 檢查 VLM server 是否正在運行且健康
 */
export async function isVlmHealthy(): Promise<boolean> {
  try {
    const response = await fetch(`http://${VLM_CONFIG.host}:${VLM_CONFIG.port}/health`, {
      method: "GET",
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * 等待 VLM server 就緒
 */
async function waitForReady(timeoutMs: number): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    if (await isVlmHealthy()) {
      return true;
    }
    // 等待 1 秒後重試
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  return false;
}

/**
 * 重置閒置計時器
 */
function resetIdleTimer(): void {
  if (state.idleTimer) {
    clearTimeout(state.idleTimer);
  }

  state.lastUsed = Date.now();

  // 設定閒置超時自動關閉
  state.idleTimer = setTimeout(() => {
    console.log(`[VLM] 閒置 ${VLM_CONFIG.idleTimeout / 1000} 秒，自動關閉 server`);
    stopVlmServer();
  }, VLM_CONFIG.idleTimeout);
}

/**
 * 啟動 VLM server（內部函數）
 */
async function startVlmServerInternal(): Promise<boolean> {
  console.log("[VLM] 啟動 llama.cpp server...");
  console.log(`[VLM]   模型: ${VLM_CONFIG.model}`);
  console.log(`[VLM]   投影器: ${VLM_CONFIG.mmproj}`);
  console.log(`[VLM]   監聽: ${VLM_CONFIG.host}:${VLM_CONFIG.port}`);
  console.log(`[VLM]   Context Size: ${VLM_CONFIG.ctxSize}`);

  const args = [
    "-m",
    VLM_CONFIG.model,
    "--mmproj",
    VLM_CONFIG.mmproj,
    "--host",
    VLM_CONFIG.host,
    "--port",
    VLM_CONFIG.port.toString(),
    "-c",
    VLM_CONFIG.ctxSize.toString(),
    "-b",
    VLM_CONFIG.batchSize.toString(),
    "-ub",
    VLM_CONFIG.ubatchSize.toString(),
    "--image-max-tokens",
    VLM_CONFIG.imageMaxTokens.toString(),
    "--flash-attn",
    "off",
    "--cache-type-k",
    "q8_0",
    "--cache-type-v",
    "q8_0",
    "-ngl",
    "0",
    "--log-disable",
  ];

  state.process = spawn(VLM_CONFIG.llamaPath, args, {
    stdio: ["ignore", "pipe", "pipe"],
    detached: false,
  });

  // 監聽輸出
  state.process.stdout?.on("data", (data) => {
    console.log(`[llama] ${data.toString().trim()}`);
  });

  state.process.stderr?.on("data", (data) => {
    console.log(`[llama] ${data.toString().trim()}`);
  });

  state.process.on("error", (error) => {
    console.error(`[VLM] llama-server 錯誤: ${error.message}`);
    state.isReady = false;
    state.process = null;
  });

  state.process.on("exit", (code, signal) => {
    console.log(`[VLM] llama-server 已退出 (code: ${code}, signal: ${signal})`);
    state.isReady = false;
    state.process = null;
  });

  // 等待就緒
  console.log(`[VLM] 等待 server 就緒 (最多 ${VLM_CONFIG.startupTimeout / 1000} 秒)...`);
  const ready = await waitForReady(VLM_CONFIG.startupTimeout);

  if (ready) {
    console.log(`[VLM] ✅ llama.cpp server 已就緒`);
    state.isReady = true;
    resetIdleTimer();
    return true;
  } else {
    console.error(`[VLM] ❌ llama.cpp server 啟動逾時`);
    // 嘗試終止進程
    if (state.process) {
      state.process.kill("SIGTERM");
      state.process = null;
    }
    return false;
  }
}

/**
 * 確保 VLM server 運行中（按需啟動）
 * 如果 server 未運行，會自動啟動
 * 多個並發調用會共享同一個啟動過程
 */
export async function ensureVlmServer(): Promise<boolean> {
  // 如果已經就緒，更新使用時間並返回
  if (state.isReady && (await isVlmHealthy())) {
    resetIdleTimer();
    return true;
  }

  // 如果正在啟動中，等待現有的啟動過程
  if (state.isStarting && state.startPromise) {
    return state.startPromise;
  }

  // 檢查配置
  if (!isVlmConfigured()) {
    console.error("[VLM] VLM 配置不可用");
    return false;
  }

  // 開始啟動
  state.isStarting = true;
  state.startPromise = startVlmServerInternal().finally(() => {
    state.isStarting = false;
    state.startPromise = null;
  });

  return state.startPromise;
}

/**
 * 停止 VLM server
 */
export async function stopVlmServer(): Promise<void> {
  // 清除閒置計時器
  if (state.idleTimer) {
    clearTimeout(state.idleTimer);
    state.idleTimer = null;
  }

  if (!state.process) {
    console.log("[VLM] Server 未運行");
    return;
  }

  console.log("[VLM] 正在停止 llama.cpp server...");

  return new Promise((resolve) => {
    const proc = state.process!;

    // 設定超時強制終止
    const forceKillTimeout = setTimeout(() => {
      console.log("[VLM] 強制終止 server");
      proc.kill("SIGKILL");
    }, 10000);

    proc.on("exit", () => {
      clearTimeout(forceKillTimeout);
      console.log("[VLM] Server 已停止");
      state.process = null;
      state.isReady = false;
      resolve();
    });

    // 優雅終止
    proc.kill("SIGTERM");
  });
}

/**
 * 標記 VLM 正在使用中，延長閒置計時器
 * 在長時間的轉換過程中應定期調用
 */
export function markVlmUsed(): void {
  if (state.isReady) {
    resetIdleTimer();
  }
}

/**
 * 取得 VLM server 狀態
 */
export function getVlmStatus(): {
  configured: boolean;
  running: boolean;
  ready: boolean;
  starting: boolean;
  lastUsed: number;
  url: string;
} {
  return {
    configured: isVlmConfigured(),
    running: state.process !== null,
    ready: state.isReady,
    starting: state.isStarting,
    lastUsed: state.lastUsed,
    url: getVlmUrl(),
  };
}

/**
 * 使用 shell 腳本管理 VLM server（備用方案）
 */
export function ensureVlmServerViaScript(): Promise<boolean> {
  return new Promise((resolve) => {
    exec("/opt/convertx/scripts/vlm-server-manager.sh ensure", (error, stdout, stderr) => {
      if (stdout) console.log(stdout);
      if (stderr) console.error(stderr);
      resolve(!error);
    });
  });
}
