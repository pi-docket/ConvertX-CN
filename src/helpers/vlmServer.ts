/**
 * Local VLM server support has been removed.
 *
 * This module keeps the previous API surface so existing call sites
 * can continue to compile and safely fall back to pipeline mode.
 */

export function isVlmConfigured(): boolean {
  return false;
}

export function getVlmUrl(): string {
  return "";
}

export async function isVlmHealthy(): Promise<boolean> {
  return false;
}

export async function ensureVlmServer(): Promise<boolean> {
  return false;
}

export async function stopVlmServer(): Promise<void> {
  return;
}

export function markVlmUsed(): void {
  return;
}

export function getVlmStatus(): {
  configured: boolean;
  running: boolean;
  ready: boolean;
  starting: boolean;
  lastUsed: number;
  url: string;
} {
  return {
    configured: false,
    running: false,
    ready: false,
    starting: false,
    lastUsed: 0,
    url: "",
  };
}

export function ensureVlmServerViaScript(): Promise<boolean> {
  return Promise.resolve(false);
}
