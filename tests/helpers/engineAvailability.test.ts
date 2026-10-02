import { describe, expect, test } from "bun:test";
import { getMissingExecutableEngines } from "../../src/helpers/engineAvailability";

describe("converter executable availability", () => {
  const lookup =
    (...installed: string[]) =>
    (command: string) =>
      installed.includes(command) ? `/bin/${command}` : null;

  test("Lite's missing engines are disabled while xvfb alone is insufficient", () => {
    expect(getMissingExecutableEngines(lookup("xvfb-run"), "magick")).toEqual([
      "inkscape",
      "imagemagick",
    ]);
  });

  test("installed engines remain available in any edition", () => {
    expect(getMissingExecutableEngines(lookup("inkscape", "xvfb-run", "magick"), "magick")).toEqual(
      [],
    );
  });

  test("Inkscape requires its headless wrapper", () => {
    expect(getMissingExecutableEngines(lookup("inkscape", "magick"), "magick")).toEqual([
      "inkscape",
    ]);
  });

  test("ImageMagick honors the configured executable instead of requiring magick", () => {
    expect(
      getMissingExecutableEngines(lookup("inkscape", "xvfb-run", "/opt/im"), "/opt/im"),
    ).toEqual([]);
    expect(
      getMissingExecutableEngines(lookup("inkscape", "xvfb-run", "magick"), "/missing/im"),
    ).toEqual(["imagemagick"]);
  });
});
