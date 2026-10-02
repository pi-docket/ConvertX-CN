import fs from "fs";
import { execFile as execFileOriginal } from "node:child_process";
import { ExecFileFn } from "./types";

export const properties = {
  from: {
    document: ["yaml", "toml", "json", "xml", "csv"],
  },
  to: {
    document: ["yaml", "toml", "json", "csv"],
  },
};

export function buildDaselArgs(
  filePath: string,
  fileType: string,
  convertTo: string,
  version: 2 | 3 = 3,
): string[] {
  if (version === 2) return ["--file", filePath, "--read", fileType, "--write", convertTo, "."];
  return ["--var", `data=${fileType}:file:${filePath}`, "--out", convertTo, "$data"];
}

export async function convert(
  filePath: string,
  fileType: string,
  convertTo: string,
  targetPath: string,
  options?: unknown,
  execFile: ExecFileFn = execFileOriginal, // to make it mockable
): Promise<string> {
  return new Promise((resolve, reject) => {
    const execute = (version: 2 | 3) => {
      const args = buildDaselArgs(filePath, fileType, convertTo, version);
      const childProcess = execFile("dasel", args, (error, stdout, stderr) => {
        if (error) {
          // Production images pin v2; newer installations support v3's --var syntax.
          if (version === 3 && stderr.includes("unknown flag: --var")) {
            execute(2);
            return;
          }
          reject(`error: ${error}`);
          return;
        }

        if (stderr) {
          console.error(`stderr: ${stderr}`);
        }

        fs.writeFile(targetPath, stdout, (err: NodeJS.ErrnoException | null) => {
          if (err) {
            reject(`Failed to write output: ${err}`);
          } else {
            resolve("Done");
          }
        });
      });

      childProcess?.stdin?.end();
    };
    execute(3);
  });
}
