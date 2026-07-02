import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import {
  UploadServiceError,
  validateFileName,
  validateFileSize,
} from "../../src/application/uploadService";
import { sanitizeError } from "../../src/application/jobService";
import { csrfRequestHost, verifyCsrf } from "../../src/helpers/csrf";
import { HTTP_ALLOWED_FILE_SIZE } from "../../src/helpers/env";
import { isPathInside } from "../../src/helpers/paths";

describe("P0 path and upload validation", () => {
  test.each(["", "../secret", "..\\secret", "/tmp/file", "C:\\secret", "bad:name.pdf"])(
    "rejects unsafe file name %p",
    (name) => {
      expect(() => validateFileName(name)).toThrow(UploadServiceError);
    },
  );

  test("preserves a valid basename", () => {
    expect(validateFileName("report 2026.pdf")).toBe("report 2026.pdf");
  });

  test("enforces the configured maximum at the exact boundary", () => {
    expect(validateFileSize(HTTP_ALLOWED_FILE_SIZE)).toBe(HTTP_ALLOWED_FILE_SIZE);
    expect(() => validateFileSize(HTTP_ALLOWED_FILE_SIZE + 1)).toThrow(
      expect.objectContaining({ code: "FILE_TOO_LARGE", status: 413 }),
    );
  });

  test("contains resolved paths under their owner root", () => {
    const root = resolve("data/uploads/user/job");
    expect(isPathInside(root, resolve(root, "file.pdf"))).toBe(true);
    expect(isPathInside(root, resolve(root, "..", "other-job"))).toBe(false);
  });
});

describe("P0 error and CSRF handling", () => {
  test("removes paths and line breaks from persisted error summaries", () => {
    const summary = sanitizeError(
      new Error(
        `${process.cwd()}\\private\\file.txt\nAPI_KEY=top-secret --token abc123 Bearer eyJhbGci sk-live_12345678`,
      ),
    );
    expect(summary).not.toContain(process.cwd());
    expect(summary).not.toContain("\n");
    expect(summary).not.toContain("top-secret");
    expect(summary).not.toContain("abc123");
    expect(summary).not.toContain("eyJhbGci");
    expect(summary).not.toContain("sk-live");
    expect(summary.length).toBeLessThanOrEqual(500);
  });

  test("requires matching token and same-origin host", () => {
    const request = new Request("https://convert.example/delete/1", {
      headers: { host: "convert.example", origin: "https://convert.example" },
    });
    expect(verifyCsrf(request, "a".repeat(32), "a".repeat(32))).toBe(true);
    expect(verifyCsrf(request, "a".repeat(32), "b".repeat(32))).toBe(false);

    const crossOrigin = new Request("https://convert.example/delete/1", {
      headers: { host: "convert.example", origin: "https://evil.example" },
    });
    expect(verifyCsrf(crossOrigin, "a".repeat(32), "a".repeat(32))).toBe(false);
  });

  test("uses the trusted forwarded host only when proxy trust is enabled", () => {
    const request = new Request("http://internal:3000/delete/1", {
      headers: {
        host: "internal:3000",
        "x-forwarded-host": "convert.example, edge.internal",
      },
    });
    expect(csrfRequestHost(request, false)).toBe("internal:3000");
    expect(csrfRequestHost(request, true)).toBe("convert.example");
  });
});
