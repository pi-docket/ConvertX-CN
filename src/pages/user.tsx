import { jwt } from "@elysiajs/jwt";
import { Elysia, t } from "elysia";
import { BaseHtml } from "../components/base";
import { Header } from "../components/header";
import { LanguageSelector } from "../components/languageSelector";
import { ThemeToggle } from "../components/themeToggle";
import db from "../db/db";
import { User } from "../db/types";
import {
  ACCOUNT_REGISTRATION,
  ALLOW_UNAUTHENTICATED,
  HIDE_HISTORY,
  HTTP_ALLOWED,
  WEBROOT,
} from "../helpers/env";
import { localeService } from "../i18n/service";

import { ensureCsrfToken, verifyCsrf } from "../helpers/csrf";
import { JWT_SECRET } from "../helpers/jwtSecret";

export function isFirstRun(): boolean {
  return db.query("SELECT id FROM users LIMIT 1").get() === null;
}

class RegistrationError extends Error {
  constructor(public readonly code: "DISABLED" | "DUPLICATE") {
    super(code);
  }
}

// ==============================================================================
// Cookie 設定輔助函數
// ==============================================================================
// 解決遠端部署時登入失敗的問題：
// 1. sameSite: "lax" - 允許導航時傳送 Cookie（strict 會阻擋）
// 2. path: WEBROOT || "/" - 確保 Cookie 覆蓋整個應用
// 3. secure: 只由是否允許明文 HTTP 決定，避免 TRUST_PROXY 反向關閉 Secure
// ==============================================================================
function getCookieOptions() {
  return {
    httpOnly: true,
    secure: !HTTP_ALLOWED,
    maxAge: 60 * 60 * 24 * 7, // 7 days
    sameSite: "lax" as const,
    path: WEBROOT || "/",
  };
}

export const userService = new Elysia({ name: "user/service" })
  .use(
    jwt({
      name: "jwt",
      schema: t.Object({
        id: t.String(),
      }),
      secret: JWT_SECRET,
      exp: "7d",
    }),
  )
  .model({
    signIn: t.Object({
      csrfToken: t.String({ minLength: 16, maxLength: 256 }),
      email: t.String({ format: "email", minLength: 3, maxLength: 254 }),
      password: t.String({ minLength: 1, maxLength: 128 }),
    }),
    registration: t.Object({
      csrfToken: t.String({ minLength: 16, maxLength: 256 }),
      email: t.String({ format: "email", minLength: 3, maxLength: 254 }),
      password: t.String({ minLength: 8, maxLength: 128 }),
    }),
    session: t.Cookie({
      csrf: t.Optional(t.String()),
      auth: t.String(),
      jobId: t.Optional(t.String()),
    }),
    optionalSession: t.Cookie({
      csrf: t.Optional(t.String()),
      auth: t.Optional(t.String()),
      jobId: t.Optional(t.String()),
    }),
  })
  .macro("auth", {
    cookie: "session",
    async resolve({ status, jwt, cookie: { auth } }) {
      if (!auth.value) {
        return status(401, {
          success: false,
          message: "Unauthorized",
        });
      }
      const user = await jwt.verify(auth.value);
      if (!user) {
        return status(401, {
          success: false,
          message: "Unauthorized",
        });
      }
      return {
        success: true,
        user,
      };
    },
  });

export const user = new Elysia()
  .use(userService)
  .use(localeService)
  .get("/setup", ({ redirect, locale, t, cookie: { csrf } }) => {
    if (!isFirstRun()) {
      return redirect(`${WEBROOT}/login`, 302);
    }
    const csrfToken = ensureCsrfToken(csrf);

    return (
      <BaseHtml title="ConvertX-CN | Setup" webroot={WEBROOT} locale={locale}>
        <>
          <header class="w-full p-4">
            <nav
              class="mx-auto flex max-w-4xl items-center justify-between rounded-xl p-4"
              style={{
                background: "var(--glass-bg)",
                backdropFilter: "var(--glass-blur)",
                WebkitBackdropFilter: "var(--glass-blur)",
                border: "1px solid var(--glass-border)",
                boxShadow: "var(--glass-shadow), var(--glass-inset-highlight)",
              }}
            >
              <strong>ConvertX-CN</strong>
              <div class="flex items-center gap-4">
                <ThemeToggle locale={locale} t={t} />
                <LanguageSelector currentLocale={locale} webroot={WEBROOT} t={t} />
              </div>
            </nav>
          </header>
          <main
            class={`
              mx-auto w-full max-w-4xl flex-1 px-2
              sm:px-4
            `}
          >
            <h1 class="my-8 text-3xl" safe>
              {t("setup", "welcome")}
            </h1>
            <article class="article p-0">
              <header class="w-full bg-neutral-800 p-4" safe>
                {t("setup", "createYourAccount")}
              </header>
              <form method="post" action={`${WEBROOT}/register`} class="p-4">
                <input type="hidden" name="csrfToken" value={csrfToken} />
                <fieldset class="mb-4 flex flex-col gap-4">
                  <label class="flex flex-col gap-1">
                    <span safe>{t("auth", "email")}</span>
                    <input
                      type="email"
                      name="email"
                      class="rounded-sm bg-neutral-800 p-3"
                      placeholder={t("auth", "email")}
                      autocomplete="email"
                      required
                    />
                  </label>
                  <label class="flex flex-col gap-1">
                    <span safe>{t("auth", "password")}</span>
                    <input
                      type="password"
                      name="password"
                      class="rounded-sm bg-neutral-800 p-3"
                      placeholder={t("auth", "password")}
                      autocomplete="current-password"
                      required
                    />
                  </label>
                </fieldset>
                <input type="submit" value={t("auth", "createAccount")} class="btn-primary" />
              </form>
              <footer class="p-4">
                <span safe>{t("setup", "reportIssues")}</span>{" "}
                <a
                  class={`
                    text-accent-500 underline
                    hover:text-accent-400
                  `}
                  href="https://github.com/pi-docket/ConvertX-CN"
                  safe
                >
                  {t("setup", "github")}
                </a>
                .
              </footer>
            </article>
          </main>
        </>
      </BaseHtml>
    );
  })
  .get("/register", ({ locale, t, redirect, cookie: { csrf } }) => {
    if (!isFirstRun() && !ACCOUNT_REGISTRATION) {
      return redirect(`${WEBROOT}/login`, 302);
    }
    const csrfToken = ensureCsrfToken(csrf);
    // 移除 ACCOUNT_REGISTRATION 限制，讓註冊頁面始終可用
    return (
      <BaseHtml webroot={WEBROOT} title="ConvertX-CN | Register" locale={locale}>
        <>
          <Header
            webroot={WEBROOT}
            accountRegistration={ACCOUNT_REGISTRATION}
            allowUnauthenticated={ALLOW_UNAUTHENTICATED}
            hideHistory={HIDE_HISTORY}
            locale={locale}
            t={t}
          />
          <main
            class={`
              w-full flex-1 px-2
              sm:px-4
            `}
          >
            <article class="article">
              <form method="post" class="flex flex-col gap-4">
                <input type="hidden" name="csrfToken" value={csrfToken} />
                <fieldset class="mb-4 flex flex-col gap-4">
                  <label class="flex flex-col gap-1">
                    <span safe>{t("auth", "email")}</span>
                    <input
                      type="email"
                      name="email"
                      class="rounded-sm bg-neutral-800 p-3"
                      placeholder={t("auth", "email")}
                      autocomplete="email"
                      required
                    />
                  </label>
                  <label class="flex flex-col gap-1">
                    <span safe>{t("auth", "password")}</span>
                    <input
                      type="password"
                      name="password"
                      class="rounded-sm bg-neutral-800 p-3"
                      placeholder={t("auth", "password")}
                      autocomplete="current-password"
                      required
                    />
                  </label>
                </fieldset>
                <input
                  type="submit"
                  value={t("auth", "registerButton")}
                  class="w-full btn-primary"
                />
              </form>
            </article>
          </main>
        </>
      </BaseHtml>
    );
  })
  .post(
    "/register",
    async ({
      body: { email, password, csrfToken },
      set,
      redirect,
      jwt,
      request,
      cookie: { auth, csrf },
    }) => {
      // 移除 ACCOUNT_REGISTRATION 限制，讓註冊功能始終可用
      if (
        !verifyCsrf(request, csrfToken, typeof csrf?.value === "string" ? csrf.value : undefined)
      ) {
        set.status = 403;
        return { message: "Invalid CSRF token or Origin." };
      }
      const normalizedEmail = email.trim().toLowerCase();
      if (!isFirstRun() && !ACCOUNT_REGISTRATION) {
        set.status = 403;
        return { message: "Account registration is disabled." };
      }
      const savedPassword = await Bun.password.hash(password);
      let user: User | null = null;
      try {
        user = db.transaction(() => {
          const isFirstUser = db.query("SELECT id FROM users LIMIT 1").get() === null;
          if (!isFirstUser && !ACCOUNT_REGISTRATION) {
            throw new RegistrationError("DISABLED");
          }
          if (db.query("SELECT id FROM users WHERE email = ?").get(normalizedEmail)) {
            throw new RegistrationError("DUPLICATE");
          }
          const result = db
            .query("INSERT INTO users (email, password) VALUES (?, ?)")
            .run(normalizedEmail, savedPassword);
          return (
            db.query("SELECT * FROM users WHERE id = ?").as(User).get(result.lastInsertRowid) ??
            null
          );
        })();
      } catch (error) {
        if (error instanceof RegistrationError && error.code === "DISABLED") {
          set.status = 403;
          return { message: "Account registration is disabled." };
        }
        if (
          (error instanceof RegistrationError && error.code === "DUPLICATE") ||
          (error instanceof Error && error.message.includes("UNIQUE constraint failed"))
        ) {
          set.status = 409;
          return { message: "Email already in use." };
        }
        throw error;
      }
      if (!user) {
        set.status = 500;
        return {
          message: "Failed to create user.",
        };
      }

      const accessToken = await jwt.sign({
        id: String(user.id),
      });

      if (!auth) {
        set.status = 500;
        return {
          message: "No auth cookie, perhaps your browser is blocking cookies.",
        };
      }

      // set cookie with proper options for remote deployment
      auth.set({
        value: accessToken,
        ...getCookieOptions(),
      });

      return redirect(`${WEBROOT}/`, 302);
    },
    { body: "registration" },
  )
  .get(
    "/login",
    async ({ jwt, redirect, cookie: { auth, csrf }, locale, t }) => {
      if (isFirstRun()) {
        return redirect(`${WEBROOT}/setup`, 302);
      }

      // if already logged in, redirect to home
      if (auth?.value) {
        const user = await jwt.verify(auth.value);

        if (user) {
          return redirect(`${WEBROOT}/`, 302);
        }

        auth.remove();
      }
      const csrfToken = ensureCsrfToken(csrf);

      return (
        <BaseHtml webroot={WEBROOT} title="ConvertX-CN | Login" locale={locale}>
          <>
            <Header
              webroot={WEBROOT}
              accountRegistration={ACCOUNT_REGISTRATION}
              allowUnauthenticated={ALLOW_UNAUTHENTICATED}
              hideHistory={HIDE_HISTORY}
              locale={locale}
              t={t}
            />
            <main
              class={`
                w-full flex-1 px-2
                sm:px-4
              `}
            >
              <article class="article">
                <form method="post" class="flex flex-col gap-4">
                  <input type="hidden" name="csrfToken" value={csrfToken} />
                  <fieldset class="mb-4 flex flex-col gap-4">
                    <label class="flex flex-col gap-1">
                      <span safe>{t("auth", "email")}</span>
                      <input
                        type="email"
                        name="email"
                        class="rounded-sm bg-neutral-800 p-3"
                        placeholder={t("auth", "email")}
                        autocomplete="email"
                        required
                      />
                    </label>
                    <label class="flex flex-col gap-1">
                      <span safe>{t("auth", "password")}</span>
                      <input
                        type="password"
                        name="password"
                        class="rounded-sm bg-neutral-800 p-3"
                        placeholder={t("auth", "password")}
                        autocomplete="current-password"
                        required
                      />
                    </label>
                  </fieldset>
                  <div class="flex flex-row gap-4">
                    <a
                      href={`${WEBROOT}/register`}
                      role="button"
                      class="w-full btn-secondary text-center"
                      safe
                    >
                      {t("nav", "register")}
                    </a>
                    <input
                      type="submit"
                      value={t("auth", "loginButton")}
                      class="w-full btn-primary"
                    />
                  </div>
                </form>
              </article>
            </main>
          </>
        </BaseHtml>
      );
    },
    { body: "signIn", cookie: "optionalSession" },
  )
  .post(
    "/login",
    async function handler({ body, set, redirect, jwt, request, cookie: { auth, csrf } }) {
      if (
        !verifyCsrf(
          request,
          body.csrfToken,
          typeof csrf?.value === "string" ? csrf.value : undefined,
        )
      ) {
        set.status = 403;
        return { message: "Invalid CSRF token or Origin." };
      }
      const existingUser = db
        .query("SELECT * FROM users WHERE email = ?")
        .as(User)
        .get(body.email.trim().toLowerCase());

      if (!existingUser) {
        set.status = 403;
        return {
          message: "Invalid credentials.",
        };
      }

      const validPassword = await Bun.password.verify(body.password, existingUser.password);

      if (!validPassword) {
        set.status = 403;
        return {
          message: "Invalid credentials.",
        };
      }

      const accessToken = await jwt.sign({
        id: String(existingUser.id),
      });

      if (!auth) {
        set.status = 500;
        return {
          message: "No auth cookie, perhaps your browser is blocking cookies.",
        };
      }

      // set cookie with proper options for remote deployment
      auth.set({
        value: accessToken,
        ...getCookieOptions(),
      });

      return redirect(`${WEBROOT}/`, 302);
    },
    { body: "signIn" },
  )
  .get("/logoff", ({ set }) => {
    set.status = 405;
    set.headers.allow = "POST";
    return { message: "Use POST to log out." };
  })
  .post(
    "/logoff",
    ({ body, request, set, redirect, cookie: { auth, csrf } }) => {
      if (
        !verifyCsrf(
          request,
          body.csrfToken,
          typeof csrf?.value === "string" ? csrf.value : undefined,
        )
      ) {
        set.status = 403;
        return { message: "Invalid CSRF token or Origin." };
      }
      if (auth?.value) {
        auth.remove();
      }

      return redirect(`${WEBROOT}/login`, 302);
    },
    { body: t.Object({ csrfToken: t.String() }) },
  )
  .get(
    "/account",
    async ({ user, redirect, locale, t, cookie: { csrf } }) => {
      if (!user) {
        return redirect(`${WEBROOT}/`, 302);
      }

      const userData = db.query("SELECT * FROM users WHERE id = ?").as(User).get(user.id);

      if (!userData) {
        return redirect(`${WEBROOT}/`, 302);
      }
      const csrfToken = ensureCsrfToken(csrf);

      return (
        <BaseHtml
          webroot={WEBROOT}
          title="ConvertX-CN | Account"
          locale={locale}
          csrfToken={csrfToken}
        >
          <>
            <Header
              webroot={WEBROOT}
              accountRegistration={ACCOUNT_REGISTRATION}
              allowUnauthenticated={ALLOW_UNAUTHENTICATED}
              hideHistory={HIDE_HISTORY}
              loggedIn
              locale={locale}
              t={t}
              csrfToken={csrfToken}
            />
            <main
              class={`
                w-full flex-1 px-2
                sm:px-4
              `}
            >
              <article class="article">
                <form method="post" class="flex flex-col gap-4">
                  <input type="hidden" name="csrfToken" value={csrfToken} />
                  <fieldset class="mb-4 flex flex-col gap-4">
                    <label class="flex flex-col gap-1">
                      <span safe>{t("auth", "email")}</span>
                      <input
                        type="email"
                        name="email"
                        class="rounded-sm bg-neutral-800 p-3"
                        placeholder={t("auth", "email")}
                        autocomplete="email"
                        value={userData.email}
                        required
                      />
                    </label>
                    <label class="flex flex-col gap-1">
                      <span safe>{t("auth", "newPassword")}</span>
                      <input
                        type="password"
                        name="newPassword"
                        class="rounded-sm bg-neutral-800 p-3"
                        placeholder={t("auth", "password")}
                        autocomplete="new-password"
                      />
                    </label>
                    <label class="flex flex-col gap-1">
                      <span safe>{t("auth", "currentPassword")}</span>
                      <input
                        type="password"
                        name="password"
                        class="rounded-sm bg-neutral-800 p-3"
                        placeholder={t("auth", "password")}
                        autocomplete="current-password"
                        required
                      />
                    </label>
                  </fieldset>
                  <div role="group">
                    <input
                      type="submit"
                      value={t("auth", "updateButton")}
                      class={`w-full btn-primary`}
                    />
                  </div>
                </form>
              </article>
            </main>
          </>
        </BaseHtml>
      );
    },
    {
      auth: true,
    },
  )
  .post(
    "/account",
    async function handler({ body, set, redirect, jwt, request, cookie: { auth, csrf } }) {
      if (
        !verifyCsrf(
          request,
          body.csrfToken,
          typeof csrf?.value === "string" ? csrf.value : undefined,
        )
      ) {
        set.status = 403;
        return { message: "Invalid CSRF token or Origin." };
      }
      if (!auth?.value) {
        return redirect(`${WEBROOT}/login`, 302);
      }

      const user = await jwt.verify(auth.value);
      if (!user) {
        return redirect(`${WEBROOT}/login`, 302);
      }
      const existingUser = db.query("SELECT * FROM users WHERE id = ?").as(User).get(user.id);

      if (!existingUser) {
        if (auth?.value) {
          auth.remove();
        }
        return redirect(`${WEBROOT}/login`, 302);
      }

      const validPassword = await Bun.password.verify(body.password, existingUser.password);

      if (!validPassword) {
        set.status = 403;
        return {
          message: "Invalid credentials.",
        };
      }

      const fields = [];
      const values = [];

      if (body.email) {
        const normalizedEmail = body.email.trim().toLowerCase();
        const existingUser = await db
          .query("SELECT id FROM users WHERE email = ?")
          .as(User)
          .get(normalizedEmail);
        if (existingUser && existingUser.id.toString() !== user.id) {
          set.status = 409;
          return { message: "Email already in use." };
        }
        fields.push("email");
        values.push(normalizedEmail);
      }
      if (body.newPassword) {
        fields.push("password");
        values.push(await Bun.password.hash(body.newPassword));
      }

      if (fields.length > 0) {
        db.query(
          `UPDATE users SET ${fields.map((field) => `${field}=?`).join(", ")} WHERE id=?`,
        ).run(...values, user.id);
      }

      return redirect(`${WEBROOT}/`, 302);
    },
    {
      body: t.Object({
        email: t.MaybeEmpty(t.String({ format: "email", maxLength: 254 })),
        csrfToken: t.String({ minLength: 16, maxLength: 256 }),
        newPassword: t.MaybeEmpty(t.String({ minLength: 8, maxLength: 128 })),
        password: t.String({ minLength: 1, maxLength: 128 }),
      }),
      cookie: "session",
    },
  );
