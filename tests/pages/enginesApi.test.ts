import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

test("PDF translation is listed only as PDFMathTranslate and unknown engines are unavailable", async () => {
  // Isolate the database, environment and registry from other tests' module mocks.
  const dataDir = mkdtempSync(join(tmpdir(), "convertx-engine-status-"));
  const root = resolve(import.meta.dir, "../../src");
  try {
    const child = Bun.spawn(
      [
        process.execPath,
        "-e",
        `import Elysia from "elysia";
         import { html as htmlPlugin } from "@elysiajs/html";
         const { enginesApi } = await import(${JSON.stringify(join(root, "pages/enginesApi.tsx"))});
         const { convertersApi } = await import(${JSON.stringify(join(root, "pages/convertersApi.tsx"))});
         const { listConverters } = await import(${JSON.stringify(join(root, "pages/listConverters.tsx"))});
         const app = new Elysia().use(htmlPlugin()).use(enginesApi).use(convertersApi).use(listConverters)
           .get("/test-token", ({ jwt }) => jwt.sign({ id: "1" }));
         const request = (path) => app.handle(new Request("http://localhost" + path));
         const check = (ok, message) => { if (!ok) throw new Error(message); };
         const list = await (await request("/api/converters")).json();
         const translationEngines = list.converters.filter((engine) => /pdfmathtranslate|babeldoc/i.test(engine.name));
         check(translationEngines.length === 1 && translationEngines[0].name === "PDFMathTranslate", "Unexpected PDF translation engine names");
         check(translationEngines[0].outputs.includes("pdf-zh-TW"), "Translation formats were removed");
         const auth = await (await request("/test-token")).text();
         const page = await app.handle(new Request("http://localhost/converters", {
           headers: { cookie: "auth=" + auth, accept: "text/html" }
         }));
         const html = await page.text();
         check(page.ok && html.includes("PDFMathTranslate") && !/babeldoc/i.test(html), "Incorrect UI engine list: " + page.status + " " + html.slice(0, 300));
         for (const name of ["PDFMathTranslate", "pdfmathtranslate"]) {
           const response = await request("/api/engines/" + name + "/available");
           const status = await response.json();
           check(response.status === 200 && status.available === true, name + " was incorrectly removed");
         }
         for (const name of ["BabelDOC", "babeldoc", "nonexistent-engine"]) {
           const response = await request("/api/engines/" + name + "/available");
           const status = await response.json();
           check(response.status === 404 && status.available === false, name + " falsely advertised as available");
         }`,
      ],
      {
        env: {
          ...process.env,
          DATA_DIR: dataDir,
          CONVERTX_EDITION: "standard",
          HTTP_ALLOWED: "true",
          ALLOW_UNAUTHENTICATED: "true",
        },
        stdout: "pipe",
        stderr: "pipe",
      },
    );
    const [exitCode, stdout, stderr] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ]);
    expect(exitCode, stdout + stderr).toBe(0);
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
  }
});
