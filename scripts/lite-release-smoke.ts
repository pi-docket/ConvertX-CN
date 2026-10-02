import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
const base = "http://127.0.0.1:3000";
const statePath = "/app/data/.lite-release-smoke.json";
const expectedVersion = process.argv[2];
const phase = process.argv[3] || "initial";
const cookies = new Map<string, string>();
function check(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
async function request(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("cookie", [...cookies].map(([k, v]) => k + "=" + v).join("; "));
  const response = await fetch(base + path, {
    ...init,
    headers,
    redirect: "manual",
    signal: AbortSignal.timeout(30000),
  });
  for (const line of response.headers.getSetCookie()) {
    const pair = line.split(";")[0]!;
    const equal = pair.indexOf("=");
    cookies.set(pair.slice(0, equal), pair.slice(equal + 1));
  }
  return response;
}
async function ready() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await request("/healthcheck");
      if (r.ok && (await r.json()).status === "ok") return;
    } catch {
      // The service may still be starting.
    }
    await Bun.sleep(500);
  }
  throw new Error("Container readiness timeout");
}
if (phase === "restart") {
  const saved = JSON.parse(readFileSync(statePath, "utf8"));
  for (const [key, value] of saved.cookies) cookies.set(key, value);
  await ready();
  check(secretHashes() === saved.secretHashes, "Secrets changed after restart");
  const output = await request(saved.url);
  check(
    output.ok && Buffer.from(await output.arrayBuffer()).toString("base64") === saved.output,
    "Session or output lost after restart",
  );
  check((await request("/history")).ok, "History unavailable after restart");
  console.log("PASS: restart preserves authentication, secrets and conversion results");
  process.exit(0);
}
function secretHashes() {
  return ["jwt-secret", "signing.p12", "signing.password"]
    .map((file) => {
      const path = file === "jwt-secret" ? "/app/data/.secrets/" + file : "/app/data/certs/" + file;
      return new Bun.CryptoHasher("sha256").update(readFileSync(path)).digest("hex");
    })
    .join(":");
}
await ready();
console.log("PASS: deployed healthcheck");
const page = await request("/setup");
const html = await page.text();
check(page.ok && html.includes("<form"), "Missing first-user setup");
const token = /name="csrfToken"\s+value="([^"]+)"/.exec(html)?.[1];
check(token && token === cookies.get("csrf"), "Missing bound CSRF token");
const password = crypto.randomUUID() + crypto.randomUUID();
const registration = await request("/register", {
  method: "POST",
  headers: { origin: base, "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ csrfToken: token, email: "deployment@example.invalid", password }),
});
check(registration.status === 302 && cookies.get("auth"), "Registration failed");
console.log("PASS: first-account registration and authentication");
const css = await request("/generated.css");
check(css.ok && (await css.text()).length > 1000, "Missing built CSS");
const initialHashes = secretHashes();
const processStatus = readFileSync("/proc/1/status", "utf8");
check(
  /^Uid:\s+10001\s+10001\s+10001\s+10001/m.test(processStatus),
  "Application is not running as uid 10001",
);
console.log("PASS: production CSS and non-root runtime (UID 10001)");
check(
  (await (await request("/")).text()).includes(expectedVersion),
  "Incorrect deployed Lite version",
);
const converters = await (await request("/api/converters")).json();
for (const name of [
  "inkscape",
  "imagemagick",
  "calibre",
  "vips",
  "assimp",
  "xelatex",
  "dvisvgm",
  "deark",
  "MinerU",
  "PDFMathTranslate",
  "OCRmyPDF",
]) {
  const detail = converters.converters.find(
    (engine: { name: string; available: boolean }) => engine.name === name,
  );
  check(detail && detail.available === false, name + " falsely advertised as available in Lite");
}
for (const name of [
  "ffmpeg",
  "graphicsmagick",
  "libreoffice",
  "pandoc",
  "dasel",
  "libheif",
  "libjxl",
  "potrace",
  "vtracer",
  "msgconvert",
  "markitDown",
  "pdftops",
  "PDF Packager",
  "vcf",
]) {
  check(
    converters.converters.find(
      (engine: { name: string; available: boolean }) => engine.name === name,
    )?.available === true,
    name + " unexpectedly unavailable",
  );
}
check(
  converters.converters.find(
    (engine: { name: string; available: boolean }) => engine.name === "resvg",
  )?.available === !!Bun.which("resvg"),
  "resvg architecture status mismatch",
);
console.log("PASS: all Lite engine availability statuses match the installed edition");
async function conversion(
  name: string,
  input: Uint8Array | string,
  target: string,
  engine: string,
  verify: (data: Uint8Array) => void,
) {
  const home = await request("/");
  check(home.ok, "Authenticated home failed");
  const job = cookies.get("jobId");
  check(job, "Missing job cookie");
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  const init = await request("/upload-info", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ file_name: name, file_size: bytes.length }),
  });
  const session = await init.json();
  check(init.ok && session.success, "Upload initialization failed");
  const body = new FormData();
  body.set("upload_id", session.upload_id);
  body.set("file", new File([bytes], name));
  const upload = await request("/upload", { method: "POST", body });
  check(upload.ok && (await upload.json()).success, "Multipart upload failed");
  const submitted = await request("/convert", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      convert_to: target + "," + engine,
      file_names: JSON.stringify([name]),
    }),
  });
  check(submitted.status === 302, "Conversion submission failed");
  let result: {
    terminal: boolean;
    status: string;
    successCount: number;
    failedCount: number;
    files: { outputFileName: string }[];
  };
  for (let i = 0; i < 120; i++) {
    const response = await request("/progress-json/" + job);
    check(response.ok, "Progress query failed");
    result = await response.json();
    if (result.terminal) break;
    await Bun.sleep(500);
  }
  check(
    result?.status === "completed" && result.successCount === 1 && result.failedCount === 0,
    engine + " conversion failed: " + JSON.stringify(result),
  );
  const file = result.files[0].outputFileName;
  const url = "/download/1/" + job + "/" + encodeURIComponent(file);
  const output = await request(url);
  check(output.ok, "Output download failed");
  const contents = new Uint8Array(await output.arrayBuffer());
  check(contents.length > 0, "Empty download");
  verify(contents);
  const archive = await request("/archive/" + job);
  check(archive.ok && (await archive.arrayBuffer()).byteLength > 0, "Archive download failed");
  console.log(
    "PASS: upload -> " +
      engine +
      " " +
      name +
      " -> " +
      target +
      " -> download/archive (" +
      contents.length +
      " bytes)",
  );
  return { url, contents };
}
const textResult = await conversion(
  "deploy.md",
  "# Deployment Test\n\n中文部署驗證\n",
  "html",
  "pandoc",
  (data) => check(new TextDecoder().decode(data).includes("Deployment Test"), "Invalid HTML"),
);
await conversion("deploy.json", '{"name":"deployment","count":1}', "yaml", "dasel", (data) =>
  check(new TextDecoder().decode(data).includes("deployment"), "Invalid YAML"),
);
await conversion("deploy.json", '{"name":"deployment","count":1}', "toml", "dasel", (data) =>
  check(new TextDecoder().decode(data).includes("deployment"), "Invalid TOML"),
);
const documentResult = await conversion(
  "deploy.txt",
  "ConvertX Deployment Test\n",
  "pdf",
  "libreoffice",
  (data) => check(new TextDecoder().decode(data.slice(0, 5)) === "%PDF-", "Invalid PDF"),
);
const fixture = mkdtempSync("/tmp/convertx-container-fixtures-");
const audio = spawnSync("ffmpeg", [
  "-v",
  "error",
  "-f",
  "lavfi",
  "-i",
  "sine=frequency=440:duration=0.2",
  fixture + "/input.wav",
]);
check(audio.status === 0, "Audio fixture generation failed");
await conversion("deploy.wav", readFileSync(fixture + "/input.wav"), "flac", "ffmpeg", (data) =>
  check(new TextDecoder().decode(data.slice(0, 4)) === "fLaC", "Invalid FLAC"),
);
const image = spawnSync("gm", ["convert", "-size", "64x64", "xc:red", fixture + "/input.png"]);
check(image.status === 0, "Image fixture generation failed");
await conversion(
  "deploy.png",
  readFileSync(fixture + "/input.png"),
  "jpg",
  "graphicsmagick",
  (data) => check(data[0] === 255 && data[1] === 216, "Invalid JPEG"),
);
const pdf = await conversion(
  "packager.pdf",
  documentResult.contents,
  "pdf-150-s",
  "PDF Packager",
  (b) => {
    check(Buffer.from(b).includes(Buffer.from("/ByteRange")), "PDF signature missing");
  },
);
writeFileSync(fixture + "/signed.pdf", pdf.contents);
const signature = spawnSync("pdfsig", [fixture + "/signed.pdf"], {
  encoding: "utf8",
  timeout: 30000,
});
check(
  signature.status === 0 && signature.stdout.includes("Signature is Valid"),
  "PDF signature validation failed: " + signature.stdout + signature.stderr,
);
await conversion("pages.pdf", documentResult.contents, "png-150", "PDF Packager", (b) =>
  check(b.length > 512, "PDF image archive missing"),
);
await conversion("print.pdf", documentResult.contents, "ps", "pdftops", (b) =>
  check(Buffer.from(b).toString().startsWith("%!PS"), "PostScript output missing"),
);
const png = readFileSync(fixture + "/input.png");
await conversion("jpegxl.png", png, "jxl", "libjxl", (b) =>
  check(b.length > 0, "JXL output empty"),
);
await conversion("vector.png", png, "svg", "vtracer", (b) =>
  check(Buffer.from(b).toString().includes("<svg"), "VTracer SVG missing"),
);
await conversion(
  "contacts.vcf",
  "BEGIN:VCARD\nVERSION:3.0\nFN:Lite Test\nEMAIL:lite@example.invalid\nEND:VCARD\n",
  "csv",
  "vcf",
  (b) => check(Buffer.from(b).toString().includes("Lite Test"), "VCF CSV missing"),
);
await conversion(
  "note.html",
  "<html><body><h1>Lite Markdown</h1></body></html>",
  "md",
  "markitDown",
  (b) => check(Buffer.from(b).toString().includes("Lite Markdown"), "Markdown missing"),
);
if (Bun.which("resvg"))
  await conversion(
    "render.svg",
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="red"/></svg>',
    "png",
    "resvg",
    (b) => check(b.length > 0, "resvg output empty"),
  );
writeFileSync(
  statePath,
  JSON.stringify({
    cookies: [...cookies],
    secretHashes: initialHashes,
    url: textResult.url,
    output: Buffer.from(textResult.contents).toString("base64"),
  }),
  { mode: 0o600 },
);
const noauth = await fetch(base + textResult.url, { redirect: "manual" });
check(!noauth.ok || noauth.status === 302, "Download accessible without authentication");
console.log("PASS: unauthenticated artifact access rejected");
