import {
  type SupportedLocale,
  type Translator,
  createTranslator,
  defaultLocale,
} from "../i18n/index";

export const SettingsButton = ({
  webroot = "",
  t = createTranslator(defaultLocale),
}: {
  locale?: SupportedLocale;
  webroot?: string;
  t?: Translator;
}) => {
  return (
    <a
      href={`${webroot}/settings`}
      class={`
        flex cursor-pointer items-center gap-1 text-accent-600 transition-all
        hover:text-accent-500
      `}
      aria-label={t("nav", "settings")}
      title={t("nav", "settings")}
    >
      {/* Heroicons: adjustments-horizontal (sliders) icon */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        stroke-width="1.5"
        stroke="currentColor"
        class="h-6 w-6"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75"
        />
      </svg>
    </a>
  );
};
