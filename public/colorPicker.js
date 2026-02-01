// ============================================================================
// Advanced Color Picker v1.0 - Figma/Linear Style
// ============================================================================
// Features:
// 1. Hue Ring (色相環)
// 2. Saturation/Lightness 2D Panel (飽和度/明度面板)
// 3. Alpha Slider (透明度滑桿)
// 4. HEX Code Input with Copy
// 5. OKLCH color space integration
// ============================================================================

(function () {
  "use strict";

  // ============================================================================
  // Color Conversion Utilities
  // ============================================================================

  // Convert HSL to RGB
  function hslToRgb(h, s, l) {
    h = h / 360;
    s = s / 100;
    l = l / 100;

    let r, g, b;

    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };

      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }

    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
  }

  // Convert RGB to HEX
  function rgbToHex(r, g, b) {
    return (
      "#" +
      [r, g, b]
        .map((x) => {
          const hex = x.toString(16);
          return hex.length === 1 ? "0" + hex : hex;
        })
        .join("")
    );
  }

  // Convert HEX to RGB
  function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : null;
  }

  // Convert RGB to HSL
  function rgbToHsl(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;
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

    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
  }

  // Convert HSL to OKLCH (approximate)
  function hslToOklch(h, s, l) {
    // Simplified conversion - uses hue directly, maps saturation to chroma
    const chroma = (s / 100) * 0.4;
    const lightness = 0.3 + (l / 100) * 0.5;
    return {
      l: Math.round(lightness * 100),
      c: chroma.toFixed(2),
      h: h,
    };
  }

  // ============================================================================
  // Advanced Color Picker Class
  // ============================================================================

  class AdvancedColorPicker {
    constructor(container, options = {}) {
      this.container = container;
      this.options = {
        size: options.size || 200,
        ringWidth: options.ringWidth || 20,
        onChange: options.onChange || (() => {}),
        initialColor: options.initialColor || "#a5d601",
      };

      this.state = {
        hue: 80,
        saturation: 100,
        lightness: 50,
        alpha: 100,
      };

      this.isDragging = null;
      this.init();
    }

    init() {
      this.parseInitialColor();
      this.render();
      this.bindEvents();
      this.updateUI();
    }

    parseInitialColor() {
      const rgb = hexToRgb(this.options.initialColor);
      if (rgb) {
        const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
        this.state.hue = hsl.h;
        this.state.saturation = hsl.s;
        this.state.lightness = hsl.l;
      }
    }

    render() {
      const size = this.options.size;
      const ringWidth = this.options.ringWidth;
      const innerSize = size - ringWidth * 2 - 20;

      this.container.innerHTML = `
        <div class="advanced-picker" style="width: ${size}px; padding: 16px;">
          <!-- Hue Ring + SL Panel Container -->
          <div class="picker-main" style="position: relative; width: ${size}px; height: ${size}px; margin: 0 auto;">
            <!-- Hue Ring (SVG) -->
            <svg class="hue-ring" width="${size}" height="${size}" style="position: absolute; top: 0; left: 0; cursor: crosshair;">
              <defs>
                <linearGradient id="hue-gradient" gradientUnits="objectBoundingBox" x1="0" y1="0" x2="1" y2="1">
                  ${Array.from({ length: 360 }, (_, i) => {
                    const [r, g, b] = hslToRgb(i, 100, 50);
                    return `<stop offset="${i / 360}" stop-color="rgb(${r},${g},${b})" />`;
                  }).join("")}
                </linearGradient>
              </defs>
              <circle 
                cx="${size / 2}" 
                cy="${size / 2}" 
                r="${(size - ringWidth) / 2}" 
                fill="none" 
                stroke="url(#hue-gradient)" 
                stroke-width="${ringWidth}"
                style="filter: blur(0.5px);"
              />
              <!-- Conic gradient overlay for smooth hue -->
              <foreignObject x="0" y="0" width="${size}" height="${size}">
                <div xmlns="http://www.w3.org/1999/xhtml" style="
                  width: 100%;
                  height: 100%;
                  border-radius: 50%;
                  background: conic-gradient(
                    from 0deg,
                    hsl(0, 100%, 50%),
                    hsl(60, 100%, 50%),
                    hsl(120, 100%, 50%),
                    hsl(180, 100%, 50%),
                    hsl(240, 100%, 50%),
                    hsl(300, 100%, 50%),
                    hsl(360, 100%, 50%)
                  );
                  -webkit-mask: radial-gradient(
                    circle at center,
                    transparent ${(size - ringWidth * 2) / 2}px,
                    black ${(size - ringWidth * 2) / 2}px,
                    black ${size / 2}px,
                    transparent ${size / 2}px
                  );
                  mask: radial-gradient(
                    circle at center,
                    transparent ${(size - ringWidth * 2) / 2}px,
                    black ${(size - ringWidth * 2) / 2}px,
                    black ${size / 2}px,
                    transparent ${size / 2}px
                  );
                "></div>
              </foreignObject>
              <!-- Hue indicator -->
              <circle 
                class="hue-indicator" 
                cx="${size / 2}" 
                cy="${ringWidth / 2}" 
                r="${ringWidth / 2 - 2}" 
                fill="white" 
                stroke="rgba(0,0,0,0.3)" 
                stroke-width="2"
                style="pointer-events: none; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.3));"
              />
            </svg>
            
            <!-- Saturation/Lightness Panel -->
            <div class="sl-panel" style="
              position: absolute;
              top: ${ringWidth + 10}px;
              left: ${ringWidth + 10}px;
              width: ${innerSize}px;
              height: ${innerSize}px;
              border-radius: 8px;
              cursor: crosshair;
              overflow: hidden;
            ">
              <div class="sl-gradient" style="
                width: 100%;
                height: 100%;
                background: linear-gradient(to right, white, hsl(${this.state.hue}, 100%, 50%));
                position: relative;
              ">
                <div style="
                  position: absolute;
                  inset: 0;
                  background: linear-gradient(to bottom, transparent, black);
                "></div>
              </div>
              <!-- SL indicator -->
              <div class="sl-indicator" style="
                position: absolute;
                width: 16px;
                height: 16px;
                border: 3px solid white;
                border-radius: 50%;
                box-shadow: 0 0 0 1px rgba(0,0,0,0.3), 0 2px 4px rgba(0,0,0,0.3);
                pointer-events: none;
                transform: translate(-50%, -50%);
              "></div>
            </div>
          </div>
          
          <!-- Alpha Slider -->
          <div class="alpha-section" style="margin-top: 16px;">
            <label style="display: block; font-size: 12px; color: #888; margin-bottom: 4px;">透明度</label>
            <div class="alpha-slider-container" style="
              position: relative;
              height: 16px;
              border-radius: 8px;
              background: 
                linear-gradient(45deg, #ccc 25%, transparent 25%),
                linear-gradient(-45deg, #ccc 25%, transparent 25%),
                linear-gradient(45deg, transparent 75%, #ccc 75%),
                linear-gradient(-45deg, transparent 75%, #ccc 75%);
              background-size: 8px 8px;
              background-position: 0 0, 0 4px, 4px -4px, -4px 0px;
              cursor: pointer;
            ">
              <div class="alpha-gradient" style="
                position: absolute;
                inset: 0;
                border-radius: 8px;
                background: linear-gradient(to right, transparent, hsl(${this.state.hue}, ${this.state.saturation}%, 50%));
              "></div>
              <div class="alpha-indicator" style="
                position: absolute;
                top: 50%;
                width: 12px;
                height: 12px;
                background: white;
                border: 2px solid #333;
                border-radius: 50%;
                transform: translate(-50%, -50%);
                box-shadow: 0 1px 3px rgba(0,0,0,0.3);
                pointer-events: none;
              "></div>
            </div>
          </div>
          
          <!-- HEX Input -->
          <div class="hex-section" style="margin-top: 16px; display: flex; gap: 8px; align-items: center;">
            <input 
              type="text" 
              class="hex-input" 
              value="${this.options.initialColor}"
              maxlength="7"
              style="
                flex: 1;
                padding: 8px 12px;
                border: 1px solid #444;
                border-radius: 6px;
                background: #222;
                color: #fff;
                font-family: monospace;
                font-size: 14px;
                text-transform: uppercase;
              "
            />
            <button class="copy-btn" title="複製 HEX 碼" style="
              padding: 8px 12px;
              border: 1px solid #444;
              border-radius: 6px;
              background: #333;
              color: #fff;
              cursor: pointer;
              transition: background 0.2s;
            ">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            </button>
          </div>
          
          <!-- Color Preview -->
          <div class="preview-section" style="margin-top: 16px; display: flex; gap: 8px;">
            <div class="color-preview" style="
              flex: 1;
              height: 40px;
              border-radius: 8px;
              border: 1px solid #444;
              background: 
                linear-gradient(45deg, #ccc 25%, transparent 25%),
                linear-gradient(-45deg, #ccc 25%, transparent 25%),
                linear-gradient(45deg, transparent 75%, #ccc 75%),
                linear-gradient(-45deg, transparent 75%, #ccc 75%);
              background-size: 8px 8px;
              overflow: hidden;
            ">
              <div class="preview-color" style="
                width: 100%;
                height: 100%;
              "></div>
            </div>
          </div>
          
          <!-- Apply Button -->
          <button class="apply-btn" style="
            width: 100%;
            margin-top: 16px;
            padding: 12px;
            border: none;
            border-radius: 8px;
            background: linear-gradient(135deg, #a5d601, #7ab800);
            color: #000;
            font-weight: 600;
            cursor: pointer;
            transition: transform 0.2s, box-shadow 0.2s;
          ">
            套用顏色
          </button>
        </div>
      `;

      // Cache elements
      this.elements = {
        hueRing: this.container.querySelector(".hue-ring"),
        hueIndicator: this.container.querySelector(".hue-indicator"),
        slPanel: this.container.querySelector(".sl-panel"),
        slGradient: this.container.querySelector(".sl-gradient"),
        slIndicator: this.container.querySelector(".sl-indicator"),
        alphaContainer: this.container.querySelector(".alpha-slider-container"),
        alphaGradient: this.container.querySelector(".alpha-gradient"),
        alphaIndicator: this.container.querySelector(".alpha-indicator"),
        hexInput: this.container.querySelector(".hex-input"),
        copyBtn: this.container.querySelector(".copy-btn"),
        previewColor: this.container.querySelector(".preview-color"),
        applyBtn: this.container.querySelector(".apply-btn"),
      };
    }

    bindEvents() {
      // Hue Ring drag
      this.elements.hueRing.addEventListener("mousedown", (e) => this.startHueDrag(e));
      this.elements.hueRing.addEventListener("touchstart", (e) => this.startHueDrag(e), {
        passive: false,
      });

      // SL Panel drag
      this.elements.slPanel.addEventListener("mousedown", (e) => this.startSLDrag(e));
      this.elements.slPanel.addEventListener("touchstart", (e) => this.startSLDrag(e), {
        passive: false,
      });

      // Alpha slider drag
      this.elements.alphaContainer.addEventListener("mousedown", (e) => this.startAlphaDrag(e));
      this.elements.alphaContainer.addEventListener("touchstart", (e) => this.startAlphaDrag(e), {
        passive: false,
      });

      // Global drag events
      document.addEventListener("mousemove", (e) => this.handleDrag(e));
      document.addEventListener("touchmove", (e) => this.handleDrag(e), { passive: false });
      document.addEventListener("mouseup", () => this.endDrag());
      document.addEventListener("touchend", () => this.endDrag());

      // HEX input
      this.elements.hexInput.addEventListener("input", (e) => this.handleHexInput(e));
      this.elements.hexInput.addEventListener("blur", () => this.validateHexInput());

      // Copy button
      this.elements.copyBtn.addEventListener("click", () => this.copyHex());

      // Apply button
      this.elements.applyBtn.addEventListener("click", () => this.applyColor());
    }

    getEventPosition(e) {
      if (e.touches && e.touches.length > 0) {
        return { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
      return { x: e.clientX, y: e.clientY };
    }

    startHueDrag(e) {
      e.preventDefault();
      this.isDragging = "hue";
      this.updateHue(e);
    }

    startSLDrag(e) {
      e.preventDefault();
      this.isDragging = "sl";
      this.updateSL(e);
    }

    startAlphaDrag(e) {
      e.preventDefault();
      this.isDragging = "alpha";
      this.updateAlpha(e);
    }

    handleDrag(e) {
      if (!this.isDragging) return;
      e.preventDefault();

      switch (this.isDragging) {
        case "hue":
          this.updateHue(e);
          break;
        case "sl":
          this.updateSL(e);
          break;
        case "alpha":
          this.updateAlpha(e);
          break;
      }
    }

    endDrag() {
      this.isDragging = null;
    }

    updateHue(e) {
      const rect = this.elements.hueRing.getBoundingClientRect();
      const { x, y } = this.getEventPosition(e);
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const angle = Math.atan2(y - centerY, x - centerX);
      let hue = (angle * 180) / Math.PI + 90;
      if (hue < 0) hue += 360;

      this.state.hue = Math.round(hue);
      this.updateUI();
      this.emitChange();
    }

    updateSL(e) {
      const rect = this.elements.slPanel.getBoundingClientRect();
      const { x, y } = this.getEventPosition(e);

      const saturation = Math.max(0, Math.min(100, ((x - rect.left) / rect.width) * 100));
      const lightness = Math.max(0, Math.min(100, 100 - ((y - rect.top) / rect.height) * 100));

      this.state.saturation = Math.round(saturation);
      this.state.lightness = Math.round(lightness);
      this.updateUI();
      this.emitChange();
    }

    updateAlpha(e) {
      const rect = this.elements.alphaContainer.getBoundingClientRect();
      const { x } = this.getEventPosition(e);

      const alpha = Math.max(0, Math.min(100, ((x - rect.left) / rect.width) * 100));
      this.state.alpha = Math.round(alpha);
      this.updateUI();
      this.emitChange();
    }

    handleHexInput(e) {
      let value = e.target.value;
      if (!value.startsWith("#")) {
        value = "#" + value;
        e.target.value = value;
      }
    }

    validateHexInput() {
      const hex = this.elements.hexInput.value;
      const rgb = hexToRgb(hex);
      if (rgb) {
        const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
        this.state.hue = hsl.h;
        this.state.saturation = hsl.s;
        this.state.lightness = hsl.l;
        this.updateUI();
        this.emitChange();
      }
    }

    copyHex() {
      const hex = this.elements.hexInput.value;
      navigator.clipboard.writeText(hex).then(() => {
        const btn = this.elements.copyBtn;
        const originalText = btn.innerHTML;
        btn.innerHTML = "✓";
        setTimeout(() => {
          btn.innerHTML = originalText;
        }, 1000);
      });
    }

    applyColor() {
      const oklch = hslToOklch(this.state.hue, this.state.saturation, this.state.lightness);
      const hex = this.getCurrentHex();

      this.options.onChange({
        hex: hex,
        hsl: {
          h: this.state.hue,
          s: this.state.saturation,
          l: this.state.lightness,
        },
        oklch: oklch,
        alpha: this.state.alpha,
      });

      // Also trigger the theme system if available
      if (window.themeSystem && window.themeSystem.setCustomColor) {
        window.themeSystem.setCustomColor(hex);
      }
    }

    getCurrentHex() {
      const [r, g, b] = hslToRgb(this.state.hue, this.state.saturation, this.state.lightness);
      return rgbToHex(r, g, b);
    }

    updateUI() {
      const size = this.options.size;
      const ringWidth = this.options.ringWidth;

      // Update hue indicator position
      const angle = ((this.state.hue - 90) * Math.PI) / 180;
      const radius = (size - ringWidth) / 2;
      const hueX = size / 2 + radius * Math.cos(angle);
      const hueY = size / 2 + radius * Math.sin(angle);
      this.elements.hueIndicator.setAttribute("cx", hueX);
      this.elements.hueIndicator.setAttribute("cy", hueY);

      // Update SL gradient hue
      this.elements.slGradient.style.background = `linear-gradient(to right, white, hsl(${this.state.hue}, 100%, 50%))`;

      // Update SL indicator position
      const innerSize = size - ringWidth * 2 - 20;
      const slX = (this.state.saturation / 100) * innerSize;
      const slY = ((100 - this.state.lightness) / 100) * innerSize;
      this.elements.slIndicator.style.left = `${slX}px`;
      this.elements.slIndicator.style.top = `${slY}px`;
      this.elements.slIndicator.style.backgroundColor = this.getCurrentHex();

      // Update alpha gradient
      this.elements.alphaGradient.style.background = `linear-gradient(to right, transparent, hsl(${this.state.hue}, ${this.state.saturation}%, ${this.state.lightness}%))`;

      // Update alpha indicator
      const alphaX = (this.state.alpha / 100) * this.elements.alphaContainer.offsetWidth;
      this.elements.alphaIndicator.style.left = `${alphaX}px`;

      // Update HEX input
      this.elements.hexInput.value = this.getCurrentHex();

      // Update preview
      const rgba = `hsla(${this.state.hue}, ${this.state.saturation}%, ${this.state.lightness}%, ${this.state.alpha / 100})`;
      this.elements.previewColor.style.background = rgba;
    }

    emitChange() {
      // Real-time preview (optional)
    }

    setColor(hex) {
      const rgb = hexToRgb(hex);
      if (rgb) {
        const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
        this.state.hue = hsl.h;
        this.state.saturation = hsl.s;
        this.state.lightness = hsl.l;
        this.updateUI();
      }
    }
  }

  // Expose to global
  window.AdvancedColorPicker = AdvancedColorPicker;
})();
