import { describe, expect, test } from "bun:test";
import {
  getConversionOutputFileName,
  validateConversionSelection,
} from "../../src/converters/main";
import type { Filename, Jobs } from "../../src/db/types";
import { ResultsArticle } from "../../src/pages/results";

describe("conversion request safety", () => {
  test("rejects path-like and unsupported conversion targets before execution", () => {
    expect(() =>
      validateConversionSelection(["safe.txt"], "../../../../escaped", "libreoffice"),
    ).toThrow("does not support");
    expect(() => validateConversionSelection(["safe.txt"], "pdf", "PDF Packager")).toThrow(
      "does not support",
    );
    expect(() =>
      validateConversionSelection(["safe.txt"], "pdf", "<img src=x onerror=alert(1)>"),
    ).toThrow("Unknown or disabled converter");
  });

  test("gives each PDF Packager input a distinct artifact name", () => {
    const first = getConversionOutputFileName("first.pdf", "pdf-300", "PDF Packager");
    const second = getConversionOutputFileName("second.pdf", "pdf-300", "PDF Packager");
    expect(first).toBe("first-pack_pdf-300.pdf");
    expect(second).toBe("second-pack_pdf-300.pdf");
    expect(first).not.toBe(second);
  });
});

describe("results rendering safety", () => {
  test("escapes job errors and URL-encodes artifact file names", () => {
    const job = {
      id: 7,
      user_id: 3,
      date_created: new Date().toISOString(),
      status: "failed",
      error_message: '<img src=x onerror="alert(1)">',
      started_at: null,
      completed_at: null,
      num_files: 1,
      finished_files: 1,
      files_detailed: [],
    } as Jobs;
    const files = [
      {
        id: 1,
        job_id: 7,
        file_name: "source.txt",
        output_file_name: "report#1.pdf",
        status: "completed",
        error_message: null,
        started_at: null,
        completed_at: null,
      } as Filename,
    ];

    const html = String(ResultsArticle({ job, files, csrfToken: "csrf-token-for-test" }));
    expect(html).not.toContain('<img src=x onerror="alert(1)">');
    expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
    expect(html).toContain("report%231.pdf");
  });
});
