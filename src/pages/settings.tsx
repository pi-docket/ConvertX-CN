import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Elysia, t } from "elysia";
import { BaseHtml } from "../components/base";
import { Header } from "../components/header";
import db from "../db/db";
import { User } from "../db/types";
import { ACCOUNT_REGISTRATION, ALLOW_UNAUTHENTICATED, HIDE_HISTORY, WEBROOT } from "../helpers/env";
import { localeService } from "../i18n/service";
import { userService } from "./user";

// 取得目前的 JWT_SECRET
function getCurrentJwtSecret(): string {
  return process.env.JWT_SECRET ?? "(未設定 - 每次重啟會變更)";
}

// 檢查用戶是否為管理員（第一個註冊的用戶）
function isAdmin(userId: string | number): boolean {
  const id = typeof userId === "string" ? parseInt(userId, 10) : userId;
  return id === 1;
}

// 更新 .env 文件中的 JWT_SECRET
function updateJwtSecretInEnvFile(newSecret: string): { success: boolean; message: string } {
  try {
    // 嘗試多個可能的 .env 路徑
    const envPaths = [
      join(process.cwd(), ".env"),
      "/app/.env",
      join(process.cwd(), ".env.local"),
    ];

    let envPath: string | null = null;
    for (const path of envPaths) {
      if (existsSync(path)) {
        envPath = path;
        break;
      }
    }

    // 如果沒有找到 .env 文件，創建一個新的
    if (!envPath) {
      envPath = join(process.cwd(), ".env");
    }

    let envContent = existsSync(envPath) ? readFileSync(envPath, "utf-8") : "";

    // 檢查是否已存在 JWT_SECRET
    if (envContent.includes("JWT_SECRET=")) {
      // 替換現有的 JWT_SECRET
      envContent = envContent.replace(/^JWT_SECRET=.*$/m, `JWT_SECRET=${newSecret}`);
    } else {
      // 添加新的 JWT_SECRET
      envContent = envContent.trim() + `\nJWT_SECRET=${newSecret}\n`;
    }

    writeFileSync(envPath, envContent, "utf-8");

    // 同時更新當前進程的環境變數（但不會影響已初始化的 JWT 驗證）
    process.env.JWT_SECRET = newSecret;

    return {
      success: true,
      message: `JWT_SECRET 已更新。需要重啟服務才能生效。`,
    };
  } catch (error) {
    return {
      success: false,
      message: `更新 JWT_SECRET 失敗: ${error}`,
    };
  }
}

export const settings = new Elysia()
  .use(userService)
  .use(localeService)
  .get(
    "/settings",
    async ({ user, redirect, locale, t }) => {
      if (!user) {
        return redirect(`${WEBROOT}/login`, 302);
      }

      const userData = db.query("SELECT * FROM users WHERE id = ?").as(User).get(user.id);

      if (!userData) {
        return redirect(`${WEBROOT}/`, 302);
      }

      return (
        <BaseHtml webroot={WEBROOT} title="ConvertX-CN | Settings" locale={locale}>
          <>
            <Header
              webroot={WEBROOT}
              accountRegistration={ACCOUNT_REGISTRATION}
              allowUnauthenticated={ALLOW_UNAUTHENTICATED}
              hideHistory={HIDE_HISTORY}
              loggedIn
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
                <header class="mb-4 text-xl font-bold" safe>
                  {t("settings", "title")}
                </header>
                <form method="post" class="flex flex-col gap-4">
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
                      <span safe>{t("settings", "newPassword")}</span>
                      <input
                        type="password"
                        name="newPassword"
                        class="rounded-sm bg-neutral-800 p-3"
                        placeholder={t("settings", "newPasswordPlaceholder")}
                        autocomplete="new-password"
                      />
                      <span class="text-sm text-neutral-400" safe>
                        {t("settings", "passwordHint")}
                      </span>
                    </label>
                    <label class="flex flex-col gap-1">
                      <span safe>{t("auth", "currentPassword")}</span>
                      <input
                        type="password"
                        name="password"
                        class="rounded-sm bg-neutral-800 p-3"
                        placeholder={t("auth", "currentPassword")}
                        autocomplete="current-password"
                        required
                      />
                    </label>
                  </fieldset>
                  <div id="settings-message" class="hidden rounded-sm p-3 text-center"></div>
                  <div role="group">
                    <input
                      type="submit"
                      value={t("auth", "updateButton")}
                      class="w-full btn-primary"
                    />
                  </div>
                </form>

                {/* JWT_SECRET 設定區塊 - 僅管理員可見 */}
                {isAdmin(user.id) && (
                  <>
                    <hr class="my-6 border-neutral-700" />
                    <header class="mb-4 text-xl font-bold" safe>
                      {t("settings", "jwtSecretTitle")}
                    </header>
                    <form id="jwt-secret-form" method="post" class="flex flex-col gap-4">
                      <input type="hidden" name="action" value="updateJwtSecret" />
                      <label class="flex flex-col gap-1">
                        <span safe>{t("settings", "currentJwtSecret")}</span>
                        <div class="flex gap-2">
                          <input
                            type="password"
                            id="current-jwt-secret"
                            class="flex-1 rounded-sm bg-neutral-700 p-3"
                            value={getCurrentJwtSecret()}
                            readonly
                          />
                          <button
                            type="button"
                            id="toggle-jwt-visibility"
                            class="rounded-sm bg-neutral-600 px-4 hover:bg-neutral-500"
                            title={t("settings", "toggleVisibility")}
                          >
                            👁
                          </button>
                        </div>
                        <span class="text-sm text-neutral-400" safe>
                          {t("settings", "jwtSecretHint")}
                        </span>
                      </label>
                      <label class="flex flex-col gap-1">
                        <span safe>{t("settings", "newJwtSecret")}</span>
                        <div class="flex gap-2">
                          <input
                            type="text"
                            name="newJwtSecret"
                            class="flex-1 rounded-sm bg-neutral-800 p-3"
                            placeholder={t("settings", "newJwtSecretPlaceholder")}
                            minlength={32}
                          />
                          <button
                            type="button"
                            id="generate-jwt-secret"
                            class="rounded-sm bg-blue-600 px-4 hover:bg-blue-500"
                            title={t("settings", "generateRandom")}
                          >
                            🔄
                          </button>
                        </div>
                        <span class="text-sm text-neutral-400" safe>
                          {t("settings", "jwtSecretLengthHint")}
                        </span>
                      </label>
                      <label class="flex flex-col gap-1">
                        <span safe>{t("auth", "currentPassword")}</span>
                        <input
                          type="password"
                          name="adminPassword"
                          class="rounded-sm bg-neutral-800 p-3"
                          placeholder={t("auth", "currentPassword")}
                          autocomplete="current-password"
                          required
                        />
                      </label>
                      <div
                        id="jwt-settings-message"
                        class="hidden rounded-sm p-3 text-center"
                      ></div>
                      <div class="rounded-sm border border-yellow-600 bg-yellow-900/30 p-3 text-sm text-yellow-200">
                        ⚠️ <span safe>{t("settings", "jwtSecretWarning")}</span>
                      </div>
                      <div role="group">
                        <input
                          type="submit"
                          value={t("settings", "updateJwtSecret")}
                          class="w-full btn-primary"
                        />
                      </div>
                    </form>
                  </>
                )}
              </article>
            </main>
            <script src={`${WEBROOT}/settings.js`} defer />
          </>
        </BaseHtml>
      );
    },
    {
      auth: true,
    },
  )
  .post(
    "/settings",
    async function handler({ body, set, jwt, cookie: { auth } }) {
      if (!auth?.value) {
        set.status = 401;
        return { success: false, message: "Unauthorized" };
      }

      const user = await jwt.verify(auth.value);
      if (!user) {
        set.status = 401;
        return { success: false, message: "Unauthorized" };
      }

      const existingUser = db.query("SELECT * FROM users WHERE id = ?").as(User).get(user.id);

      if (!existingUser) {
        set.status = 404;
        return { success: false, message: "User not found" };
      }

      const validPassword = await Bun.password.verify(body.password, existingUser.password);

      if (!validPassword) {
        set.status = 403;
        return { success: false, message: "Invalid credentials." };
      }

      const fields: string[] = [];
      const values: string[] = [];

      if (body.email && body.email !== existingUser.email) {
        const emailExists = db
          .query("SELECT id FROM users WHERE email = ? AND id != ?")
          .get(body.email, user.id);
        if (emailExists) {
          set.status = 409;
          return { success: false, message: "Email already in use." };
        }
        fields.push("email");
        values.push(body.email);
      }

      if (body.newPassword && body.newPassword.trim() !== "") {
        fields.push("password");
        values.push(await Bun.password.hash(body.newPassword));
      }

      if (fields.length > 0) {
        db.query(
          `UPDATE users SET ${fields.map((field) => `${field}=?`).join(", ")} WHERE id=?`,
        ).run(...values, user.id);
      }

      set.status = 200;
      return { success: true, message: "Settings updated successfully." };
    },
    {
      body: t.Object({
        email: t.MaybeEmpty(t.String()),
        newPassword: t.MaybeEmpty(t.String()),
        password: t.String(),
      }),
      cookie: "session",
    },
  )
  .post(
    "/settings/jwt-secret",
    async function handler({ body, set, jwt, cookie: { auth } }) {
      if (!auth?.value) {
        set.status = 401;
        return { success: false, message: "Unauthorized" };
      }

      const user = await jwt.verify(auth.value);
      if (!user) {
        set.status = 401;
        return { success: false, message: "Unauthorized" };
      }

      // 只有管理員（ID=1）可以修改 JWT_SECRET
      if (!isAdmin(user.id)) {
        set.status = 403;
        return { success: false, message: "Only admin can modify JWT_SECRET" };
      }

      const existingUser = db.query("SELECT * FROM users WHERE id = ?").as(User).get(user.id);

      if (!existingUser) {
        set.status = 404;
        return { success: false, message: "User not found" };
      }

      // 驗證管理員密碼
      const validPassword = await Bun.password.verify(body.adminPassword, existingUser.password);

      if (!validPassword) {
        set.status = 403;
        return { success: false, message: "Invalid credentials." };
      }

      // 驗證新 JWT_SECRET 長度
      if (!body.newJwtSecret || body.newJwtSecret.trim().length < 32) {
        set.status = 400;
        return { success: false, message: "JWT_SECRET must be at least 32 characters." };
      }

      // 更新 JWT_SECRET
      const result = updateJwtSecretInEnvFile(body.newJwtSecret.trim());

      if (result.success) {
        set.status = 200;
        return { success: true, message: result.message };
      } else {
        set.status = 500;
        return { success: false, message: result.message };
      }
    },
    {
      body: t.Object({
        newJwtSecret: t.String(),
        adminPassword: t.String(),
      }),
      cookie: "session",
    },
  )
  .get(
    "/settings/jwt-secret",
    async function handler({ set, jwt, cookie: { auth } }) {
      if (!auth?.value) {
        set.status = 401;
        return { success: false, message: "Unauthorized" };
      }

      const user = await jwt.verify(auth.value);
      if (!user) {
        set.status = 401;
        return { success: false, message: "Unauthorized" };
      }

      // 只有管理員（ID=1）可以查看 JWT_SECRET
      if (!isAdmin(user.id)) {
        set.status = 403;
        return { success: false, message: "Only admin can view JWT_SECRET" };
      }

      set.status = 200;
      return {
        success: true,
        jwtSecret: getCurrentJwtSecret(),
        isSet: !!process.env.JWT_SECRET,
      };
    },
    {
      cookie: "session",
    },
  );
