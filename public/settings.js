// Settings page form handler - API Keys
document.addEventListener("DOMContentLoaded", function () {
  const form = document.getElementById("api-keys-form");

  if (!form) return;

  form.addEventListener("submit", async function (e) {
    e.preventDefault();

    const formData = new FormData(form);
    const messageEl = document.getElementById("settings-message");
    const submitBtn = form.querySelector('input[type="submit"]');
    const originalValue = submitBtn.value;

    submitBtn.disabled = true;
    submitBtn.value = "...";

    try {
      const webroot = window.location.pathname.replace(/\/settings$/, "");
      const response = await fetch(`${webroot}/settings/api-keys`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          openai_api_key: formData.get("openai_api_key") || "",
          deepseek_api_key: formData.get("deepseek_api_key") || "",
          other_llm_api_key: formData.get("other_llm_api_key") || "",
        }),
      });

      const result = await response.json();

      if (messageEl) {
        messageEl.classList.remove("hidden", "bg-green-800", "bg-red-800");

        if (response.ok) {
          messageEl.classList.add("bg-green-800");
          messageEl.textContent = result.message || "Settings saved.";
        } else {
          messageEl.classList.add("bg-red-800");
          messageEl.textContent = result.message || "Failed to save settings.";
        }
      }
    } catch {
      if (messageEl) {
        messageEl.classList.remove("hidden", "bg-green-800");
        messageEl.classList.add("bg-red-800");
        messageEl.textContent = "Failed to save settings. Please try again.";
      }
    } finally {
      submitBtn.disabled = false;
      submitBtn.value = originalValue;
    }
  });
});
