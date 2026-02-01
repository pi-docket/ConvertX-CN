import { Elysia, t } from "elysia";
import { BaseHtml } from "../components/base";
import { Header } from "../components/header";
import db from "../db/db";
import { User } from "../db/types";
import { ACCOUNT_REGISTRATION, ALLOW_UNAUTHENTICATED, HIDE_HISTORY, WEBROOT } from "../helpers/env";
import { API_KEY_NAMES, getUserApiKey, getApiKeys } from "../helpers/apiKeys";
import {
  getUserProcessingMode,
  setUserProcessingMode,
  checkVlmAvailability,
  getEffectiveProcessingMode,
  type ProcessingMode,
} from "../helpers/processingMode";
import {
  getUserTranslationProvider,
  setUserTranslationProvider,
  type TranslationProviderType,
} from "../helpers/translation";
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
    db.query(
      "UPDATE api_keys SET key_value = ?, updated_at = ? WHERE user_id = ? AND key_name = ?",
    ).run(keyValue, now, userId, keyName);
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

      // 取得使用者的處理模式設定
      const processingMode = getUserProcessingMode(userId);

      // 取得使用者的翻譯服務設定
      const translationProvider = getUserTranslationProvider(userId);

      // 檢查 VLM 可用性
      const vlmStatus = await checkVlmAvailability();

      // 取得有效的處理模式（考慮自動回退）
      const effectiveMode = await getEffectiveProcessingMode(userId);

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
            {/* Fixed Status Banner - 頁面頂部固定提示列 */}
            <div
              id="settings-status-banner"
              class={`
                fixed top-0 right-0 left-0 z-50 hidden px-4 py-3 text-center text-sm font-medium
                shadow-lg
              `}
              data-success={t("settings", "updateSuccess")}
              data-error={t("settings", "updateError")}
              data-updating={t("settings", "updating")}
              data-no-changes={t("settings", "noChanges")}
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
                <form id="api-keys-form" class="flex flex-col gap-6" onsubmit="return false;">
                  {/* API Keys Section */}
                  <section class="flex flex-col gap-4">
                    <h2 class="text-sm font-medium text-neutral-400" safe>
                      {t("settings", "apiKeysSection")}
                    </h2>

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
                  </section>

                  {/* Processing Mode Section */}
                  <section class="flex flex-col gap-3 border-t border-neutral-800 pt-6">
                    <div class="flex items-center justify-between">
                      <h2 class="text-sm font-medium text-neutral-400" safe>
                        {t("settings", "mineruProcessingMode")}
                      </h2>
                      {/* Effective mode indicator */}
                      <span class="text-xs text-neutral-500">
                        <span safe>{t("settings", "effectiveMode")}</span>:{" "}
                        <span class="font-medium text-neutral-300">
                          {effectiveMode.mode === "pipeline" ? "Pipeline" : "VLM"}
                        </span>
                      </span>
                    </div>

                    {/* Fallback notice - only show when VLM is selected but unavailable */}
                    {effectiveMode.isAutoFallback && (
                      <div class="rounded-md bg-neutral-800/30 px-3 py-2 text-xs text-neutral-500">
                        <span safe>{t("settings", "vlmFallbackActive")}</span>
                      </div>
                    )}

                    <div class="flex flex-col gap-2">
                      {/* Pipeline Lite Option */}
                      <label
                        class={`
                          flex cursor-pointer items-start gap-3 rounded-md p-3 transition-colors
                          ${effectiveMode.mode === "pipeline" ? "bg-neutral-800" : "bg-neutral-800/30 hover:bg-neutral-800/50"}
                        `}
                      >
                        <input
                          type="radio"
                          name="processing_mode"
                          value="pipeline"
                          checked={processingMode === "pipeline"}
                          class="mt-0.5 h-4 w-4 accent-neutral-400"
                        />
                        <div class="flex flex-col gap-0.5">
                          <span class="text-sm font-medium text-neutral-200" safe>
                            {t("settings", "pipelineMode")}
                          </span>
                          <span class="text-xs text-neutral-500" safe>
                            {t("settings", "pipelineModeDesc")}
                          </span>
                          <span class="mt-0.5 text-xs text-neutral-600" safe>
                            {t("settings", "pipelineEngine")}
                          </span>
                        </div>
                      </label>

                      {/* VLM Option */}
                      <label
                        class={`
                          flex cursor-pointer items-start gap-3 rounded-md p-3 transition-colors
                          ${effectiveMode.mode === "vlm" ? "bg-neutral-800" : "bg-neutral-800/30 hover:bg-neutral-800/50"}
                        `}
                      >
                        <input
                          type="radio"
                          name="processing_mode"
                          value="vlm"
                          checked={processingMode === "vlm"}
                          class="mt-0.5 h-4 w-4 accent-neutral-400"
                        />
                        <div class="flex flex-col gap-0.5">
                          <span class="text-sm font-medium text-neutral-200" safe>
                            {t("settings", "vlmMode")}
                          </span>
                          <span class="text-xs text-neutral-500" safe>
                            {t("settings", "vlmModeDesc")}
                          </span>
                          <span class="mt-0.5 text-xs text-neutral-600" safe>
                            {t("settings", "vlmEngine")}
                          </span>
                          {/* VLM Status - subtle inline indicator */}
                          <span
                            class={`
                              mt-1 text-xs
                              ${vlmStatus.available ? "text-neutral-500" : "text-neutral-600"}
                            `}
                            safe
                          >
                            {vlmStatus.available
                              ? t("settings", "vlmStatusAvailable")
                              : t("settings", "vlmStatusUnavailable")}
                          </span>
                        </div>
                      </label>
                    </div>
                  </section>

                  {/* Translation Service Section (BabelDOC) */}
                  <section class="flex flex-col gap-3 border-t border-neutral-800 pt-6">
                    <h2 class="text-sm font-medium text-neutral-400" safe>
                      {t("settings", "translationService")}
                    </h2>
                    <p class="text-xs text-neutral-500" safe>
                      {t("settings", "translationServiceDesc")}
                    </p>

                    <div class="flex flex-col gap-2">
                      {/* Local Translation Option */}
                      <label
                        class={`
                          flex cursor-pointer items-start gap-3 rounded-md p-3 transition-colors
                          ${translationProvider === "local" ? "bg-neutral-800" : "bg-neutral-800/30 hover:bg-neutral-800/50"}
                        `}
                      >
                        <input
                          type="radio"
                          name="translation_provider"
                          value="local"
                          checked={translationProvider === "local"}
                          class="mt-0.5 h-4 w-4 accent-neutral-400"
                        />
                        <div class="flex flex-col gap-0.5">
                          <span class="text-sm font-medium text-neutral-200" safe>
                            {t("settings", "localTranslation")}
                          </span>
                          <span class="text-xs text-neutral-500" safe>
                            {t("settings", "localTranslationDesc")}
                          </span>
                        </div>
                      </label>

                      {/* OpenAI Translation Option */}
                      <label
                        class={`
                          flex cursor-pointer items-start gap-3 rounded-md p-3 transition-colors
                          ${translationProvider === "openai" ? "bg-neutral-800" : "bg-neutral-800/30 hover:bg-neutral-800/50"}
                        `}
                      >
                        <input
                          type="radio"
                          name="translation_provider"
                          value="openai"
                          checked={translationProvider === "openai"}
                          class="mt-0.5 h-4 w-4 accent-neutral-400"
                        />
                        <div class="flex flex-col gap-0.5">
                          <span class="text-sm font-medium text-neutral-200">OpenAI</span>
                          <span class="text-xs text-neutral-500" safe>
                            {t("settings", "openaiTranslationDesc")}
                          </span>
                        </div>
                      </label>

                      {/* DeepSeek Translation Option */}
                      <label
                        class={`
                          flex cursor-pointer items-start gap-3 rounded-md p-3 transition-colors
                          ${translationProvider === "deepseek" ? "bg-neutral-800" : "bg-neutral-800/30 hover:bg-neutral-800/50"}
                        `}
                      >
                        <input
                          type="radio"
                          name="translation_provider"
                          value="deepseek"
                          checked={translationProvider === "deepseek"}
                          class="mt-0.5 h-4 w-4 accent-neutral-400"
                        />
                        <div class="flex flex-col gap-0.5">
                          <span class="text-sm font-medium text-neutral-200">DeepSeek</span>
                          <span class="text-xs text-neutral-500" safe>
                            {t("settings", "deepseekTranslationDesc")}
                          </span>
                        </div>
                      </label>

                      {/* Custom API Translation Option */}
                      <label
                        class={`
                          flex cursor-pointer items-start gap-3 rounded-md p-3 transition-colors
                          ${translationProvider === "custom" ? "bg-neutral-800" : "bg-neutral-800/30 hover:bg-neutral-800/50"}
                        `}
                      >
                        <input
                          type="radio"
                          name="translation_provider"
                          value="custom"
                          checked={translationProvider === "custom"}
                          class="mt-0.5 h-4 w-4 accent-neutral-400"
                        />
                        <div class="flex flex-col gap-0.5">
                          <span class="text-sm font-medium text-neutral-200" safe>
                            {t("settings", "customApiTranslation")}
                          </span>
                          <span class="text-xs text-neutral-500" safe>
                            {t("settings", "customApiTranslationDesc")}
                          </span>
                        </div>
                      </label>
                    </div>
                  </section>

                  {/* Submit section - 簡化設計，狀態顯示在頁面頂部固定提示列 */}
                  <div class="border-t border-neutral-800 pt-6">
                    <input
                      type="submit"
                      value={t("settings", "updateButton")}
                      class="w-full btn-primary cursor-pointer py-3 text-base font-medium"
                    />
                  </div>
                  {/* Hidden field to store initial values for change detection */}
                  <input type="hidden" id="initial-processing-mode" value={processingMode} />
                  <input
                    type="hidden"
                    id="initial-translation-provider"
                    value={translationProvider}
                  />
                  <input type="hidden" id="initial-openai-key" value={openaiKey} />
                  <input type="hidden" id="initial-deepseek-key" value={deepseekKey} />
                  <input type="hidden" id="initial-other-llm-key" value={otherLlmKey} />
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

      // 儲存處理模式設定
      if (body.processing_mode !== undefined) {
        const mode = body.processing_mode === "vlm" ? "vlm" : "pipeline";
        setUserProcessingMode(userId, mode as ProcessingMode);
      }

      // 儲存翻譯服務設定
      if (body.translation_provider !== undefined) {
        const provider = body.translation_provider as TranslationProviderType;
        if (["local", "openai", "deepseek", "custom"].includes(provider)) {
          setUserTranslationProvider(userId, provider);
        }
      }

      set.status = 200;
      return { success: true, message: "Settings updated successfully." };
    },
    {
      body: t.Object({
        openai_api_key: t.Optional(t.String()),
        deepseek_api_key: t.Optional(t.String()),
        other_llm_api_key: t.Optional(t.String()),
        processing_mode: t.Optional(t.String()),
        translation_provider: t.Optional(t.String()),
      }),
      cookie: "session",
    },
  );
