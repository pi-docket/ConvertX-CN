import { execFile as execFileOriginal } from "node:child_process";
import { statSync } from "node:fs";
import type { ExecFileFn } from "./types";

export const properties = {
  from: { document: ["djvu", "djv"] },
  to: { document: ["pdf", "tiff"] },
};

export function convert(
  filePath: string,
  _fileType: string,
  convertTo: string,
  targetPath: string,
  _options?: unknown,
  execFile: ExecFileFn = execFileOriginal,
): Promise<string> {
  if (!properties.to.document.includes(convertTo)) {
    return Promise.reject(new Error(`Unsupported DjVu output format: ${convertTo}`));
  }
  return new Promise((resolve, reject) => {
    execFile("ddjvu", [`-format=${convertTo}`, filePath, targetPath], (error, _stdout, stderr) => {
      if (error) {
        reject(new Error(`ddjvu failed: ${error.message}${stderr ? `\n${stderr}` : ""}`));
        return;
      }
      try {
        if (statSync(targetPath).size === 0) throw new Error("Empty DjVu output");
        resolve("Done");
      } catch {
        reject(new Error("ddjvu did not create a non-empty output file"));
      }
    });
  });
}
