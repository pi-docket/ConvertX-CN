import {
  type SupportedLocale,
  type Translator,
  createTranslator,
  defaultLocale,
} from "../i18n/index";

// ============================================================================
// Theme Toggle Component with Color Picker Dropdown
// ============================================================================
// Features:
// 1. Light/Dark mode toggle button
// 2. Dropdown arrow to reveal color swatches
// 3. Click on swatch to instantly apply color theme
// 4. Supports solid, gradient, neon, and custom colors
// ============================================================================

// Theme i18n keys type
type ThemeI18nKey =
  | "colorGreen"
  | "colorBlue"
  | "colorPurple"
  | "colorPink"
  | "colorOrange"
  | "colorTeal"
  | "colorGray"
  | "colorYellow"
  | "colorAurora"
  | "colorSunset"
  | "colorOcean"
  | "colorForest"
  | "colorFire"
  | "colorNeonCyan"
  | "colorNeonPink"
  | "colorNeonPurple"
  | "colorNeonGreen"
  | "colorRainbow";

// Color definitions for swatches (matching colors.css)
interface ThemeColor {
  id: string;
  style: "solid" | "gradient" | "neon";
  color?: string;
  gradient?: string;
  i18nKey: ThemeI18nKey;
}

const THEME_COLORS: ThemeColor[] = [
  // Solid Colors
  { id: "green", style: "solid", color: "oklch(65% 0.2 131)", i18nKey: "colorGreen" },
  { id: "blue", style: "solid", color: "oklch(62% 0.21 250)", i18nKey: "colorBlue" },
  { id: "purple", style: "solid", color: "oklch(62% 0.22 300)", i18nKey: "colorPurple" },
  { id: "pink", style: "solid", color: "oklch(68% 0.22 350)", i18nKey: "colorPink" },
  { id: "orange", style: "solid", color: "oklch(70% 0.2 50)", i18nKey: "colorOrange" },
  { id: "teal", style: "solid", color: "oklch(65% 0.15 190)", i18nKey: "colorTeal" },
  { id: "gray", style: "solid", color: "oklch(55% 0.02 260)", i18nKey: "colorGray" },
  { id: "yellow", style: "solid", color: "oklch(75% 0.18 95)", i18nKey: "colorYellow" },
  // Gradient Colors
  {
    id: "aurora",
    style: "gradient",
    gradient:
      "linear-gradient(135deg, oklch(65% 0.2 250), oklch(62% 0.22 300), oklch(70% 0.2 150))",
    i18nKey: "colorAurora",
  },
  {
    id: "sunset",
    style: "gradient",
    gradient:
      "linear-gradient(135deg, oklch(70% 0.2 50), oklch(68% 0.22 350), oklch(62% 0.22 300))",
    i18nKey: "colorSunset",
  },
  {
    id: "ocean",
    style: "gradient",
    gradient:
      "linear-gradient(135deg, oklch(65% 0.15 190), oklch(62% 0.18 220), oklch(60% 0.2 250))",
    i18nKey: "colorOcean",
  },
  {
    id: "forest",
    style: "gradient",
    gradient:
      "linear-gradient(135deg, oklch(55% 0.15 150), oklch(60% 0.18 130), oklch(50% 0.12 100))",
    i18nKey: "colorForest",
  },
  {
    id: "fire",
    style: "gradient",
    gradient: "linear-gradient(135deg, oklch(65% 0.25 30), oklch(70% 0.22 50), oklch(60% 0.2 15))",
    i18nKey: "colorFire",
  },
  // Neon Colors
  { id: "neon-cyan", style: "neon", color: "oklch(80% 0.35 180)", i18nKey: "colorNeonCyan" },
  { id: "neon-pink", style: "neon", color: "oklch(75% 0.35 330)", i18nKey: "colorNeonPink" },
  { id: "neon-purple", style: "neon", color: "oklch(70% 0.32 290)", i18nKey: "colorNeonPurple" },
  { id: "neon-green", style: "neon", color: "oklch(80% 0.35 140)", i18nKey: "colorNeonGreen" },
  // Rainbow
  {
    id: "rainbow",
    style: "neon",
    gradient:
      "linear-gradient(90deg, oklch(75% 0.28 0), oklch(75% 0.28 60), oklch(75% 0.28 120), oklch(75% 0.28 180), oklch(75% 0.28 240), oklch(75% 0.28 300))",
    i18nKey: "colorRainbow",
  },
];

export const ThemeToggle = ({
  t = createTranslator(defaultLocale),
}: {
  locale?: SupportedLocale;
  t?: Translator;
}) => {
  return (
    <div id="theme-picker-container" class="relative">
      {/* Main toggle button with dropdown arrow */}
      <div class="flex items-center gap-1">
        {/* Mode toggle button (light/dark) */}
        <button
          type="button"
          id="theme-toggle"
          class={`
            flex items-center text-accent-600 transition-all
            hover:text-accent-500
          `}
          aria-label={t("theme", "modeLabel")}
          title={t("theme", "modeLabel")}
        >
          {/* Sun icon (shown in dark mode, click to switch to light) */}
          <svg
            id="theme-icon-light"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke="currentColor"
            class="hidden h-6 w-6"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z"
            />
          </svg>
          {/* Moon icon (shown in light mode, click to switch to dark) */}
          <svg
            id="theme-icon-dark"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke="currentColor"
            class="hidden h-6 w-6"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z"
            />
          </svg>
        </button>

        {/* Dropdown arrow button */}
        <button
          type="button"
          id="theme-dropdown-toggle"
          class={`
            flex items-center p-1 text-accent-600 transition-all
            hover:text-accent-500
          `}
          aria-label={t("theme", "pickerTitle")}
          aria-expanded="false"
          aria-haspopup="true"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="2"
            stroke="currentColor"
            class="h-4 w-4 transition-transform duration-200"
            id="theme-dropdown-arrow"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </button>
      </div>

      {/* Color picker dropdown */}
      <div
        id="theme-color-dropdown"
        class={`
          absolute top-full right-0 z-50 mt-2 min-w-[200px] rounded-lg border border-neutral-700
          bg-neutral-900 p-3 shadow-xl
        `}
        style={{
          display: "none",
          opacity: 0,
          transform: "scale(0.95)",
          transition: "opacity 200ms ease-out, transform 200ms ease-out",
        }}
        role="menu"
        aria-orientation="vertical"
      >
        {/* Color swatches grid */}
        <div class="grid grid-cols-5 gap-2" role="group" aria-label={t("theme", "pickerTitle")}>
          {THEME_COLORS.map((colorDef) => (
            <button
              type="button"
              class={`
                theme-color-swatch h-8 w-8 cursor-pointer rounded-md border-2 border-transparent
                transition-all duration-150
                hover:scale-110 hover:border-white
                focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 focus:ring-offset-neutral-900
                focus:outline-none
              `}
              data-color={colorDef.id}
              data-style={colorDef.style}
              style={{
                background: colorDef.gradient || colorDef.color,
                boxShadow:
                  colorDef.style === "neon"
                    ? `0 0 10px ${colorDef.color || "oklch(75% 0.3 180)"}`
                    : undefined,
              }}
              aria-label={t("theme", colorDef.i18nKey)}
              title={t("theme", colorDef.i18nKey)}
              role="menuitem"
            />
          ))}
        </div>

        {/* Divider */}
        <div class="my-3 border-t border-neutral-700" />

        {/* Custom color picker */}
        <div class="flex items-center gap-2">
          <label class="group flex flex-1 cursor-pointer items-center gap-2">
            <input
              type="color"
              id="theme-custom-color"
              class={`
                h-8 w-8 cursor-pointer rounded-md border-2 border-neutral-600 transition-colors
                hover:border-accent-500
              `}
              title={t("theme", "customColorHint")}
            />
            <span
              class={`
                text-sm text-neutral-400 transition-colors
                group-hover:text-neutral-300
              `}
<<<<<<< Updated upstream
=======
              safe
>>>>>>> Stashed changes
            >
              {t("theme", "customColor")}
            </span>
          </label>
        </div>
      </div>
    </div>
  );
};
