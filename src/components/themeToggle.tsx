import {
  type SupportedLocale,
  type Translator,
  createTranslator,
  defaultLocale,
} from "../i18n/index";

// ============================================================================
// Theme Toggle Component with Figma/Linear Style Color Picker
// ============================================================================
// v2.0 - Advanced Color Picker
// Features:
// 1. Light/Dark mode toggle button
// 2. Dropdown with preset color swatches (glow on hover)
// 3. Advanced picker: Hue Ring + SL Panel + Alpha + HEX
// 4. Instant theme application without page refresh
// 5. OKLCH color space integration
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

// Screen theme i18n keys type
type ScreenThemeI18nKey =
  | "screenThemeNone"
  | "screenThemeAurora"
  | "screenThemeSunset"
  | "screenThemeOcean"
  | "screenThemeNeonNight"
  | "screenThemeMinimalPro"
  | "screenThemeLavender"
  | "screenThemeMidnight"
  | "screenThemeTwilight"
  | "screenThemeForest"
  | "screenThemePeach"
  | "screenThemeCyber";

// Screen theme definitions (full-screen background themes)
interface ScreenTheme {
  id: string;
  preview: string; // CSS gradient for preview swatch
  i18nKey: ScreenThemeI18nKey;
}

const SCREEN_THEMES: ScreenTheme[] = [
  {
    id: "none",
    preview: "linear-gradient(135deg, var(--neutral-700), var(--neutral-800))",
    i18nKey: "screenThemeNone",
  },
  {
    id: "aurora",
    preview: "linear-gradient(135deg, oklch(50% 0.15 280), oklch(55% 0.18 200), oklch(60% 0.2 150))",
    i18nKey: "screenThemeAurora",
  },
  {
    id: "sunset",
    preview: "linear-gradient(135deg, oklch(65% 0.18 350), oklch(70% 0.2 40), oklch(75% 0.18 70))",
    i18nKey: "screenThemeSunset",
  },
  {
    id: "ocean",
    preview: "linear-gradient(135deg, oklch(50% 0.15 230), oklch(55% 0.15 200), oklch(60% 0.12 180))",
    i18nKey: "screenThemeOcean",
  },
  {
    id: "neon-night",
    preview: "linear-gradient(135deg, oklch(25% 0.1 280), oklch(30% 0.15 300), oklch(25% 0.1 180))",
    i18nKey: "screenThemeNeonNight",
  },
  {
    id: "minimal-pro",
    preview: "linear-gradient(180deg, oklch(30% 0.01 260), oklch(25% 0.01 260))",
    i18nKey: "screenThemeMinimalPro",
  },
  {
    id: "lavender",
    preview: "linear-gradient(135deg, oklch(70% 0.15 300), oklch(75% 0.18 330), oklch(80% 0.12 350))",
    i18nKey: "screenThemeLavender",
  },
  {
    id: "midnight",
    preview: "linear-gradient(180deg, oklch(15% 0.08 260), oklch(20% 0.1 280), oklch(12% 0.06 240))",
    i18nKey: "screenThemeMidnight",
  },
  {
    id: "twilight",
    preview: "linear-gradient(135deg, oklch(40% 0.12 280), oklch(35% 0.15 300), oklch(30% 0.1 320))",
    i18nKey: "screenThemeTwilight",
  },
  {
    id: "forest",
    preview: "linear-gradient(180deg, oklch(35% 0.1 150), oklch(40% 0.12 140), oklch(30% 0.08 160))",
    i18nKey: "screenThemeForest",
  },
  {
    id: "peach",
    preview: "linear-gradient(135deg, oklch(80% 0.12 50), oklch(85% 0.15 40), oklch(90% 0.1 30))",
    i18nKey: "screenThemePeach",
  },
  {
    id: "cyber",
    preview: "linear-gradient(135deg, oklch(45% 0.2 180), oklch(40% 0.18 200), oklch(35% 0.15 220))",
    i18nKey: "screenThemeCyber",
  },
];

// Color definitions for swatches (matching colors.css)
interface ThemeColor {
  id: string;
  style: "solid" | "gradient" | "neon";
  color?: string;
  gradient?: string;
  i18nKey: ThemeI18nKey;
  hue?: number;
}

const THEME_COLORS: ThemeColor[] = [
  // Solid Colors
  { id: "green", style: "solid", color: "oklch(65% 0.2 131)", hue: 131, i18nKey: "colorGreen" },
  { id: "blue", style: "solid", color: "oklch(62% 0.21 250)", hue: 250, i18nKey: "colorBlue" },
  { id: "purple", style: "solid", color: "oklch(62% 0.22 300)", hue: 300, i18nKey: "colorPurple" },
  { id: "pink", style: "solid", color: "oklch(68% 0.22 350)", hue: 350, i18nKey: "colorPink" },
  { id: "orange", style: "solid", color: "oklch(70% 0.2 50)", hue: 50, i18nKey: "colorOrange" },
  { id: "teal", style: "solid", color: "oklch(65% 0.15 190)", hue: 190, i18nKey: "colorTeal" },
  { id: "gray", style: "solid", color: "oklch(55% 0.02 260)", hue: 260, i18nKey: "colorGray" },
  { id: "yellow", style: "solid", color: "oklch(75% 0.18 95)", hue: 95, i18nKey: "colorYellow" },
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
  {
    id: "neon-cyan",
    style: "neon",
    color: "oklch(80% 0.35 180)",
    hue: 180,
    i18nKey: "colorNeonCyan",
  },
  {
    id: "neon-pink",
    style: "neon",
    color: "oklch(75% 0.35 330)",
    hue: 330,
    i18nKey: "colorNeonPink",
  },
  {
    id: "neon-purple",
    style: "neon",
    color: "oklch(70% 0.32 290)",
    hue: 290,
    i18nKey: "colorNeonPurple",
  },
  {
    id: "neon-green",
    style: "neon",
    color: "oklch(80% 0.35 140)",
    hue: 140,
    i18nKey: "colorNeonGreen",
  },
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

      {/* Figma/Linear Style Color Picker Dropdown - Glassmorphism */}
      <div
        id="theme-color-dropdown"
        class={`
          theme-glass-dropdown
          fixed z-[9999] w-[280px] overflow-hidden rounded-xl
          border border-white/20 shadow-2xl
        `}
        style={{
          display: "none",
          opacity: 0,
          transform: "scale(0.95) translateY(-8px)",
          transition: "opacity 200ms ease-out, transform 200ms ease-out",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
        }}
        role="menu"
        aria-orientation="vertical"
      >
        {/* ========================================
            1. Screen Theme Section (Full-Screen Themes)
            位置：最上方（無標題）
            ======================================== */}
        <div class="p-3">
          {/* Screen theme swatches grid - 無標題 */}
          <div class="grid grid-cols-6 gap-2" role="group" aria-label={t("theme", "screenThemeTitle")}>
            {SCREEN_THEMES.map((themeDef) => (
              <button
                type="button"
                class={`
                  screen-theme-swatch group relative h-9 w-9 cursor-pointer rounded-lg border-2
                  border-transparent transition-all duration-200
                  hover:scale-110 hover:border-white/50
                  focus:ring-2 focus:ring-accent-500 focus:ring-offset-2
                  focus:outline-none
                  ${themeDef.id === "neon-night" ? "shadow-[inset_0_0_8px_oklch(60%_0.25_300_/_40%)]" : ""}
                `}
                data-screen-theme={themeDef.id}
                style={{
                  background: themeDef.id === "none" 
                    ? "linear-gradient(135deg, var(--neutral-700), var(--neutral-800))"
                    : themeDef.preview,
                }}
                aria-label={t("theme", themeDef.i18nKey)}
                title={t("theme", themeDef.i18nKey)}
                role="menuitem"
              >
                {/* "None" indicator (X icon) */}
                {themeDef.id === "none" && (
                  <div class="absolute inset-0 flex items-center justify-center">
                    <svg
                      class="h-4 w-4 text-neutral-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                )}
                {/* Glow effect on hover */}
                <div
                  class={`
                    pointer-events-none absolute inset-0 rounded-lg opacity-0 transition-opacity
                    duration-200
                    group-hover:opacity-100
                  `}
                  style={{
                    boxShadow: themeDef.id === "neon-night"
                      ? "0 0 15px 3px oklch(60% 0.25 300 / 40%)"
                      : "0 0 15px 3px rgba(255, 255, 255, 0.25)",
                  }}
                />
                {/* Active indicator (checkmark) */}
                <div
                  class={`
                    screen-theme-active-indicator absolute inset-0 flex items-center justify-center
                    opacity-0 transition-opacity
                  `}
                >
                  <svg
                    class="h-4 w-4 text-white drop-shadow-lg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    stroke-width="3"
                  >
                    <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ========================================
            2. Preset Colors Section (Accent Colors)
            ======================================== */}
        <div class="theme-glass-divider" />

        <div class="p-3">
          {/* Color swatches grid with glow effect - 無標題 */}
          <div class="grid grid-cols-5 gap-2" role="group" aria-label={t("theme", "pickerTitle")}>
            {THEME_COLORS.map((colorDef) => (
              <button
                type="button"
                class={`
                  theme-color-swatch group relative h-10 w-10 cursor-pointer rounded-lg border-2
                  border-transparent transition-all duration-200
                  hover:scale-110 hover:border-white/50
                  focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 focus:ring-offset-neutral-900
                  focus:outline-none
                `}
                data-color={colorDef.id}
                data-style={colorDef.style}
                data-hue={colorDef.hue}
                style={{
                  background: colorDef.gradient || colorDef.color,
                }}
                aria-label={t("theme", colorDef.i18nKey)}
                title={t("theme", colorDef.i18nKey)}
                role="menuitem"
              >
                {/* Glow effect on hover */}
                <div
                  class={`
                    pointer-events-none absolute inset-0 rounded-lg opacity-0 transition-opacity
                    duration-200
                    group-hover:opacity-100
                  `}
                  style={{
                    boxShadow: colorDef.gradient
                      ? "0 0 20px 4px rgba(255, 255, 255, 0.3)"
                      : `0 0 20px 4px ${colorDef.color}`,
                  }}
                />
                {/* Active indicator (checkmark) */}
                <div
                  class={`
                    active-indicator absolute inset-0 flex items-center justify-center opacity-0
                    transition-opacity
                  `}
                >
                  <svg
                    class="h-5 w-5 text-white drop-shadow-lg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    stroke-width="3"
                  >
                    <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ========================================
            3. Custom Color Section
            ======================================== */}
        <div class="theme-glass-divider" />

        <div class="p-3">
          <button
            type="button"
            id="advanced-picker-toggle"
            class={`
              flex w-full items-center justify-between rounded-lg px-3 py-2.5
              text-sm transition-colors
              hover:bg-white/10
            `}
          >
            <span class="flex items-center gap-2">
              {/* Palette icon */}
              <svg
                class="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
                />
              </svg>
              <span safe>{t("theme", "customColor")}</span>
            </span>
            <svg
              class="h-4 w-4 transition-transform duration-200"
              id="advanced-picker-arrow"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Advanced Color Picker Panel (Figma/Linear Style) */}
          <div
            id="advanced-picker-panel"
            class="mt-3 overflow-hidden"
            style={{
              display: "none",
              maxHeight: "0",
              transition: "max-height 300ms ease-out",
            }}
          >
            {/* Hue Ring Container */}
            <div class="relative mx-auto mb-4" style={{ width: "180px", height: "180px" }}>
              {/* Hue Ring (CSS Conic Gradient) */}
              <div
                id="hue-ring"
                class="absolute inset-0 cursor-crosshair rounded-full"
                style={{
                  background: `conic-gradient(from 0deg, hsl(0, 100%, 50%), hsl(60, 100%, 50%), hsl(120, 100%, 50%), hsl(180, 100%, 50%), hsl(240, 100%, 50%), hsl(300, 100%, 50%), hsl(360, 100%, 50%))`,
                  WebkitMask:
                    "radial-gradient(circle at center, transparent 60px, black 60px, black 90px, transparent 90px)",
                  mask: "radial-gradient(circle at center, transparent 60px, black 60px, black 90px, transparent 90px)",
                }}
              />
              {/* Hue Indicator */}
              <div
                id="hue-indicator"
                class="pointer-events-none absolute h-4 w-4 rounded-full border-2 border-white shadow-lg"
                style={{
                  top: "0",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
                }}
              />

              {/* Saturation/Lightness Panel (Inside Ring) */}
              <div
                id="sl-panel"
                class="absolute cursor-crosshair overflow-hidden rounded-full"
                style={{
                  top: "30px",
                  left: "30px",
                  width: "120px",
                  height: "120px",
                }}
              >
                {/* SL Gradient */}
                <div
                  id="sl-gradient"
                  class="absolute inset-0"
                  style={{
                    background: "linear-gradient(to right, white, hsl(131, 100%, 50%))",
                  }}
                />
                <div
                  class="absolute inset-0"
                  style={{
                    background: "linear-gradient(to bottom, transparent, black)",
                  }}
                />
                {/* SL Indicator */}
                <div
                  id="sl-indicator"
                  class="pointer-events-none absolute h-4 w-4 rounded-full border-2 border-white shadow-lg"
                  style={{
                    top: "50%",
                    left: "100%",
                    transform: "translate(-50%, -50%)",
                    background: "#a5d601",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
                  }}
                />
              </div>
            </div>

            {/* Alpha Slider */}
            <div class="mb-4">
              <label class="mb-1 block text-xs text-neutral-500" safe>
                {t("theme", "alphaLabel")}
              </label>
              <div class="relative h-3 overflow-hidden rounded-full">
                {/* Checkerboard background */}
                <div
                  class="absolute inset-0"
                  style={{
                    background:
                      "linear-gradient(45deg, #444 25%, transparent 25%), linear-gradient(-45deg, #444 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #444 75%), linear-gradient(-45deg, transparent 75%, #444 75%)",
                    backgroundSize: "8px 8px",
                    backgroundPosition: "0 0, 0 4px, 4px -4px, -4px 0px",
                  }}
                />
                {/* Alpha gradient */}
                <input
                  type="range"
                  id="alpha-slider"
                  min="0"
                  max="100"
                  value="100"
                  class={`
                    absolute inset-0 w-full cursor-pointer appearance-none bg-transparent
                    [&::-webkit-slider-runnable-track]:h-full
                    [&::-webkit-slider-runnable-track]:rounded-full
                    [&::-webkit-slider-thumb]:mt-[-2px] [&::-webkit-slider-thumb]:h-4
                    [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none
                    [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2
                    [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-neutral-800
                    [&::-webkit-slider-thumb]:shadow-lg
                  `}
                  style={{
                    background: "linear-gradient(to right, transparent, #a5d601)",
                  }}
                />
              </div>
            </div>

            {/* HEX Input with Copy */}
            <div class="flex gap-2">
              <div class="relative flex-1">
                <input
                  type="text"
                  id="hex-input"
                  value="#A5D601"
                  maxlength="7"
                  class={`
                    w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 font-mono
                    text-sm uppercase text-white transition-colors
                    focus:border-accent-500 focus:outline-none
                  `}
                  placeholder="#000000"
                />
                <span class="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-neutral-500">
                  HEX
                </span>
              </div>
              <button
                type="button"
                id="hex-copy-btn"
                class={`
                  flex items-center justify-center rounded-lg border border-neutral-700
                  bg-neutral-800 px-3 transition-colors
                  hover:bg-neutral-700
                `}
                title="複製 HEX 碼"
              >
                <svg
                  class="h-4 w-4 text-neutral-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              </button>
            </div>

            {/* Color Preview */}
            <div class="mt-3 flex items-center gap-3">
              <div class="relative h-10 flex-1 overflow-hidden rounded-lg">
                {/* Checkerboard */}
                <div
                  class="absolute inset-0"
                  style={{
                    background:
                      "linear-gradient(45deg, #333 25%, transparent 25%), linear-gradient(-45deg, #333 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #333 75%), linear-gradient(-45deg, transparent 75%, #333 75%)",
                    backgroundSize: "8px 8px",
                    backgroundPosition: "0 0, 0 4px, 4px -4px, -4px 0px",
                  }}
                />
                <div id="color-preview" class="absolute inset-0" style={{ background: "#a5d601" }} />
              </div>
              <button
                type="button"
                id="apply-custom-color"
                class={`
                  rounded-lg bg-accent-600 px-4 py-2 text-sm font-medium text-neutral-900
                  transition-colors
                  hover:bg-accent-500
                `}
                safe
              >
                {t("theme", "applyColor")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
