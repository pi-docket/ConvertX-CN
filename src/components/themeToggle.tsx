import {
  type SupportedLocale,
  type Translator,
  createTranslator,
  defaultLocale,
} from "../i18n/index";

// ============================================================================
// Color Configuration
// ============================================================================

// Solid colors
const SOLID_COLORS = [
  { id: "green", hue: 131, chroma: 0.2 },
  { id: "blue", hue: 250, chroma: 0.21 },
  { id: "purple", hue: 300, chroma: 0.22 },
  { id: "pink", hue: 350, chroma: 0.22 },
  { id: "orange", hue: 50, chroma: 0.2 },
  { id: "teal", hue: 190, chroma: 0.15 },
  { id: "gray", hue: 260, chroma: 0.02 },
  { id: "yellow", hue: 95, chroma: 0.2 },
];

// Gradient colors (linear gradients)
const GRADIENT_COLORS = [
  { id: "aurora", gradient: "linear-gradient(135deg, #667eea 0%, #764ba2 50%, #66bb6a 100%)" },
  { id: "sunset", gradient: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)" },
  { id: "ocean", gradient: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)" },
  { id: "forest", gradient: "linear-gradient(135deg, #11998e 0%, #38ef7d 100%)" },
  { id: "fire", gradient: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)" },
];

// Vivid/Neon colors (high saturation with glow effect)
const VIVID_COLORS = [
  { id: "neon-cyan", hue: 180, chroma: 0.35, glow: true },
  { id: "neon-pink", hue: 330, chroma: 0.35, glow: true },
  { id: "neon-purple", hue: 290, chroma: 0.32, glow: true },
  { id: "neon-green", hue: 150, chroma: 0.35, glow: true },
  { id: "rainbow", gradient: "linear-gradient(90deg, #ff0000, #ff8000, #ffff00, #80ff00, #00ff80, #00ffff, #0080ff, #8000ff)", animated: true },
];

// Translation key mapping
type ThemeColorKey =
  | "colorGreen" | "colorBlue" | "colorPurple" | "colorPink"
  | "colorOrange" | "colorTeal" | "colorGray" | "colorYellow"
  | "colorAurora" | "colorSunset" | "colorOcean" | "colorForest" | "colorFire"
  | "colorNeonCyan" | "colorNeonPink" | "colorNeonPurple" | "colorNeonGreen" | "colorRainbow"
  | "customColor";

const colorTranslationMap: Record<string, ThemeColorKey> = {
  green: "colorGreen", blue: "colorBlue", purple: "colorPurple", pink: "colorPink",
  orange: "colorOrange", teal: "colorTeal", gray: "colorGray", yellow: "colorYellow",
  aurora: "colorAurora", sunset: "colorSunset", ocean: "colorOcean", forest: "colorForest", fire: "colorFire",
  "neon-cyan": "colorNeonCyan", "neon-pink": "colorNeonPink", "neon-purple": "colorNeonPurple",
  "neon-green": "colorNeonGreen", rainbow: "colorRainbow",
  custom: "customColor",
};

// ============================================================================
// Color Dot Component
// ============================================================================
const ColorDot = ({
  color,
  style,
  title,
  category,
  isGlow,
}: {
  color: string;
  style: string;
  title: string;
  category: string;
  isGlow?: boolean;
}) => (
  <button
    type="button"
    class={`
      theme-color-dot w-6 h-6 rounded-full cursor-pointer
      transition-all duration-200 border-2 border-transparent
      hover:scale-125 hover:border-white/50
      focus:outline-none focus:ring-2 focus:ring-white/50
      ${isGlow ? "shadow-[0_0_8px_currentColor]" : ""}
    `}
    style={style}
    data-color={color}
    data-category={category}
    title={title}
    aria-label={title}
  />
);

// ============================================================================
// Theme Toggle Component (Entry Point with Dropdown)
// ============================================================================
export const ThemeToggle = ({
  t = createTranslator(defaultLocale),
}: {
  locale?: SupportedLocale;
  t?: Translator;
}) => {
  return (
    <div class="theme-selector relative">
      {/* Toggle Button */}
      <button
        type="button"
        id="theme-toggle"
        class={`
          flex items-center gap-1 text-accent-600 transition-all
          hover:text-accent-500
        `}
        aria-label={t("theme", "pickerTitle")}
        aria-expanded="false"
        aria-haspopup="true"
      >
        {/* Sun icon (shown in dark mode) */}
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
        {/* Moon icon (shown in light mode) */}
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
        {/* Dropdown arrow */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="1.5"
          stroke="currentColor"
          class="h-4 w-4"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {/* Dropdown Panel */}
      <div
        id="theme-dropdown"
        class={`
          absolute top-full right-0 z-50 mt-2
          hidden min-w-[280px] flex-col
          rounded-lg border border-neutral-600 bg-neutral-800 shadow-xl
        `}
        role="menu"
        aria-label={t("theme", "pickerTitle")}
      >
        {/* ========== Mode Section ========== */}
        <div class="p-3 border-b border-neutral-700">
          <div class="text-xs font-medium text-neutral-400 mb-2" safe>
            {t("theme", "modeLabel")}
          </div>
          <div class="flex gap-2">
            <button
              type="button"
              id="mode-light"
              class={`
                theme-mode-btn flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md
                text-sm font-medium transition-all duration-200
                bg-neutral-700 text-neutral-300 hover:bg-neutral-600
              `}
              data-mode="light"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
              </svg>
              <span safe>{t("theme", "lightMode")}</span>
            </button>
            <button
              type="button"
              id="mode-dark"
              class={`
                theme-mode-btn flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md
                text-sm font-medium transition-all duration-200
                bg-neutral-700 text-neutral-300 hover:bg-neutral-600
              `}
              data-mode="dark"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
                <path stroke-linecap="round" stroke-linejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
              </svg>
              <span safe>{t("theme", "darkMode")}</span>
            </button>
          </div>
        </div>

        {/* ========== Solid Colors Section ========== */}
        <div class="p-3 border-b border-neutral-700">
          <div class="text-xs font-medium text-neutral-400 mb-2" safe>
            {t("theme", "styleSolid")}
          </div>
          <div class="flex flex-wrap gap-2">
            {SOLID_COLORS.map((c) => (
              <ColorDot
                color={c.id}
                style={`background: oklch(65% ${c.chroma} ${c.hue})`}
                title={t("theme", colorTranslationMap[c.id] || "colorGreen")}
                category="solid"
              />
            ))}
          </div>
        </div>

        {/* ========== Gradient Colors Section ========== */}
        <div class="p-3 border-b border-neutral-700">
          <div class="text-xs font-medium text-neutral-400 mb-2" safe>
            {t("theme", "styleGradient")}
          </div>
          <div class="flex flex-wrap gap-2">
            {GRADIENT_COLORS.map((c) => (
              <ColorDot
                color={c.id}
                style={`background: ${c.gradient}`}
                title={t("theme", colorTranslationMap[c.id] || "colorAurora")}
                category="gradient"
              />
            ))}
          </div>
        </div>

        {/* ========== Vivid/Neon Colors Section ========== */}
        <div class="p-3 border-b border-neutral-700">
          <div class="text-xs font-medium text-neutral-400 mb-2" safe>
            {t("theme", "styleVivid")}
          </div>
          <div class="flex flex-wrap gap-2">
            {VIVID_COLORS.map((c) => (
              <ColorDot
                color={c.id}
                style={c.gradient ? `background: ${c.gradient}` : `background: oklch(75% ${c.chroma} ${c.hue}); color: oklch(75% ${c.chroma} ${c.hue})`}
                title={t("theme", colorTranslationMap[c.id] || "colorNeonCyan")}
                category="vivid"
                isGlow={c.glow ?? false}
              />
            ))}
          </div>
        </div>

        {/* ========== Custom Color Section ========== */}
        <div class="p-3">
          <div class="text-xs font-medium text-neutral-400 mb-2" safe>
            {t("theme", "customColor")}
          </div>
          <div class="flex items-center gap-3">
            <input
              type="color"
              id="theme-color-picker"
              class={`
                w-8 h-8 rounded-full cursor-pointer border-2 border-neutral-600
                hover:border-neutral-400 transition-colors
                [&::-webkit-color-swatch-wrapper]:p-0.5
                [&::-webkit-color-swatch]:rounded-full
                [&::-moz-color-swatch]:rounded-full
              `}
              value="#84cc16"
            />
            <span class="text-xs text-neutral-400" safe>{t("theme", "customColorHint")}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
