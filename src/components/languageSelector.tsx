import { supportedLocales, type SupportedLocale, type Translator } from "../i18n/index";

export const LanguageSelector = ({
  currentLocale,
  webroot = "",
  t,
}: {
  currentLocale: SupportedLocale;
  webroot?: string;
  t: Translator;
}) => {
  return (
    <div class="language-selector relative">
      <button
        type="button"
        class={`
          flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 transition-all
          hover:bg-[var(--glass-bg-hover)]
          active:scale-[0.98]
        `}
        style={{
          color: "var(--glass-text)",
        }}
        id="language-toggle"
        aria-label={t("nav", "language")}
        aria-expanded="false"
        aria-haspopup="true"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="1.5"
          stroke="currentColor"
          class="h-5 w-5"
          style={{ color: "var(--accent-500)" }}
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M10.5 21l5.25-11.25L21 21m-9-3h7.5M3 5.621a48.474 48.474 0 016-.371m0 0c1.12 0 2.233.038 3.334.114M9 5.25V3m3.334 2.364C11.176 10.658 7.69 15.08 3 17.502m9.334-12.138c.896.061 1.785.147 2.666.257m-4.589 8.495a18.023 18.023 0 01-3.827-5.802"
          />
        </svg>
        <span
          class={`
            hidden text-sm font-medium
            sm:inline
          `}
        >
          {t("nav", "language")}
        </span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="2"
          stroke="currentColor"
          class="h-3.5 w-3.5 transition-transform duration-200"
          style={{ color: "var(--glass-text-muted)" }}
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
      <ul
        id="language-dropdown"
        class={`
          theme-glass-dropdown fixed hidden max-h-[360px] min-w-[200px] flex-col overflow-y-auto
          p-1.5
        `}
        style={{
          backdropFilter: "var(--glass-blur)",
          WebkitBackdropFilter: "var(--glass-blur)",
          zIndex: 2147483647,
        }}
        role="menu"
      >
        {supportedLocales.map((locale) => (
          <li role="none">
            <button
              type="button"
              role="menuitem"
              class={`
                language-option flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left
                text-sm transition-all
                hover:bg-[var(--glass-bg-hover)]
                active:scale-[0.98] active:bg-[var(--glass-bg-active)]
                ${locale.code === currentLocale ? "bg-[var(--glass-bg-active)]" : ""}
              `}
              style={{
                color: locale.code === currentLocale ? "var(--accent-500)" : "var(--glass-text)",
              }}
              data-locale={locale.code}
              data-webroot={webroot}
            >
              {locale.code === currentLocale && (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke-width="2.5"
                  stroke="currentColor"
                  class="h-4 w-4 flex-shrink-0"
                  style={{ color: "var(--accent-500)" }}
                >
                  <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              )}
              <span
                class={`
                  font-medium
                  ${locale.code === currentLocale ? "" : "ml-6"}
                `}
              >
                {locale.nativeName}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};
