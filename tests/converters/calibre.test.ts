import { expect, test } from "bun:test";
import { convert, properties } from "../../src/converters/calibre";
import { runCommonTests } from "./helpers/commonTests";

runCommonTests(convert);

test.each([
  ["upload.txt", "recipe"],
  ["upload.txt", "downloaded_recipe"],
  ["upload.RECIPE", "txt"],
  ["upload.DOWNLOADED_RECIPE", "txt"],
])("rejects executable recipe input %s (%s) before invoking Calibre", async (file, type) => {
  let called = false;
  await expect(
    convert(file, type, "epub", "output.epub", undefined, () => {
      called = true;
    }),
  ).rejects.toThrow("Recipe files are not supported");
  expect(called).toBe(false);
});

test("does not advertise recipe inputs", () => {
  expect(properties.from.document).not.toContain("recipe");
});

test.skip("dummy - required to trigger test detection", () => {});
