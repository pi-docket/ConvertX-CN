import { randomBytes, timingSafeEqual } from "node:crypto";
import type { Cookie } from "elysia";
import { HTTP_ALLOWED, TRUST_PROXY, WEBROOT } from "./env";

export function csrfCookieOptions() {
  return {
    httpOnly: true,
    secure: !HTTP_ALLOWED,
    sameSite: "strict" as const,
    path: WEBROOT || "/",
    maxAge: 60 * 60 * 8,
  };
}

export function ensureCsrfToken(cookie: Cookie<unknown> | undefined): string {
  if (!cookie) throw new Error("CSRF cookie is unavailable");
  if (typeof cookie.value === "string" && cookie.value.length >= 32) return cookie.value;
  const token = randomBytes(32).toString("base64url");
  cookie.set({ value: token, ...csrfCookieOptions() });
  return token;
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function csrfRequestHost(request: Request, trustProxy = TRUST_PROXY): string | null {
  const forwardedHost = trustProxy
    ? request.headers.get("x-forwarded-host")?.split(",")[0]?.trim()
    : undefined;
  return forwardedHost || request.headers.get("host");
}

export function verifyCsrf(
  request: Request,
  submittedToken: string | undefined,
  cookieToken: string | undefined,
): boolean {
  if (!submittedToken || !cookieToken || !safeEqual(submittedToken, cookieToken)) return false;

  const origin = request.headers.get("origin");
  const host = csrfRequestHost(request);
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
