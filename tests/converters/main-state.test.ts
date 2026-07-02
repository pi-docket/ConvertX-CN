import { describe, expect, test } from "bun:test";
import { getConversionOutputFileName, mainConverter } from "../../src/converters/main";
import { batchItems } from "../../src/application/conversionOrchestrator";

describe("conversion failure semantics", () => {
  test("zero conversion limit keeps the full batch instead of serializing", () => {
    expect(batchItems(["a", "b", "c"], 0)).toEqual([["a", "b", "c"]]);
    expect(batchItems(["a", "b", "c"], 2)).toEqual([["a", "b"], ["c"]]);
  });
  test("unsupported converter rejects instead of returning a success-like string", async () => {
    await expect(
      mainConverter(
        "missing.input",
        "unsupported",
        "pdf",
        "missing.output",
        undefined,
        "not-a-converter",
      ),
    ).rejects.toThrow("Unknown or disabled converter");
  });

  test("expected output name is deterministic", () => {
    expect(getConversionOutputFileName("report.docx", "pdf", "libreoffice")).toBe("report.pdf");
  });
});
