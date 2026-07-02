import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

const dataDir = resolve(tmpdir(), `convertx-http-p0-${process.pid}`);
const port = 32_000 + Math.floor(Math.random() * 2_000);
const baseUrl = `http://127.0.0.1:${port}`;
let server: ReturnType<typeof Bun.spawn>;

function setCookieValues(response: Response): string {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  return headers.getSetCookie?.().join(",") ?? response.headers.get("set-cookie") ?? "";
}

function cookieValue(response: Response, name: string): string {
  const match = new RegExp(`(?:^|,\\s*)${name}=([^;]*)`).exec(setCookieValues(response));
  if (!match?.[1]) {
    throw new Error(`Missing ${name} cookie in: ${setCookieValues(response)}`);
  }
  return match[1];
}

async function waitUntilReady(): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/healthcheck`);
      if (response.ok) return;
    } catch {
      // Server is still starting.
    }
    if (server.exitCode !== null) throw new Error(`Server exited with ${server.exitCode}`);
    await Bun.sleep(50);
  }
  throw new Error("Timed out waiting for P0 HTTP test server");
}

beforeAll(async () => {
  rmSync(dataDir, { recursive: true, force: true });
  server = Bun.spawn({
    cmd: [process.execPath, "src/index.tsx"],
    cwd: process.cwd(),
    env: {
      ...process.env,
      ACCOUNT_REGISTRATION: "false",
      AUTO_DELETE_EVERY_N_HOURS: "0",
      DATA_DIR: dataDir,
      HTTP_ALLOWED: "true",
      JWT_SECRET: "",
      NODE_ENV: "production",
      PORT: String(port),
    },
    stdout: "ignore",
    stderr: "ignore",
  });
  await waitUntilReady();
});

afterAll(async () => {
  server?.kill();
  if (server) await server.exited;
  if (existsSync(dataDir)) rmSync(dataDir, { recursive: true, force: true });
});

describe("P0 HTTP workflow", () => {
  test("enforces setup, bound uploads, CSRF deletion, no REST v1, and POST logout", async () => {
    const registrationPage = await fetch(`${baseUrl}/register`, { redirect: "manual" });
    expect(registrationPage.status).toBe(200);
    const csrf = cookieValue(registrationPage, "csrf");
    const html = await registrationPage.text();
    const csrfField = /name="csrfToken"\s+value="([^"]+)"/.exec(html)?.[1];
    expect(csrfField).toBe(csrf);

    const registration = await fetch(`${baseUrl}/register`, {
      method: "POST",
      redirect: "manual",
      headers: {
        cookie: `csrf=${csrf}`,
        origin: baseUrl,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        csrfToken: csrf,
        email: "http-owner@example.invalid",
        password: "a-long-test-password",
      }),
    });
    expect(registration.status).toBe(302);
    const auth = cookieValue(registration, "auth");
    const authCookies = `csrf=${csrf}; auth=${auth}`;

    const registrationAfterSetup = await fetch(`${baseUrl}/register`, {
      redirect: "manual",
    });
    expect(registrationAfterSetup.status).toBe(302);
    expect(registrationAfterSetup.headers.get("location")).toBe("/login");

    const home = await fetch(`${baseUrl}/`, {
      headers: { cookie: authCookies },
    });
    expect(home.status).toBe(200);
    expect(home.headers.get("x-content-type-options")).toBe("nosniff");
    expect(home.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
    const jobId = cookieValue(home, "jobId");
    const cookies = `${authCookies}; jobId=${jobId}`;
    const refreshedHome = await fetch(`${baseUrl}/`, {
      headers: { cookie: cookies },
    });
    expect(refreshedHome.status).toBe(200);
    expect(cookieValue(refreshedHome, "jobId")).toBe(jobId);

    const initialize = await fetch(`${baseUrl}/upload-info`, {
      method: "POST",
      headers: {
        cookie: cookies,
        "content-type": "application/json",
      },
      body: JSON.stringify({ file_name: "safe.txt", file_size: 5 }),
    });
    const session = (await initialize.json()) as {
      success: boolean;
      mode: string;
      upload_id: string;
    };
    expect(initialize.status).toBe(200);
    expect(session).toMatchObject({ success: true, mode: "direct" });
    expect(session.upload_id).toMatch(/^[0-9a-f-]{36}$/i);

    const bypassBody = new FormData();
    bypassBody.append("file", new File(["hello"], "safe.txt"));
    const bypass = await fetch(`${baseUrl}/upload`, {
      method: "POST",
      headers: { cookie: cookies },
      body: bypassBody,
    });
    expect(bypass.status).toBe(422);

    const uploadBody = new FormData();
    uploadBody.append("upload_id", session.upload_id);
    uploadBody.append("file", new File(["hello"], "safe.txt"));
    const upload = await fetch(`${baseUrl}/upload`, {
      method: "POST",
      headers: { cookie: cookies },
      body: uploadBody,
    });
    expect(upload.status).toBe(200);
    expect(await upload.json()).toMatchObject({ success: true });

    const maliciousConversion = await fetch(`${baseUrl}/convert`, {
      method: "POST",
      redirect: "manual",
      headers: {
        cookie: cookies,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        convert_to: "../../../../escaped,libreoffice",
        file_names: JSON.stringify(["safe.txt"]),
      }),
    });
    expect(maliciousConversion.status).toBe(400);
    expect(await maliciousConversion.json()).toMatchObject({
      success: false,
      error: "Invalid conversion request",
    });

    const duplicate = await fetch(`${baseUrl}/upload-info`, {
      method: "POST",
      headers: { cookie: cookies, "content-type": "application/json" },
      body: JSON.stringify({ file_name: "safe.txt", file_size: 5 }),
    });
    expect(duplicate.status).toBe(409);

    const crossOriginDelete = await fetch(`${baseUrl}/delete`, {
      method: "POST",
      headers: {
        cookie: cookies,
        origin: "https://attacker.invalid",
        "content-type": "application/json",
      },
      body: JSON.stringify({ filename: "safe.txt", csrf_token: csrf }),
    });
    expect(crossOriginDelete.status).toBe(403);

    const deleteUpload = await fetch(`${baseUrl}/delete`, {
      method: "POST",
      headers: {
        cookie: cookies,
        origin: baseUrl,
        "content-type": "application/json",
      },
      body: JSON.stringify({ filename: "safe.txt", csrf_token: csrf }),
    });
    expect(deleteUpload.status).toBe(200);

    expect((await fetch(`${baseUrl}/inference/profile`)).status).not.toBe(200);
    expect(
      (
        await fetch(`${baseUrl}/inference/profile`, {
          headers: { cookie: authCookies },
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await fetch(`${baseUrl}/inference/cancel-warmup`, {
          method: "POST",
          headers: { cookie: authCookies },
        })
      ).status,
    ).toBe(404);
    const diagnosticCleanup = await fetch(`${baseUrl}/api/memory/cleanup`, {
      method: "POST",
      headers: {
        cookie: authCookies,
        origin: baseUrl,
        "content-type": "application/json",
      },
      body: JSON.stringify({ csrf_token: csrf }),
    });
    expect(diagnosticCleanup.status).toBe(403);

    expect((await fetch(`${baseUrl}/api/v1/health`)).status).toBe(404);
    expect((await fetch(`${baseUrl}/logoff`, { redirect: "manual" })).status).toBe(405);

    const logout = await fetch(`${baseUrl}/logoff`, {
      method: "POST",
      redirect: "manual",
      headers: {
        cookie: authCookies,
        origin: baseUrl,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ csrfToken: csrf }),
    });
    expect(logout.status).toBe(302);
  }, 30_000);
});
