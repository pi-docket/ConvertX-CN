/**
 * 處理模式配置管理（pipeline-only）
 *
 * 本地 VLM / llama.cpp 功能已移除，
 * 系統統一使用 pipeline 模式。
 */

export type ProcessingMode = "pipeline" | "vlm";

export const DEFAULT_PROCESSING_MODE: ProcessingMode = "pipeline";

export function getConfiguredProcessingMode(): ProcessingMode {
  return "pipeline";
}

export function getUserProcessingMode(_userId: number): ProcessingMode {
  return "pipeline";
}

export function setUserProcessingMode(_userId: number, _mode: ProcessingMode): boolean {
  console.warn("[CONFIG] setUserProcessingMode is deprecated. Mode is now pipeline-only.");
  return false;
}

export async function checkVlmAvailability(): Promise<{
  available: boolean;
  fallback: boolean;
  reason:
    | "available"
    | "server_unreachable"
    | "not_installed"
    | "model_missing"
    | "fallback_active"
    | "on_demand_available"
    | "forced_fallback";
  message: string;
}> {
  return {
    available: false,
    fallback: true,
    reason: "fallback_active",
    message: "Local VLM support has been removed. Using pipeline mode.",
  };
}

export async function ensureVlmAvailability(): Promise<{
  available: boolean;
  fallback: boolean;
  reason: string;
  message: string;
}> {
  return {
    available: false,
    fallback: true,
    reason: "fallback_active",
    message: "Local VLM support has been removed. Using pipeline mode.",
  };
}

export function reportVlmError(error: string): void {
  console.warn(`[VLM] Ignored error in pipeline-only mode: ${error}`);
}

export function resetVlmFallback(): void {
  return;
}

export async function getEffectiveProcessingMode(
  _userId?: number,
): Promise<{ mode: ProcessingMode; isAutoFallback: boolean; reason?: string }> {
  return {
    mode: "pipeline",
    isAutoFallback: true,
    reason: "Local VLM support has been removed.",
  };
}

export async function executeWithFallback<T>(
  task: () => Promise<T>,
  fallbackTask: () => Promise<T>,
): Promise<{ result: T; usedFallback: boolean }> {
  void task;
  const result = await fallbackTask();
  return { result, usedFallback: true };
}
