import { Elysia, t } from "elysia";
import { BaseHtml } from "../components/base";
import { Header } from "../components/header";
import db from "../db/db";
import { User } from "../db/types";
import { ACCOUNT_REGISTRATION, ALLOW_UNAUTHENTICATED, HIDE_HISTORY, WEBROOT } from "../helpers/env";
import { API_KEY_NAMES, getUserApiKey, getApiKeys } from "../helpers/apiKeys";
import { localeService } from "../i18n/service";
import { userService } from "./user";

// 儲存、更新或刪除使用者的 API Key
function saveUserApiKey(userId: number, keyName: string, keyValue: string): void {
  const existing = db
    .query("SELECT id FROM api_keys WHERE user_id = ? AND key_name = ?")
    .get(userId, keyName);

  // 如果值為空，則刪除該 API Key
  if (!keyValue || keyValue.trim() === "") {
    if (existing) {
      db.query("DELETE FROM api_keys WHERE user_id = ? AND key_name = ?").run(userId, keyName);
    }
    return;
  }

  // 否則儲存或更新
  const now = new Date().toISOString();
  if (existing) {
    db.query("UPDATE api_keys SET key_value = ?, updated_at = ? WHERE user_id = ? AND key_name = ?").run(
      keyValue,
      now,
      userId,
      keyName,
    );
  } else {
    db.query(
      "INSERT INTO api_keys (user_id, key_name, key_value, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
    ).run(userId, keyName, keyValue, now, now);
  }
}

// 重新導出 getApiKeys（向後相容）
export { getApiKeys };

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

      // 取得使用者目前的 API Keys
      const userId = Number(user.id);
      const openaiKey = getUserApiKey(userId, API_KEY_NAMES.OPENAI);
      const deepseekKey = getUserApiKey(userId, API_KEY_NAMES.DEEPSEEK);
      const otherLlmKey = getUserApiKey(userId, API_KEY_NAMES.OTHER_LLM);

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
                <header class="mb-6 text-xl font-bold" safe>
                  {t("settings", "title")}
                </header>
                <form id="api-keys-form" method="post" class="flex flex-col gap-4">
                  {/* OpenAI API Key */}
                  <label class="flex flex-col gap-1">
                    <span class="text-sm text-neutral-300">OpenAI API Key</span>
                    <input
                      type="password"
                      name="openai_api_key"
                      class="rounded-sm bg-neutral-800 p-3"
                      placeholder="sk-..."
                      value={openaiKey}
                    />
                  </label>

                  {/* DeepSeek API Key */}
                  <label class="flex flex-col gap-1">
                    <span class="text-sm text-neutral-300">DeepSeek API Key</span>
                    <input
                      type="password"
                      name="deepseek_api_key"
                      class="rounded-sm bg-neutral-800 p-3"
                      placeholder="sk-..."
                      value={deepseekKey}
                    />
                  </label>

                  {/* Other LLM API Key */}
                  <label class="flex flex-col gap-1">
                    <span class="text-sm text-neutral-300" safe>
                      {t("settings", "otherLlmApiKey")}
                    </span>
                    <input
                      type="password"
                      name="other_llm_api_key"
                      class="rounded-sm bg-neutral-800 p-3"
                      placeholder="..."
                      value={otherLlmKey}
                    />
                  </label>

                  <div id="settings-message" class="hidden rounded-sm p-3 text-center"></div>
                  <div role="group" class="mt-2">
                    <input
                      type="submit"
                      value={t("settings", "updateButton")}
                      class="w-full btn-primary"
                    />
                  </div>
                </form>
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
  .put(
    "/settings/api-keys",
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

      const userId = Number(user.id);

      // 儲存所有 API Keys（空值也會儲存，允許清空）
      if (body.openai_api_key !== undefined) {
        saveUserApiKey(userId, API_KEY_NAMES.OPENAI, body.openai_api_key);
      }
      if (body.deepseek_api_key !== undefined) {
        saveUserApiKey(userId, API_KEY_NAMES.DEEPSEEK, body.deepseek_api_key);
      }
      if (body.other_llm_api_key !== undefined) {
        saveUserApiKey(userId, API_KEY_NAMES.OTHER_LLM, body.other_llm_api_key);
      }

      set.status = 200;
      return { success: true, message: "API Keys updated successfully." };
    },
    {
      body: t.Object({
        openai_api_key: t.Optional(t.String()),
        deepseek_api_key: t.Optional(t.String()),
        other_llm_api_key: t.Optional(t.String()),
      }),
      cookie: "session",
    },
  );
