/** Keep scheduled cleanup running after a transient database or filesystem error. */
export function startJobCleanup({
  intervalHours,
  cleanup,
  schedule = setTimeout,
}: {
  intervalHours: number;
  cleanup: () => void;
  schedule?: (callback: () => void, delay: number) => unknown;
}): void {
  if (!Number.isFinite(intervalHours) || intervalHours <= 0) return;
  const tick = () => {
    try {
      cleanup();
    } catch (error) {
      console.error("[Cleanup] Failed to clear expired jobs", error);
    } finally {
      schedule(tick, intervalHours * 60 * 60 * 1000);
    }
  };
  tick();
}
