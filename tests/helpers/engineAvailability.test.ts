import { describe, expect, test } from "bun:test";
import { getMissingExecutableEngines } from "../../src/helpers/engineAvailability";

describe("converter executable availability", () => {
  test("Lite checks every external converter while retaining pure VCF support", () => {
    const disabled = getMissingExecutableEngines(() => null, "magick", "lite");
    for (const engine of [
      "calibre",
      "mineru",
      "pdfmathtranslate",
      "ocrmypdf",
      "resvg",
      "pdf packager",
      "djvu",
    ]) {
      expect(disabled).toContain(engine);
    }
    expect(disabled).not.toContain("vcf");
    expect(getMissingExecutableEngines((cmd) => `/bin/${cmd}`, "magick", "lite")).toEqual([]);
  });
  const lookup =
    (...installed: string[]) =>
    (command: string) =>
      installed.includes(command) ? `/bin/${command}` : null;

  test("Lite's missing engines are disabled while xvfb alone is insufficient", () => {
    expect(getMissingExecutableEngines(lookup("xvfb-run"), "magick")).toEqual([
      "inkscape",
      "imagemagick",
      "djvu",
    ]);
  });

  test("installed engines remain available in any edition", () => {
    expect(
      getMissingExecutableEngines(lookup("inkscape", "xvfb-run", "magick", "ddjvu"), "magick"),
    ).toEqual([]);
  });

  test("Inkscape requires its headless wrapper", () => {
    expect(getMissingExecutableEngines(lookup("inkscape", "magick", "ddjvu"), "magick")).toEqual([
      "inkscape",
    ]);
  });

  test("ImageMagick honors the configured executable instead of requiring magick", () => {
    expect(
      getMissingExecutableEngines(lookup("inkscape", "xvfb-run", "/opt/im", "ddjvu"), "/opt/im"),
    ).toEqual([]);
    expect(
      getMissingExecutableEngines(lookup("inkscape", "xvfb-run", "magick", "ddjvu"), "/missing/im"),
    ).toEqual(["imagemagick"]);
  });
});
