import { afterAll, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { convert as convertDjvu } from "../../src/converters/djvu";
import { convert as convertFfmpeg } from "../../src/converters/ffmpeg";
import { convert as convertLibreoffice } from "../../src/converters/libreoffice";

const root = mkdtempSync(join(tmpdir(), "convertx-upstream-e2e-"));
afterAll(() => rmSync(root, { recursive: true, force: true }));
const available = (commands: string[]) => commands.every((command) => Bun.which(command));
if (process.env.REQUIRE_UPSTREAM_TOOLS === "true") {
  for (const command of ["c44", "ddjvu", "ffmpeg", "soffice"]) {
    if (!Bun.which(command))
      throw new Error(`Required upstream conversion tool is missing: ${command}`);
  }
}

test.skipIf(!available(["c44", "ddjvu"]))("real DjVu produces PDF and TIFF", async () => {
  const ppm = join(root, "page.ppm");
  const input = join(root, "page.djvu");
  writeFileSync(
    ppm,
    Buffer.concat([Buffer.from("P6\n32 24\n255\n"), Buffer.alloc(32 * 24 * 3, 128)]),
  );
  const created = Bun.spawnSync(["c44", ppm, input]);
  expect(created.exitCode, created.stderr.toString()).toBe(0);
  const pdf = join(root, "page.pdf");
  const tiff = join(root, "page.tiff");
  await convertDjvu(input, "djvu", "pdf", pdf);
  await convertDjvu(input, "djvu", "tiff", tiff);
  expect(readFileSync(pdf).subarray(0, 5).toString()).toBe("%PDF-");
  expect(["49492a00", "4d4d002a"]).toContain(readFileSync(tiff).subarray(0, 4).toString("hex"));
});

test.skipIf(!available(["ffmpeg"]))(
  "real 3CX WAV stays PCM16 mono 8 kHz despite conflicting arguments",
  async () => {
    const input = join(root, "tone.wav");
    const output = join(root, "3cx.wav");
    const created = Bun.spawnSync([
      "ffmpeg",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=440:duration=0.1",
      input,
    ]);
    expect(created.exitCode, created.stderr.toString()).toBe(0);
    const previousInputArgs = process.env.FFMPEG_ARGS;
    const previousOutputArgs = process.env.FFMPEG_OUTPUT_ARGS;
    try {
      process.env.FFMPEG_ARGS = "  -nostdin  ";
      process.env.FFMPEG_OUTPUT_ARGS = "  -ac 2 -ar 44100 -c:a pcm_s24le  ";
      await convertFfmpeg(input, "wav", "wav-3cx", output);
    } finally {
      if (previousInputArgs === undefined) delete process.env.FFMPEG_ARGS;
      else process.env.FFMPEG_ARGS = previousInputArgs;
      if (previousOutputArgs === undefined) delete process.env.FFMPEG_OUTPUT_ARGS;
      else process.env.FFMPEG_OUTPUT_ARGS = previousOutputArgs;
    }
    const wav = readFileSync(output);
    expect(wav.subarray(0, 4).toString()).toBe("RIFF");
    expect(wav.subarray(8, 12).toString()).toBe("WAVE");
    const fmt = wav.indexOf(Buffer.from("fmt ")) + 8;
    expect(fmt).toBeGreaterThan(8);
    expect(wav.readUInt16LE(fmt)).toBe(1);
    expect(wav.readUInt16LE(fmt + 2)).toBe(1);
    expect(wav.readUInt32LE(fmt + 4)).toBe(8000);
    expect(wav.readUInt16LE(fmt + 14)).toBe(16);
  },
);

test.skipIf(!available(["soffice"]))(
  "real Chinese CSV round trips through XLSX to tab-separated UTF-8 TSV",
  async () => {
    const input = join(root, "sheet.csv");
    const xlsx = join(root, "sheet.xlsx");
    const tsv = join(root, "sheet.tsv");
    writeFileSync(input, "姓名,城市\n小明,臺北\n小美,高雄\n");
    await convertLibreoffice(input, "csv", "xlsx", xlsx);
    await convertLibreoffice(xlsx, "xlsx", "tsv", tsv);
    const rows = readFileSync(tsv, "utf8")
      .replace(/^\uFEFF/, "")
      .trim()
      .split(/\r?\n/);
    // Calc may quote text cells; parse quoted fields rather than treating quotes as data.
    expect(
      rows.map((row) => row.split("\t").map((cell) => cell.replace(/^"(.*)"$/, "$1"))),
    ).toEqual([
      ["姓名", "城市"],
      ["小明", "臺北"],
      ["小美", "高雄"],
    ]);
    // Remove the original first so stale input cannot satisfy output validation.
    rmSync(input);
    await convertLibreoffice(xlsx, "xlsx", "csv", input);
    expect(readFileSync(input, "utf8")).toContain("臺北");
    expect(readFileSync(input, "utf8")).toContain("高雄");
  },
  120_000,
);
