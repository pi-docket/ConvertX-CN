import { expect, test } from "bun:test";
import { Header } from "../../src/components/header";

test("custom branding is escaped and keeps the configured webroot", () => {
  const html = Header({ branding: "<img src=x onerror=alert(1)>", webroot: "/convertx" });
  expect(html).toContain('href="/convertx/"');
  expect(html).toContain("&lt;img");
  expect(html).not.toContain("<img src=x");
});

test("branding is limited to 26 characters", () => {
  const html = Header({ branding: "A".repeat(30) });
  expect(html).toContain("A".repeat(26));
  expect(html).not.toContain("A".repeat(27));
});
