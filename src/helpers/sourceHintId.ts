import { createHash } from "node:crypto";

/** Share repeated source lists between target buttons without duplicating page data. */
export function sourceHintId(sources: string): string {
  return `source-hint-${createHash("sha256").update(sources).digest("hex").slice(0, 16)}`;
}
