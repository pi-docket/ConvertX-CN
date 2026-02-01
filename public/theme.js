// ============================================================================
// Theme System v2.0
// ============================================================================
// Features:
// 1. Mode (light/dark) - Independent control
// 2. Color (solid/gradient/vivid) - Independent control
// 3. CSS Variables - Instant updates without page reload
// 4. localStorage persistence
// ============================================================================

(function () {
  const THEME_MODE_KEY = "themeMode";
  const THEME_COLOR_KEY = "themeColor";

  // ============================================================================
  // Color Definitions
  // ============================================================================
  const SOLID_COLORS = {
    green: { hue: 131, chroma: 0.2 },
    blue: { hue: 250, chroma: 0.21 },
    purple: { hue: 300, chroma: 0.22 },
    pink: { hue: 350, chroma: 0.22 },
    orange: { hue: 50, chroma: 0.2 },
    teal: { hue: 190, chroma: 0.15 },
    gray: { hue: 260, chroma: 0.02 },
    yellow: { hue: 95, chroma: 0.2 },
  };

  const GRADIENT_COLORS = {
    aurora: {
      gradient: "linear-gradient(135deg, #667eea 0%, #764ba2 50%, #66bb6a 100%)",
      primary: { hue: 260, chroma: 0.2 },
    },
    sunset: {
      gradient: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
      primary: { hue: 350, chroma: 0.22 },
    },
    ocean: {
      gradient: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
      primary: { hue: 200, chroma: 0.2 },
    },
    forest: {
      gradient: "linear-gradient(135deg, #11998e 0%, #38ef7d 100%)",
      primary: { hue: 160, chroma: 0.2 },
    },
    fire: {
      gradient: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
      primary: { hue: 340, chroma: 0.25 },
    },
  };

  const VIVID_COLORS = {
    "neon-cyan": { hue: 180, chroma: 0.35, glow: true },
    "neon-pink": { hue: 330, chroma: 0.35, glow: true },
    "neon-purple": { hue: 290, chroma: 0.32, glow: true },
    "neon-green": { hue: 150, chroma: 0.35, glow: true },
    rainbow: {
      gradient:
        "linear-gradient(90deg, #ff0000, #ff8000, #ffff00, #80ff00, #00ff80, #00ffff, #0080ff, #8000ff)",
      primary: { hue: 0, chroma: 0.3 },
      animated: true,
    },
  };

  // ============================================================================
  // State Management
  // ============================================================================
  function getStoredMode() {
    try {
      return localStorage.getItem(THEME_MODE_KEY);
    } catch (e) {
      return null;
    }
  }

  function getStoredColor() {
    try {
      const stored = localStorage.getItem(THEME_COLOR_KEY);
      if (stored) return JSON.parse(stored);
    } catch (e) {}
    return { id: "green", category: "solid" };
  }

  function saveMode(mode) {
    try {
      if (mode) {
        localStorage.setItem(THEME_MODE_KEY, mode);
      } else {
        localStorage.removeItem(THEME_MODE_KEY);
      }
    } catch (e) {}
  }

  function saveColor(colorData) {
    try {
      localStorage.setItem(THEME_COLOR_KEY, JSON.stringify(colorData));
    } catch (e) {}
  }

  function getEffectiveMode() {
    const stored = getStoredMode();
    if (stored) return stored;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  // ============================================================================
  // CSS Variable Updates (Core - Makes everything instant)
  // ============================================================================
  function applyMode(mode) {
    const root = document.documentElement;

    if (mode === "dark") {
      root.setAttribute("data-theme", "dark");
    } else if (mode === "light") {
      root.setAttribute("data-theme", "light");
    } else {
      root.removeAttribute("data-theme");
    }

    updateModeButtons();
    updateThemeIcons();

    // Re-apply color for correct lightness
    applyColor(getStoredColor());

    window.dispatchEvent(new CustomEvent("themechange", { detail: { mode: getEffectiveMode() } }));
  }

  function applyColor(colorData) {
    const root = document.documentElement;
    const { id, category, customHue, customChroma } = colorData;
    const isDark = getEffectiveMode() === "dark";

    let hue,
      chroma,
      gradient = null,
      glow = false,
      animated = false;

    // Determine color values based on category
    if (category === "custom" && customHue !== undefined) {
      hue = customHue;
      chroma = customChroma || 0.2;
    } else if (category === "solid" && SOLID_COLORS[id]) {
      hue = SOLID_COLORS[id].hue;
      chroma = SOLID_COLORS[id].chroma;
    } else if (category === "gradient" && GRADIENT_COLORS[id]) {
      const gc = GRADIENT_COLORS[id];
      hue = gc.primary.hue;
      chroma = gc.primary.chroma;
      gradient = gc.gradient;
    } else if (category === "vivid" && VIVID_COLORS[id]) {
      const vc = VIVID_COLORS[id];
      hue = vc.hue || vc.primary?.hue || 180;
      chroma = vc.chroma || vc.primary?.chroma || 0.35;
      glow = vc.glow || false;
      gradient = vc.gradient || null;
      animated = vc.animated || false;
    } else {
      // Default to green
      hue = 131;
      chroma = 0.2;
    }

    // Apply CSS variables for accent colors
    if (isDark) {
      root.style.setProperty("--accent-600", `oklch(64% ${chroma} ${hue})`);
      root.style.setProperty("--accent-500", `oklch(74% ${chroma} ${hue})`);
      root.style.setProperty("--accent-400", `oklch(82% ${chroma * 0.9} ${hue})`);
    } else {
      root.style.setProperty("--accent-600", `oklch(52% ${chroma} ${hue})`);
      root.style.setProperty("--accent-500", `oklch(64% ${chroma} ${hue})`);
      root.style.setProperty("--accent-400", `oklch(76% ${chroma} ${hue})`);
    }

    // Apply gradient if applicable
    if (gradient) {
      root.style.setProperty("--accent-gradient", gradient);
      root.setAttribute("data-has-gradient", "true");
    } else {
      root.style.removeProperty("--accent-gradient");
      root.removeAttribute("data-has-gradient");
    }

    // Apply glow effect for vivid colors
    if (glow) {
      const glowColor = `oklch(75% ${chroma} ${hue} / 0.5)`;
      root.style.setProperty("--accent-glow", `0 0 15px ${glowColor}, 0 0 30px ${glowColor}`);
      root.setAttribute("data-has-glow", "true");
    } else {
      root.style.removeProperty("--accent-glow");
      root.removeAttribute("data-has-glow");
    }

    // Apply animation class for rainbow
    if (animated) {
      root.setAttribute("data-animated", "true");
    } else {
      root.removeAttribute("data-animated");
    }

    // Store current color info
    root.setAttribute("data-color", id);
    root.setAttribute("data-color-category", category);

    updateColorDots(id);

    window.dispatchEvent(new CustomEvent("colorchange", { detail: colorData }));
  }

  // ============================================================================
  // UI Updates
  // ============================================================================
  function updateThemeIcons() {
    const effectiveMode = getEffectiveMode();
    const lightIcon = document.getElementById("theme-icon-light");
    const darkIcon = document.getElementById("theme-icon-dark");

    if (lightIcon && darkIcon) {
      if (effectiveMode === "dark") {
        lightIcon.classList.remove("hidden");
        darkIcon.classList.add("hidden");
      } else {
        lightIcon.classList.add("hidden");
        darkIcon.classList.remove("hidden");
      }
    }
  }

  function updateModeButtons() {
    const effectiveMode = getEffectiveMode();
    document.querySelectorAll(".theme-mode-btn").forEach((btn) => {
      const btnMode = btn.getAttribute("data-mode");
      if (btnMode === effectiveMode) {
        btn.classList.remove("bg-neutral-700", "text-neutral-300");
        btn.classList.add("bg-accent-500", "text-contrast");
      } else {
        btn.classList.add("bg-neutral-700", "text-neutral-300");
        btn.classList.remove("bg-accent-500", "text-contrast");
      }
    });
  }

  function updateColorDots(activeColor) {
    document.querySelectorAll(".theme-color-dot").forEach((dot) => {
      const dotColor = dot.getAttribute("data-color");
      if (dotColor === activeColor) {
        dot.classList.add("ring-2", "ring-white", "scale-110");
      } else {
        dot.classList.remove("ring-2", "ring-white", "scale-110");
      }
    });
  }

  // ============================================================================
  // Public API
  // ============================================================================
  function setMode(mode) {
    saveMode(mode);
    applyMode(mode);
  }

  function toggleMode() {
    const currentMode = getEffectiveMode();
    const newMode = currentMode === "dark" ? "light" : "dark";
    setMode(newMode);
  }

  function setColor(colorId, category) {
    const colorData = { id: colorId, category: category };
    saveColor(colorData);
    applyColor(colorData);
  }

  function setCustomColor(hex) {
    const hue = hexToHue(hex);
    const colorData = { id: "custom", category: "custom", customHue: hue, customChroma: 0.2 };
    saveColor(colorData);
    applyColor(colorData);
  }

  function hexToHue(hex) {
    hex = hex.replace(/^#/, "");
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    if (max !== min) {
      const d = max - min;
      switch (max) {
        case r:
          h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
          break;
        case g:
          h = ((b - r) / d + 2) / 6;
          break;
        case b:
          h = ((r - g) / d + 4) / 6;
          break;
      }
    }
    return Math.round(h * 360);
  }

  function toggleDropdown() {
    const dropdown = document.getElementById("theme-dropdown");
    const toggle = document.getElementById("theme-toggle");
    if (!dropdown) return;

    const isHidden = dropdown.classList.contains("hidden");
    if (isHidden) {
      dropdown.classList.remove("hidden");
      dropdown.classList.add("flex");
      if (toggle) toggle.setAttribute("aria-expanded", "true");
    } else {
      dropdown.classList.add("hidden");
      dropdown.classList.remove("flex");
      if (toggle) toggle.setAttribute("aria-expanded", "false");
    }
  }

  function closeDropdown() {
    const dropdown = document.getElementById("theme-dropdown");
    const toggle = document.getElementById("theme-toggle");
    if (dropdown) {
      dropdown.classList.add("hidden");
      dropdown.classList.remove("flex");
      if (toggle) toggle.setAttribute("aria-expanded", "false");
    }
  }

  // ============================================================================
  // Initialization
  // ============================================================================
  function init() {
    const mode = getStoredMode();
    const colorData = getStoredColor();

    applyMode(mode);
    applyColor(colorData);

    // Listen for system preference changes
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
      if (!getStoredMode()) {
        applyMode(null);
      }
    });
  }

  // Apply immediately to prevent flash
  (function () {
    const root = document.documentElement;
    const mode = getStoredMode();
    const colorData = getStoredColor();

    if (mode) {
      root.setAttribute("data-theme", mode);
    }

    // Quick apply color
    const { id, category, customHue, customChroma } = colorData;
    let hue = 131,
      chroma = 0.2;

    if (category === "custom" && customHue) {
      hue = customHue;
      chroma = customChroma || 0.2;
    } else if (category === "solid" && SOLID_COLORS[id]) {
      hue = SOLID_COLORS[id].hue;
      chroma = SOLID_COLORS[id].chroma;
    } else if (category === "gradient" && GRADIENT_COLORS[id]) {
      hue = GRADIENT_COLORS[id].primary.hue;
      chroma = GRADIENT_COLORS[id].primary.chroma;
    } else if (category === "vivid" && VIVID_COLORS[id]) {
      hue = VIVID_COLORS[id].hue || VIVID_COLORS[id].primary?.hue || 180;
      chroma = VIVID_COLORS[id].chroma || VIVID_COLORS[id].primary?.chroma || 0.35;
    }

    const isDark =
      mode === "dark" || (!mode && window.matchMedia("(prefers-color-scheme: dark)").matches);

    if (isDark) {
      root.style.setProperty("--accent-600", `oklch(64% ${chroma} ${hue})`);
      root.style.setProperty("--accent-500", `oklch(74% ${chroma} ${hue})`);
      root.style.setProperty("--accent-400", `oklch(82% ${chroma * 0.9} ${hue})`);
    } else {
      root.style.setProperty("--accent-600", `oklch(52% ${chroma} ${hue})`);
      root.style.setProperty("--accent-500", `oklch(64% ${chroma} ${hue})`);
      root.style.setProperty("--accent-400", `oklch(76% ${chroma} ${hue})`);
    }

    root.setAttribute("data-color", id);
    root.setAttribute("data-color-category", category);
  })();

  // Event binding function
  function bindEvents() {
    init();

    // Theme toggle button - opens dropdown
    const themeToggle = document.getElementById("theme-toggle");

    if (themeToggle) {
      themeToggle.addEventListener("click", function (e) {
        e.stopPropagation();
        toggleDropdown();
      });
    }

    // Mode buttons
    document.querySelectorAll(".theme-mode-btn").forEach((btn) => {
      btn.addEventListener("click", function () {
        const mode = this.getAttribute("data-mode");
        setMode(mode);
      });
    });

    // Color dots
    document.querySelectorAll(".theme-color-dot").forEach((dot) => {
      dot.addEventListener("click", function () {
        const colorId = this.getAttribute("data-color");
        const category = this.getAttribute("data-category");
        if (colorId && category) {
          setColor(colorId, category);
        }
      });
    });

    // Custom color picker
    const colorPicker = document.getElementById("theme-color-picker");
    if (colorPicker) {
      colorPicker.addEventListener("input", function () {
        setCustomColor(this.value);
      });
    }

    // Close dropdown when clicking outside
    document.addEventListener("click", function (e) {
      const dropdown = document.getElementById("theme-dropdown");
      const toggle = document.getElementById("theme-toggle");
      if (dropdown && toggle && !dropdown.contains(e.target) && !toggle.contains(e.target)) {
        closeDropdown();
      }
    });
  }

  // Execute when DOM is ready (handles both cases: before and after DOMContentLoaded)
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindEvents);
  } else {
    // DOM is already ready
    bindEvents();
  }

  // Expose API
  window.themeSystem = {
    setMode,
    toggleMode,
    setColor,
    setCustomColor,
    getEffectiveMode,
    getStoredColor,
  };

  // Legacy support
  window.toggleTheme = toggleMode;
  window.getEffectiveTheme = getEffectiveMode;
})();
