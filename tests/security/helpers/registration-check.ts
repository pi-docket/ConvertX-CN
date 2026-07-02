import { Elysia } from "elysia";
import db from "../../../src/db/db";
import { user } from "../../../src/pages/user";

const app = new Elysia().use(user);
const requestHeaders = { host: "localhost", origin: "http://localhost" };

const initial = await app.handle(
  new Request("http://localhost/register", { headers: requestHeaders }),
);
const setCookie = initial.headers.get("set-cookie") ?? "";
const csrfToken = /(?:^|,\s*)csrf=([^;]+)/.exec(setCookie)?.[1];
if (!csrfToken) throw new Error(`Registration page did not issue CSRF cookie: ${setCookie}`);

function register(email: string) {
  return app.handle(
    new Request("http://localhost/register", {
      method: "POST",
      headers: {
        ...requestHeaders,
        cookie: `csrf=${csrfToken}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        csrfToken,
        email,
        password: "a-long-test-password",
      }),
    }),
  );
}

const firstRegistration = await register("first@example.invalid");
const pageAfterSetup = await app.handle(
  new Request("http://localhost/register", { headers: requestHeaders }),
);
const secondRegistration = await register("second@example.invalid");

console.log(
  JSON.stringify({
    initialStatus: initial.status,
    csrfSecure: /;\s*Secure(?:;|,|$)/i.test(setCookie),
    firstStatus: firstRegistration.status,
    userCount: (db.query("SELECT COUNT(*) AS count FROM users").get() as { count: number }).count,
    pageAfterSetupStatus: pageAfterSetup.status,
    pageAfterSetupLocation: pageAfterSetup.headers.get("location"),
    secondStatus: secondRegistration.status,
    secondBody: await secondRegistration.text(),
  }),
);
