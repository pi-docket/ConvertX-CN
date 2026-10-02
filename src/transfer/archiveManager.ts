import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import * as tar from "tar";
import { ALLOWED_ARCHIVE_FORMAT, FORBIDDEN_ARCHIVE_FORMATS } from "./constants";

export function validateArchiveFormat(fileName: string): boolean {
  const lowerName = fileName.toLowerCase();
  if (FORBIDDEN_ARCHIVE_FORMATS.some((extension) => lowerName.endsWith(extension))) {
    return false;
  }
  return lowerName.endsWith(ALLOWED_ARCHIVE_FORMAT);
}

export function getArchiveFileName(baseName: string): string {
  const lowerName = baseName.toLowerCase();
  let cleanName = baseName;
  for (const forbidden of FORBIDDEN_ARCHIVE_FORMATS) {
    if (lowerName.endsWith(forbidden)) {
      cleanName = baseName.slice(0, -forbidden.length);
      break;
    }
  }
  return cleanName.toLowerCase().endsWith(ALLOWED_ARCHIVE_FORMAT)
    ? cleanName
    : `${cleanName}${ALLOWED_ARCHIVE_FORMAT}`;
}

export async function createTarArchive(
  sourceDir: string,
  outputPath: string,
  options: {
    filter?: (path: string) => boolean;
    prefix?: string;
    entries?: string[];
  } = {},
): Promise<string> {
  const finalOutputPath = getArchiveFileName(outputPath);
  const outputDir = dirname(finalOutputPath);
  if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });

  const files = options.entries ?? readdirSync(sourceDir);
  const filter = (path: string) =>
    resolve(sourceDir, path) !== resolve(finalOutputPath) && (options.filter?.(path) ?? true);
  await tar.create(
    {
      file: finalOutputPath,
      cwd: sourceDir,
      filter,
      gzip: false,
    },
    files.filter((file) => filter(file)),
  );
  console.log(`Created tar archive: ${finalOutputPath}`);
  return finalOutputPath;
}
