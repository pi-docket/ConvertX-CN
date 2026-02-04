import {
  type SupportedLocale,
  type Translator,
  createTranslator,
  defaultLocale,
} from "../i18n/index";
import { LanguageSelector } from "./languageSelector";
import { ThemeToggle } from "./themeToggle";

export const Header = ({
  loggedIn,
  accountRegistration,
  allowUnauthenticated,
  hideHistory,
  webroot = "",
  locale = defaultLocale,
  t = createTranslator(defaultLocale),
}: {
  loggedIn?: boolean;
  accountRegistration?: boolean;
  allowUnauthenticated?: boolean;
  hideHistory?: boolean;
  webroot?: string;
  locale?: SupportedLocale;
  t?: Translator;
}) => {
  let rightNav: JSX.Element;
  if (loggedIn) {
    rightNav = (
      <ul class="flex items-center gap-4">
        {!hideHistory && (
          <li>
            <a
              class={`
                text-accent-600 transition-all
                hover:text-accent-500 hover:underline
              `}
              href={`${webroot}/history`}
              safe
            >
              {t("nav", "history")}
            </a>
          </li>
        )}
        {!allowUnauthenticated ? (
          <li>
            <a
              class={`
                text-accent-600 transition-all
                hover:text-accent-500 hover:underline
              `}
              href={`${webroot}/account`}
              safe
            >
              {t("nav", "account")}
            </a>
          </li>
        ) : null}
        {!allowUnauthenticated ? (
          <li>
            <a
              class={`
                text-accent-600 transition-all
                hover:text-accent-500 hover:underline
              `}
              href={`${webroot}/logoff`}
              safe
            >
              {t("nav", "logout")}
            </a>
          </li>
        ) : null}
        <li>
          <ThemeToggle locale={locale} t={t} />
        </li>
        <li>
          <LanguageSelector currentLocale={locale} webroot={webroot} t={t} />
        </li>
      </ul>
    );
  } else {
    rightNav = (
      <ul class="flex items-center gap-4">
        <li>
          <a
            class={`
              text-accent-600 transition-all
              hover:text-accent-500 hover:underline
            `}
            href={`${webroot}/login`}
            safe
          >
            {t("nav", "login")}
          </a>
        </li>
        {accountRegistration ? (
          <li>
            <a
              class={`
                text-accent-600 transition-all
                hover:text-accent-500 hover:underline
              `}
              href={`${webroot}/register`}
              safe
            >
              {t("nav", "register")}
            </a>
          </li>
        ) : null}
        <li>
          <ThemeToggle locale={locale} t={t} />
        </li>
        <li>
          <LanguageSelector currentLocale={locale} webroot={webroot} t={t} />
        </li>
      </ul>
    );
  }

  return (
    <header class="w-full p-4">
      <nav
        class="mx-auto flex max-w-4xl items-center justify-between rounded-2xl p-4"
        style={{
          background: "var(--glass-bg)",
          backdropFilter: "var(--glass-blur)",
          WebkitBackdropFilter: "var(--glass-blur)",
          border: "1px solid var(--glass-border)",
          boxShadow: "var(--glass-shadow), var(--glass-inset-highlight)",
        }}
      >
        <ul class="flex items-center">
          <li>
            <strong>
              <a href={`${webroot}/`} class="text-neutral-100">
                ConvertX-CN
              </a>
            </strong>
          </li>
        </ul>
        {rightNav}
      </nav>
    </header>
  );
};
