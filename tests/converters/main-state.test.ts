import { describe, expect, test } from "bun:test";
import {
  getAllInputs,
  getAllTargets,
  getPossibleTargets,
  getPossibleSources,
  getConversionOutputFileName,
  mainConverter,
  validateConversionSelection,
} from "../../src/converters/main";
import { batchItems } from "../../src/application/conversionOrchestrator";

describe("conversion failure semantics", () => {
  test("source hints respect target categories and preserve overlapping input categories", () => {
    expect(getPossibleSources("xlsx").libreoffice).toContain("csv");
    expect(getPossibleSources("xlsx").libreoffice).not.toContain("docx");
    expect(getPossibleTargets("tab").libreoffice).toContain("docx");
    expect(getPossibleTargets("tab").libreoffice).toContain("xlsx");
    expect(getPossibleSources("csv").vcf).toEqual(["vcf"]);
  });
  test("format listings do not corrupt categories or allow document-to-spreadsheet conversions", () => {
    getAllTargets();
    getAllInputs("libreoffice");
    expect(getPossibleTargets("docx").libreoffice).not.toContain("xlsx");
    expect(getPossibleTargets("jxl").libjxl).not.toContain("jxl");
    expect(() => validateConversionSelection(["in.docx"], "xlsx", "libreoffice")).toThrow(
      "does not support",
    );
    expect(validateConversionSelection(["in.xlsx"], "csv", "libreoffice")).toBe("csv");
  });

  test("callers can mutate returned listings without changing later selections", () => {
    getAllTargets().libreoffice?.push("unsupported-format");
    getAllInputs("libreoffice").push("unsupported-input");
    getPossibleTargets("docx").libreoffice?.push("xlsx");
    expect(getAllTargets().libreoffice).not.toContain("unsupported-format");
    expect(getAllInputs("libreoffice")).not.toContain("unsupported-input");
    expect(getPossibleTargets("docx").libreoffice).not.toContain("xlsx");
  });
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
