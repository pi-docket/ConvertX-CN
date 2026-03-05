/**
 * 本地 llama.cpp 功能已移除。
 *
 * 此模組保留原有匯出介面，避免既有呼叫點中斷。
 */

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

/**
 * 完整檢查 llama-server 是否可用
 */
export async function checkLlamaServerAvailability(): Promise<LlamaServerCheckResult> {
  return {
    available: false,
    executable: null,
    executableExists: false,
    isExecutable: false,
    missingLibraries: [],
    allDependencies: [],
    errorReason: "Local llama.cpp server support has been removed.",
    suggestion: "Use pipeline mode. Online API translation will be implemented later.",
  };
}

// ==============================================================================
// 狀態摘要函數
// ==============================================================================

/**
 * 取得 VLM Server 狀態摘要（用於啟動時顯示）
 */
export async function getVlmServerStatus(): Promise<VlmServerStatus> {
  return {
    status: "unavailable",
    mode: "pipeline",
    reason: "Local llama.cpp server support has been removed.",
    suggestion: "Use pipeline mode. Online API translation will be implemented later.",
  };
}

/**
 * 輸出詳細的依賴檢查報告
 */
export function printDependencyReport(result: LlamaServerCheckResult): void {
  console.log("[LlamaCheck] disabled:", {
    available: result.available,
    reason: result.errorReason,
    suggestion: result.suggestion,
  });
}
