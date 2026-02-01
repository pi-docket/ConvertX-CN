// ============================================================================
// Theme System v4.0 - Light/Dark Mode + Color Picker
// ============================================================================
// Features:
// 1. Mode (light/dark) - Simple toggle
// 2. Color selection - Solid, gradient, neon, custom colors
// 3. CSS Variables - Instant updates without page reload
// 4. localStorage persistence
// 5. System preference detection
// ============================================================================

(function () {
  const THEME_MODE_KEY = "themeMode";
  const THEME_COLOR_KEY = "themeColor";
  const THEME_STYLE_KEY = "themeStyle";
  const CUSTOM_HUE_KEY = "customHue";

  // Default values
  const DEFAULT_HUE = 131;
  const DEFAULT_CHROMA = 0.2;
  const DEFAULT_COLOR = "green";
  const DEFAULT_STYLE = "solid";

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
      return localStorage.getItem(THEME_COLOR_KEY) || DEFAULT_COLOR;
    } catch (e) {
      return DEFAULT_COLOR;
    }
  }

  function getStoredStyle() {
    try {
      return localStorage.getItem(THEME_STYLE_KEY) || DEFAULT_STYLE;
    } catch (e) {
      return DEFAULT_STYLE;
    }
  }

  function getStoredCustomHue() {
    try {
      return parseInt(localStorage.getItem(CUSTOM_HUE_KEY), 10) || DEFAULT_HUE;
    } catch (e) {
      return DEFAULT_HUE;
    }
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

  function saveColor(color) {
    try {
      localStorage.setItem(THEME_COLOR_KEY, color);
    } catch (e) {}
  }

  function saveStyle(style) {
    try {
      localStorage.setItem(THEME_STYLE_KEY, style);
    } catch (e) {}
  }

  function saveCustomHue(hue) {
    try {
      localStorage.setItem(CUSTOM_HUE_KEY, String(hue));
    } catch (e) {}
  }

  function getEffectiveMode() {
    const stored = getStoredMode();
    if (stored) return stored;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  // ============================================================================
  // CSS Variable Updates
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

    updateThemeIcons();
    applyColorTheme();

    window.dispatchEvent(new CustomEvent("themechange", { detail: { mode: getEffectiveMode() } }));
  }

  function applyColorTheme() {
    const root = document.documentElement;
    const color = getStoredColor();
    const style = getStoredStyle();

    // Set data attributes for CSS selectors
    root.setAttribute("data-color", color);
    root.setAttribute("data-style", style);

    // For custom colors, also set the CSS variable
    if (color === "custom") {
      const customHue = getStoredCustomHue();
      root.style.setProperty("--custom-hue", String(customHue));
    }

    // Update active swatch indicator
    updateActiveSwatchIndicator(color);
  }

  function setColor(colorId, style) {
    saveColor(colorId);
    saveStyle(style);
    applyColorTheme();

    window.dispatchEvent(
      new CustomEvent("themecolorchange", { detail: { color: colorId, style: style } }),
    );
  }

  function setCustomColor(hexColor) {
    // Convert hex to hue
    const hue = hexToHue(hexColor);
    saveCustomHue(hue);
    setColor("custom", "solid");
  }

  function hexToHue(hex) {
    // Remove # if present
    hex = hex.replace(/^#/, "");

    // Parse RGB
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;

    let hue = 0;
    if (delta !== 0) {
      if (max === r) {
        hue = 60 * (((g - b) / delta) % 6);
      } else if (max === g) {
        hue = 60 * ((b - r) / delta + 2);
      } else {
        hue = 60 * ((r - g) / delta + 4);
      }
    }

    if (hue < 0) hue += 360;
    return Math.round(hue);
  }

  function updateActiveSwatchIndicator(activeColor) {
    // Remove active indicator from all swatches
    document.querySelectorAll(".theme-color-swatch").forEach((swatch) => {
      swatch.classList.remove("ring-2", "ring-white", "ring-offset-2", "ring-offset-neutral-900");
      if (swatch.dataset.color === activeColor) {
        swatch.classList.add("ring-2", "ring-white", "ring-offset-2", "ring-offset-neutral-900");
      }
    });
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

  // ============================================================================
  // Dropdown Management
  // ============================================================================
  let dropdownOpen = false;

  function toggleDropdown() {
    const dropdown = document.getElementById("theme-color-dropdown");
    const arrow = document.getElementById("theme-dropdown-arrow");
    const toggleBtn = document.getElementById("theme-dropdown-toggle");

    if (!dropdown) {
      console.warn("[theme.js] Dropdown element not found");
      return;
    }

    dropdownOpen = !dropdownOpen;

    if (dropdownOpen) {
      // Show dropdown
      dropdown.style.display = "block";
      // Force reflow for animation
      void dropdown.offsetHeight;
      dropdown.style.opacity = "1";
      dropdown.style.transform = "scale(1)";
      if (arrow) arrow.style.transform = "rotate(180deg)";
      if (toggleBtn) toggleBtn.setAttribute("aria-expanded", "true");

      // Update active indicator
      updateActiveSwatchIndicator(getStoredColor());
    } else {
      // Hide dropdown with animation
      dropdown.style.opacity = "0";
      dropdown.style.transform = "scale(0.95)";
      if (arrow) arrow.style.transform = "";
      if (toggleBtn) toggleBtn.setAttribute("aria-expanded", "false");

      // Hide after animation
      setTimeout(() => {
        if (!dropdownOpen) {
          dropdown.style.display = "none";
        }
      }, 200);
    }
  }

  function closeDropdown() {
    if (!dropdownOpen) return;
    dropdownOpen = false;

    const dropdown = document.getElementById("theme-color-dropdown");
    const arrow = document.getElementById("theme-dropdown-arrow");
    const toggleBtn = document.getElementById("theme-dropdown-toggle");

    if (dropdown) {
      dropdown.style.opacity = "0";
      dropdown.style.transform = "scale(0.95)";
      setTimeout(() => {
        if (dropdown) dropdown.style.display = "none";
      }, 200);
    }
    if (arrow) arrow.style.transform = "";
    if (toggleBtn) toggleBtn.setAttribute("aria-expanded", "false");
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

  // ============================================================================
  // Initialization
  // ============================================================================
  function init() {
    const mode = getStoredMode();
    applyMode(mode);
    applyColorTheme();

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
    const color = getStoredColor();
    const style = getStoredStyle();

    if (mode) {
      root.setAttribute("data-theme", mode);
    }

    root.setAttribute("data-color", color);
    root.setAttribute("data-style", style);

    if (color === "custom") {
      const customHue = getStoredCustomHue();
      root.style.setProperty("--custom-hue", String(customHue));
    }
  })();

  // Event binding function
  function bindEvents() {
    init();

    // Theme toggle button - click to toggle mode
    document.addEventListener("click", function (e) {
      const themeToggle = document.getElementById("theme-toggle");
      const dropdownToggle = document.getElementById("theme-dropdown-toggle");
      const dropdown = document.getElementById("theme-color-dropdown");
      const container = document.getElementById("theme-picker-container");

      // Check dropdown toggle FIRST (it's the smaller button)
      if (dropdownToggle && (e.target === dropdownToggle || dropdownToggle.contains(e.target))) {
        e.preventDefault();
        e.stopPropagation();
        toggleDropdown();
        return;
      }

      // Mode toggle (light/dark)
      if (themeToggle && (e.target === themeToggle || themeToggle.contains(e.target))) {
        e.preventDefault();
        toggleMode();
        return;
      }

      // Color swatch click
      const swatch = e.target.closest(".theme-color-swatch");
      if (swatch && dropdown && dropdown.contains(swatch)) {
        e.preventDefault();
        const colorId = swatch.dataset.color;
        const style = swatch.dataset.style || "solid";
        setColor(colorId, style);
        return;
      }

      // Custom color input
      const customColorInput = document.getElementById("theme-custom-color");
      if (customColorInput && e.target === customColorInput) {
        return; // Let the input handle its own events
      }

      // Click outside dropdown - close it
      if (container && !container.contains(e.target)) {
        closeDropdown();
      }
    });

    // Custom color input change
    document.addEventListener("input", function (e) {
      if (e.target.id === "theme-custom-color") {
        setCustomColor(e.target.value);
      }
    });

    // Close dropdown on Escape key
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && dropdownOpen) {
        closeDropdown();
      }
    });
  }

  // Execute when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindEvents);
  } else {
    bindEvents();
  }

  // Expose API
  window.themeSystem = {
    setMode,
    toggleMode,
    getEffectiveMode,
    setColor,
    setCustomColor,
    getStoredColor,
    getStoredStyle,
  };

  // Legacy support
  window.toggleTheme = toggleMode;
  window.getEffectiveTheme = getEffectiveMode;
})();
