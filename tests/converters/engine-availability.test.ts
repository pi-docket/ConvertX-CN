import { expect, test } from "bun:test";
import { resolve } from "node:path";

test("missing executables propagate to engine status and conversion rejection", async () => {
  // A separate process avoids the converter registry's startup cache and shared mocks.
  const registry = resolve(import.meta.dir, "../../src/converters/main.ts");
  const child = Bun.spawn(
    [
      process.execPath,
      "-e",
      `const { getDisabledEngines, validateConversionSelection } = await import(${JSON.stringify(registry)});
       for (const engine of ["inkscape", "imagemagick"]) {
         if (!getDisabledEngines().includes(engine)) throw new Error(engine + " falsely available");
         let rejected = false;
         try { validateConversionSelection(["image.png"], "svg", engine); }
         catch (error) { rejected = error.message.includes("Unknown or disabled converter"); }
         if (!rejected) throw new Error(engine + " accepted conversion");
       }`,
    ],
    {
      env: { ...process.env, PATH: "", CONVERTX_EDITION: "lite", IMAGEMAGICK_COMMAND: "magick" },
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  const error = await new Response(child.stderr).text();
  expect(await child.exited, error).toBe(0);
});
