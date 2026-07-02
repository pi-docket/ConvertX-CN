import { resolve, sep } from "node:path";
import { DATA_DIR } from "./env";

export const dataDirPath = resolve(DATA_DIR);
export const uploadsDirPath = resolve(dataDirPath, "uploads");
export const outputDirPath = resolve(dataDirPath, "output");

// Compatibility exports for routes that still append user/job segments.
export const uploadsDir = `${uploadsDirPath}${sep}`;
export const outputDir = `${outputDirPath}${sep}`;

export function isPathInside(parent: string, candidate: string): boolean {
  const parentPath = resolve(parent);
  const candidatePath = resolve(candidate);
  return candidatePath === parentPath || candidatePath.startsWith(`${parentPath}${sep}`);
}
