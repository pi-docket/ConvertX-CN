// ============================================================================
// Theme System v4.1 - Light/Dark Mode + Color Picker + Screen Themes
// ============================================================================
// Features:
// 1. Mode (light/dark) - Simple toggle
// 2. Color selection - Solid, gradient, neon, custom colors
// 3. Screen themes - Full-screen background themes (Aurora, Sunset, etc.)
// 4. CSS Variables - Instant updates without page reload
// 5. localStorage persistence
// 6. System preference detection
// ============================================================================

(function () {
  const THEME_MODE_KEY = "themeMode";
  const THEME_COLOR_KEY = "themeColor";
  const THEME_STYLE_KEY = "themeStyle";
  const CUSTOM_HUE_KEY = "customHue";
  const SCREEN_THEME_KEY = "screenTheme";

  // Default values
  const DEFAULT_HUE = 131;
  const DEFAULT_CHROMA = 0.2;
  const DEFAULT_COLOR = "green";
  const DEFAULT_STYLE = "solid";
  const DEFAULT_SCREEN_THEME = "none";

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

  function getStoredScreenTheme() {
    try {
      return localStorage.getItem(SCREEN_THEME_KEY) || DEFAULT_SCREEN_THEME;
    } catch (e) {
      return DEFAULT_SCREEN_THEME;
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

  function saveScreenTheme(theme) {
    try {
      localStorage.setItem(SCREEN_THEME_KEY, theme);
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

  function applyScreenTheme() {
    const root = document.documentElement;
    const screenTheme = getStoredScreenTheme();

    // Set data attribute for CSS selectors
    root.setAttribute("data-screen-theme", screenTheme);

    // Update active screen theme indicator
    updateActiveScreenThemeIndicator(screenTheme);

    // Dispatch event for screen theme change
    window.dispatchEvent(
      new CustomEvent("screenthemechange", { detail: { screenTheme: screenTheme } }),
    );
  }

  function setScreenTheme(themeId) {
    saveScreenTheme(themeId);
    applyScreenTheme();
  }

  function updateActiveScreenThemeIndicator(activeTheme) {
    // Remove active indicator from all screen theme swatches
    document.querySelectorAll(".screen-theme-swatch").forEach((swatch) => {
      const indicator = swatch.querySelector(".screen-theme-active-indicator");
      if (indicator) {
        if (swatch.dataset.screenTheme === activeTheme) {
          indicator.style.opacity = "1";
          swatch.classList.add("ring-2", "ring-white", "ring-offset-2", "ring-offset-neutral-900");
        } else {
          indicator.style.opacity = "0";
          swatch.classList.remove(
            "ring-2",
            "ring-white",
            "ring-offset-2",
            "ring-offset-neutral-900",
          );
        }
      }
    });
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

  function positionDropdown(dropdown, toggleBtn) {
    if (!dropdown || !toggleBtn) return;

    const rect = toggleBtn.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const dropdownWidth = 280;

    // Reset position first to get accurate height measurement
    dropdown.style.top = "0";
    dropdown.style.left = "0";

    // Force layout to get accurate height
    const dropdownHeight = dropdown.scrollHeight || dropdown.offsetHeight || 400;

    // Max height is 85vh or 700px, whichever is smaller
    const maxHeight = Math.min(viewportHeight * 0.85, 700);

    // Calculate position - prefer below the button
    let top = rect.bottom + 8;
    let left = rect.right - dropdownWidth;

    // If dropdown would overflow bottom, position above the button
    if (top + Math.min(dropdownHeight, maxHeight) > viewportHeight - 16) {
      // Check if there's more space above
      if (rect.top > viewportHeight - rect.bottom) {
        top = Math.max(16, rect.top - Math.min(dropdownHeight, maxHeight) - 8);
      } else {
        // Keep below but constrain to viewport
        top = Math.max(16, viewportHeight - Math.min(dropdownHeight, maxHeight) - 16);
      }
    }

    // Ensure dropdown doesn't go off-screen (left)
    if (left < 16) {
      left = 16;
    }

    // Ensure dropdown doesn't go off-screen (right)
    if (left + dropdownWidth > viewportWidth - 16) {
      left = viewportWidth - dropdownWidth - 16;
    }

    dropdown.style.top = `${top}px`;
    dropdown.style.left = `${left}px`;
  }

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
      // Close language dropdown if open
      const langDropdown = document.getElementById("language-dropdown");
      const langToggle = document.getElementById("language-toggle");
      if (langDropdown && !langDropdown.classList.contains("hidden")) {
        langDropdown.classList.add("hidden");
        langDropdown.classList.remove("flex");
        if (langToggle) langToggle.setAttribute("aria-expanded", "false");
      }

      // Show dropdown
      dropdown.style.display = "block";

      // Position the fixed dropdown relative to the toggle button
      positionDropdown(dropdown, toggleBtn);

      // Force reflow for animation
      void dropdown.offsetHeight;
      dropdown.style.opacity = "1";
      dropdown.style.transform = "scale(1)";
      if (arrow) arrow.style.transform = "rotate(180deg)";
      if (toggleBtn) toggleBtn.setAttribute("aria-expanded", "true");

      // Update active indicators
      updateActiveSwatchIndicator(getStoredColor());
      updateActiveScreenThemeIndicator(getStoredScreenTheme());
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
    applyScreenTheme();

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
    const screenTheme = getStoredScreenTheme();

    if (mode) {
      root.setAttribute("data-theme", mode);
    }

    root.setAttribute("data-color", color);
    root.setAttribute("data-style", style);
    root.setAttribute("data-screen-theme", screenTheme);

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
      const advancedToggle = document.getElementById("advanced-picker-toggle");

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

      // Advanced picker toggle
      if (advancedToggle && (e.target === advancedToggle || advancedToggle.contains(e.target))) {
        e.preventDefault();
        toggleAdvancedPicker();
        return;
      }

      // Apply custom color button
      const applyBtn = document.getElementById("apply-custom-color");
      if (applyBtn && (e.target === applyBtn || applyBtn.contains(e.target))) {
        e.preventDefault();
        applyAdvancedColor();
        return;
      }

      // HEX copy button
      const copyBtn = document.getElementById("hex-copy-btn");
      if (copyBtn && (e.target === copyBtn || copyBtn.contains(e.target))) {
        e.preventDefault();
        copyHexCode();
        return;
      }

      // Screen theme swatch click
      const screenSwatch = e.target.closest(".screen-theme-swatch");
      if (screenSwatch && dropdown && dropdown.contains(screenSwatch)) {
        e.preventDefault();
        const themeId = screenSwatch.dataset.screenTheme;
        setScreenTheme(themeId);
        return;
      }

      // Color swatch click
      const swatch = e.target.closest(".theme-color-swatch");
      if (swatch && dropdown && dropdown.contains(swatch)) {
        e.preventDefault();
        const colorId = swatch.dataset.color;
        const style = swatch.dataset.style || "solid";
        setColor(colorId, style);
        updateActiveSwatchIndicator(colorId);
        return;
      }

      // Click outside dropdown - close it
      if (container && !container.contains(e.target)) {
        closeDropdown();
      }
    });

    // HEX input change
    document.addEventListener("input", function (e) {
      if (e.target.id === "hex-input") {
        handleHexInput(e.target.value);
      }
      if (e.target.id === "alpha-slider") {
        updateAlphaPreview(parseInt(e.target.value, 10));
      }
    });

    // Hue ring and SL panel mouse events
    initAdvancedPickerEvents();

    // Close dropdown on Escape key
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && dropdownOpen) {
        closeDropdown();
      }
    });
  }

  // ============================================================================
  // Advanced Picker State
  // ============================================================================
  let advancedPickerOpen = false;
  let advancedState = {
    hue: 131,
    saturation: 100,
    lightness: 50,
    alpha: 100,
  };
  let isDragging = null;

  function toggleAdvancedPicker() {
    const panel = document.getElementById("advanced-picker-panel");
    const arrow = document.getElementById("advanced-picker-arrow");

    if (!panel) return;

    advancedPickerOpen = !advancedPickerOpen;

    if (advancedPickerOpen) {
      panel.style.display = "block";
      // Force reflow
      void panel.offsetHeight;
      panel.style.maxHeight = "500px";
      if (arrow) arrow.style.transform = "rotate(180deg)";
    } else {
      panel.style.maxHeight = "0";
      if (arrow) arrow.style.transform = "";
      setTimeout(() => {
        if (!advancedPickerOpen) {
          panel.style.display = "none";
        }
      }, 300);
    }
  }

  function initAdvancedPickerEvents() {
    // Hue ring drag
    document.addEventListener("mousedown", function (e) {
      const hueRing = document.getElementById("hue-ring");
      const slPanel = document.getElementById("sl-panel");

      if (hueRing && hueRing.contains(e.target) && !slPanel.contains(e.target)) {
        isDragging = "hue";
        updateHueFromEvent(e);
      } else if (slPanel && slPanel.contains(e.target)) {
        isDragging = "sl";
        updateSLFromEvent(e);
      }
    });

    document.addEventListener("mousemove", function (e) {
      if (isDragging === "hue") {
        updateHueFromEvent(e);
      } else if (isDragging === "sl") {
        updateSLFromEvent(e);
      }
    });

    document.addEventListener("mouseup", function () {
      isDragging = null;
    });

    // Touch events for mobile
    document.addEventListener(
      "touchstart",
      function (e) {
        const hueRing = document.getElementById("hue-ring");
        const slPanel = document.getElementById("sl-panel");

        if (hueRing && hueRing.contains(e.target) && !slPanel.contains(e.target)) {
          isDragging = "hue";
          updateHueFromEvent(e.touches[0]);
        } else if (slPanel && slPanel.contains(e.target)) {
          isDragging = "sl";
          updateSLFromEvent(e.touches[0]);
        }
      },
      { passive: false },
    );

    document.addEventListener(
      "touchmove",
      function (e) {
        if (isDragging) {
          e.preventDefault();
          if (isDragging === "hue") {
            updateHueFromEvent(e.touches[0]);
          } else if (isDragging === "sl") {
            updateSLFromEvent(e.touches[0]);
          }
        }
      },
      { passive: false },
    );

    document.addEventListener("touchend", function () {
      isDragging = null;
    });
  }

  function updateHueFromEvent(e) {
    const hueRing = document.getElementById("hue-ring");
    if (!hueRing) return;

    const rect = hueRing.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const angle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
    let hue = (angle * 180) / Math.PI + 90;
    if (hue < 0) hue += 360;

    advancedState.hue = Math.round(hue);
    updateAdvancedPickerUI();
  }

  function updateSLFromEvent(e) {
    const slPanel = document.getElementById("sl-panel");
    if (!slPanel) return;

    const rect = slPanel.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));

    advancedState.saturation = Math.round((x / rect.width) * 100);
    advancedState.lightness = Math.round(100 - (y / rect.height) * 100);
    updateAdvancedPickerUI();
  }

  function updateAdvancedPickerUI() {
    const hueIndicator = document.getElementById("hue-indicator");
    const slGradient = document.getElementById("sl-gradient");
    const slIndicator = document.getElementById("sl-indicator");
    const hexInput = document.getElementById("hex-input");
    const colorPreview = document.getElementById("color-preview");
    const alphaSlider = document.getElementById("alpha-slider");

    // Update hue indicator position
    if (hueIndicator) {
      const hueRing = document.getElementById("hue-ring");
      if (hueRing) {
        const size = 180;
        const radius = 75; // (90 + 60) / 2
        const angle = ((advancedState.hue - 90) * Math.PI) / 180;
        const x = size / 2 + radius * Math.cos(angle);
        const y = size / 2 + radius * Math.sin(angle);
        hueIndicator.style.left = x + "px";
        hueIndicator.style.top = y + "px";
        hueIndicator.style.transform = "translate(-50%, -50%)";
      }
    }

    // Update SL gradient hue
    if (slGradient) {
      slGradient.style.background = `linear-gradient(to right, white, hsl(${advancedState.hue}, 100%, 50%))`;
    }

    // Update SL indicator position
    if (slIndicator) {
      const slPanel = document.getElementById("sl-panel");
      if (slPanel) {
        const x = (advancedState.saturation / 100) * 120;
        const y = ((100 - advancedState.lightness) / 100) * 120;
        slIndicator.style.left = x + "px";
        slIndicator.style.top = y + "px";
        slIndicator.style.background = getCurrentHex();
      }
    }

    // Update HEX input
    if (hexInput) {
      hexInput.value = getCurrentHex();
    }

    // Update color preview
    if (colorPreview) {
      const alpha = advancedState.alpha / 100;
      colorPreview.style.background = `hsla(${advancedState.hue}, ${advancedState.saturation}%, ${advancedState.lightness}%, ${alpha})`;
    }

    // Update alpha slider background
    if (alphaSlider) {
      alphaSlider.style.background = `linear-gradient(to right, transparent, hsl(${advancedState.hue}, ${advancedState.saturation}%, ${advancedState.lightness}%))`;
    }
  }

  function getCurrentHex() {
    const h = advancedState.hue;
    const s = advancedState.saturation;
    const l = advancedState.lightness;

    // HSL to RGB
    const sNorm = s / 100;
    const lNorm = l / 100;

    const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = lNorm - c / 2;

    let r, g, b;
    if (h < 60) {
      r = c;
      g = x;
      b = 0;
    } else if (h < 120) {
      r = x;
      g = c;
      b = 0;
    } else if (h < 180) {
      r = 0;
      g = c;
      b = x;
    } else if (h < 240) {
      r = 0;
      g = x;
      b = c;
    } else if (h < 300) {
      r = x;
      g = 0;
      b = c;
    } else {
      r = c;
      g = 0;
      b = x;
    }

    const toHex = (v) => {
      const hex = Math.round((v + m) * 255).toString(16);
      return hex.length === 1 ? "0" + hex : hex;
    };

    return "#" + toHex(r) + toHex(g) + toHex(b);
  }

  function handleHexInput(hex) {
    if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) return;

    // HEX to RGB
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;

    // RGB to HSL
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h,
      s,
      l = (max + min) / 2;

    if (max === min) {
      h = s = 0;
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
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

    advancedState.hue = Math.round(h * 360);
    advancedState.saturation = Math.round(s * 100);
    advancedState.lightness = Math.round(l * 100);
    updateAdvancedPickerUI();
  }

  function updateAlphaPreview(alpha) {
    advancedState.alpha = alpha;
    updateAdvancedPickerUI();
  }

  function copyHexCode() {
    const hexInput = document.getElementById("hex-input");
    if (!hexInput) return;

    navigator.clipboard.writeText(hexInput.value).then(() => {
      const copyBtn = document.getElementById("hex-copy-btn");
      if (copyBtn) {
        const originalHTML = copyBtn.innerHTML;
        copyBtn.innerHTML = '<span class="text-green-500">✓</span>';
        setTimeout(() => {
          copyBtn.innerHTML = originalHTML;
        }, 1000);
      }
    });
  }

  function applyAdvancedColor() {
    const hex = getCurrentHex();
    setCustomColor(hex);
    closeDropdown();
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
    setScreenTheme,
    getStoredScreenTheme,
  };

  // Legacy support
  window.toggleTheme = toggleMode;
  window.getEffectiveTheme = getEffectiveMode;
})();
