import { expect, test, spyOn } from "bun:test";
import { startJobCleanup } from "../../src/helpers/jobCleanup";

test("cleanup is scheduled again after an error and the next cycle can succeed", () => {
  const errors = spyOn(console, "error").mockImplementation(() => {});
  const scheduled: Array<() => void> = [];
  let attempts = 0;
  try {
    startJobCleanup({
      intervalHours: 2,
      cleanup: () => {
        if (++attempts === 1) throw new Error("temporary database error");
      },
      schedule: (callback, delay) => {
        expect(delay).toBe(2 * 60 * 60 * 1000);
        scheduled.push(callback);
      },
    });
    expect(errors).toHaveBeenCalledTimes(1);
    expect(scheduled).toHaveLength(1);
    scheduled.shift()?.();
    expect(attempts).toBe(2);
    expect(scheduled).toHaveLength(1);
  } finally {
    errors.mockRestore();
  }
});

test("zero interval disables cleanup", () => {
  startJobCleanup({
    intervalHours: 0,
    cleanup: () => {
      throw new Error("disabled cleanup executed");
    },
    schedule: () => {
      throw new Error("disabled cleanup scheduled");
    },
  });
});
