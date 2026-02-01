// Settings page form handler - API Keys
document.addEventListener("DOMContentLoaded", function () {
  const form = document.getElementById("api-keys-form");

  if (!form) {
    console.warn("Settings form not found");
    return;
  }

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    e.stopPropagation();

    const formData = new FormData(form);
    const statusEl = document.getElementById("settings-status");
    const submitBtn = form.querySelector('input[type="submit"]');
    const originalValue = submitBtn?.value || "Update";

    // Get i18n strings from data attributes
    const successText = statusEl?.dataset.success || "Settings saved";
    const errorText = statusEl?.dataset.error || "Failed to save settings";
    const updatingText = statusEl?.dataset.updating || "Saving...";

    // Show updating status
    if (statusEl) {
      statusEl.classList.remove("hidden");
      statusEl.className =
        "rounded-md px-4 py-2 text-center text-sm transition-all bg-neutral-800 text-neutral-400";
      statusEl.textContent = updatingText;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.classList.add("opacity-60", "cursor-wait");
    }

    try {
      // Calculate webroot - handle both /settings and /prefix/settings paths
      const pathname = window.location.pathname;
      const webroot = pathname.endsWith("/settings")
        ? pathname.slice(0, -9) // Remove "/settings" (9 chars)
        : "";

      const response = await fetch(`${webroot}/settings/api-keys`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          openai_api_key: formData.get("openai_api_key") || "",
          deepseek_api_key: formData.get("deepseek_api_key") || "",
          other_llm_api_key: formData.get("other_llm_api_key") || "",
          processing_mode: formData.get("processing_mode") || "pipeline",
        }),
      });

      if (statusEl) {
        if (response.ok) {
          // Success: green background
          statusEl.className =
            "rounded-md px-4 py-2 text-center text-sm transition-all bg-green-900/50 text-green-400 border border-green-800";
          statusEl.textContent = "✓ " + successText;

          // Auto-hide success message after 3 seconds
          setTimeout(() => {
            statusEl.classList.add("hidden");
          }, 3000);
        } else {
          // Error: red background
          statusEl.className =
            "rounded-md px-4 py-2 text-center text-sm transition-all bg-red-900/50 text-red-400 border border-red-800";
          statusEl.textContent = "✕ " + errorText;
        }
      }
    } catch (err) {
      console.error("Settings save error:", err);
      if (statusEl) {
        statusEl.className =
          "rounded-md px-4 py-2 text-center text-sm transition-all bg-red-900/50 text-red-400 border border-red-800";
        statusEl.textContent = "✕ " + errorText;
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.classList.remove("opacity-60", "cursor-wait");
      }
    }

    return false; // Extra safety: prevent form submission
  });
});
