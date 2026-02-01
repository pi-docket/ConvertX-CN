// Client-side i18n helper
(function () {
  const LOCALE_COOKIE_NAME = "locale";
  const LOCALE_EXPIRY_DAYS = 365;

  // Get current locale from meta tag or cookie
  function getCurrentLocale() {
    const metaLocale = document.querySelector("meta[name='locale']")?.content;
    if (metaLocale) return metaLocale;

    const cookieLocale = getCookie(LOCALE_COOKIE_NAME);
    if (cookieLocale) return cookieLocale;

    return "en";
  }

  // Get cookie value
  function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(";").shift();
    return null;
  }

  // Set cookie value
  function setCookie(name, value, days) {
    const expires = new Date();
    expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
    document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/;SameSite=Strict`;
  }

  // Get translation from window.__TRANSLATIONS__
  function t(category, key, params) {
    const translations = window.__TRANSLATIONS__ || {};
    let text = translations[category]?.[key];

    if (!text) {
      console.warn(`Missing translation: ${category}.${key}`);
      return `${category}.${key}`;
    }

    // Interpolate params
    if (params) {
      text = text.replace(/\{(\w+)\}/g, (match, paramKey) => {
        return params[paramKey] !== undefined ? String(params[paramKey]) : match;
      });
    }

    return text;
  }

  // Expose t function globally
  window.t = t;
  window.getCurrentLocale = getCurrentLocale;

  // Language selector functionality
  document.addEventListener("DOMContentLoaded", () => {
    const toggle = document.getElementById("language-toggle");
    const dropdown = document.getElementById("language-dropdown");

    if (!toggle || !dropdown) return;

    // Position the fixed dropdown
    function positionLanguageDropdown() {
      const rect = toggle.getBoundingClientRect();
      const dropdownHeight = dropdown.offsetHeight || 320;
      const dropdownWidth = dropdown.offsetWidth || 180;
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;

      // Calculate position
      let top = rect.bottom + 8;
      let left = rect.right - dropdownWidth;

      // Ensure dropdown doesn't go off-screen (bottom)
      if (top + dropdownHeight > viewportHeight - 16) {
        top = rect.top - dropdownHeight - 8;
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

    // Toggle dropdown
    toggle.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = !dropdown.classList.contains("hidden");

      // Close theme dropdown if open
      const themeDropdown = document.getElementById("theme-color-dropdown");
      if (themeDropdown && themeDropdown.style.display !== "none") {
        themeDropdown.style.opacity = "0";
        themeDropdown.style.transform = "scale(0.95)";
        setTimeout(() => {
          themeDropdown.style.display = "none";
        }, 200);
        const themeArrow = document.getElementById("theme-dropdown-arrow");
        const themeToggle = document.getElementById("theme-dropdown-toggle");
        if (themeArrow) themeArrow.style.transform = "";
        if (themeToggle) themeToggle.setAttribute("aria-expanded", "false");
      }

      if (isOpen) {
        dropdown.classList.add("hidden");
        dropdown.classList.remove("flex");
        toggle.setAttribute("aria-expanded", "false");
      } else {
        dropdown.classList.remove("hidden");
        dropdown.classList.add("flex");
        positionLanguageDropdown();
        toggle.setAttribute("aria-expanded", "true");
      }
    });

    // Close dropdown when clicking outside
    document.addEventListener("click", (e) => {
      if (!toggle.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.classList.add("hidden");
        dropdown.classList.remove("flex");
        toggle.setAttribute("aria-expanded", "false");
      }
    });

    // Handle language selection
    const options = document.querySelectorAll(".language-option");
    options.forEach((option) => {
      option.addEventListener("click", () => {
        const locale = option.dataset.locale;
        // webroot is available in option.dataset.webroot if needed for future use

        // Save to cookie
        setCookie(LOCALE_COOKIE_NAME, locale, LOCALE_EXPIRY_DAYS);

        // Reload the page to apply the new locale
        window.location.reload();
      });
    });

    // Keyboard navigation for dropdown
    toggle.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggle.click();
      }
    });

    dropdown.addEventListener("keydown", (e) => {
      const items = [...dropdown.querySelectorAll(".language-option")];
      const currentIndex = items.indexOf(document.activeElement);

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          if (currentIndex < items.length - 1) {
            items[currentIndex + 1].focus();
          }
          break;
        case "ArrowUp":
          e.preventDefault();
          if (currentIndex > 0) {
            items[currentIndex - 1].focus();
          }
          break;
        case "Escape":
          dropdown.classList.add("hidden");
          dropdown.classList.remove("flex");
          toggle.setAttribute("aria-expanded", "false");
          toggle.focus();
          break;
        case "Enter":
        case " ":
          if (document.activeElement.classList.contains("language-option")) {
            document.activeElement.click();
          }
          break;
      }
    });
  });
})();
