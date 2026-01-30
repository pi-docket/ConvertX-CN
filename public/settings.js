// Settings page form handler
document.addEventListener("DOMContentLoaded", function () {
  // ==========================================================================
  // 帳號設定表單處理
  // ==========================================================================
  const form = document.querySelector("form:not(#jwt-secret-form)");
  if (form) {
    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      const formData = new FormData(form);
      const messageEl = document.getElementById("settings-message");
      const submitBtn = form.querySelector('input[type="submit"]');
      const originalValue = submitBtn.value;

      submitBtn.disabled = true;
      submitBtn.value = "...";

      try {
        const response = await fetch(form.action || window.location.pathname, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: formData.get("email"),
            newPassword: formData.get("newPassword"),
            password: formData.get("password"),
          }),
        });

        const result = await response.json();

        if (messageEl) {
          messageEl.classList.remove("hidden", "bg-green-800", "bg-red-800");

          if (response.ok) {
            messageEl.classList.add("bg-green-800");
            messageEl.textContent = result.message || "Settings updated successfully.";
            // Clear password fields on success
            const newPasswordInput = form.querySelector('input[name="newPassword"]');
            const passwordInput = form.querySelector('input[name="password"]');
            if (newPasswordInput) newPasswordInput.value = "";
            if (passwordInput) passwordInput.value = "";
          } else {
            messageEl.classList.add("bg-red-800");
            messageEl.textContent = result.message || "Failed to update settings.";
          }
        }
      } catch {
        if (messageEl) {
          messageEl.classList.remove("hidden", "bg-green-800");
          messageEl.classList.add("bg-red-800");
          messageEl.textContent = "Failed to update settings. Please try again.";
        }
      } finally {
        submitBtn.disabled = false;
        submitBtn.value = originalValue;
      }
    });
  }

  // ==========================================================================
  // JWT_SECRET 設定表單處理
  // ==========================================================================
  const jwtForm = document.getElementById("jwt-secret-form");
  if (jwtForm) {
    // 切換 JWT_SECRET 可見性
    const toggleBtn = document.getElementById("toggle-jwt-visibility");
    const jwtSecretInput = document.getElementById("current-jwt-secret");

    if (toggleBtn && jwtSecretInput) {
      toggleBtn.addEventListener("click", function () {
        if (jwtSecretInput.type === "password") {
          jwtSecretInput.type = "text";
          toggleBtn.textContent = "🔒";
        } else {
          jwtSecretInput.type = "password";
          toggleBtn.textContent = "👁";
        }
      });
    }

    // 產生隨機 JWT_SECRET
    const generateBtn = document.getElementById("generate-jwt-secret");
    const newJwtSecretInput = jwtForm.querySelector('input[name="newJwtSecret"]');

    if (generateBtn && newJwtSecretInput) {
      generateBtn.addEventListener("click", function () {
        // 產生 64 字元的隨機字串
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        let result = "";
        const array = new Uint8Array(64);
        crypto.getRandomValues(array);
        for (let i = 0; i < 64; i++) {
          result += chars[array[i] % chars.length];
        }
        newJwtSecretInput.value = result;
      });
    }

    // 表單提交
    jwtForm.addEventListener("submit", async function (e) {
      e.preventDefault();
      const formData = new FormData(jwtForm);
      const messageEl = document.getElementById("jwt-settings-message");
      const submitBtn = jwtForm.querySelector('input[type="submit"]');
      const originalValue = submitBtn.value;

      const newJwtSecret = formData.get("newJwtSecret");
      if (!newJwtSecret || newJwtSecret.length < 32) {
        if (messageEl) {
          messageEl.classList.remove("hidden", "bg-green-800");
          messageEl.classList.add("bg-red-800");
          messageEl.textContent = "JWT_SECRET 必須至少 32 個字元。";
        }
        return;
      }

      submitBtn.disabled = true;
      submitBtn.value = "...";

      try {
        const webroot = window.location.pathname.replace(/\/settings$/, "");
        const response = await fetch(`${webroot}/settings/jwt-secret`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            newJwtSecret: formData.get("newJwtSecret"),
            adminPassword: formData.get("adminPassword"),
          }),
        });

        const result = await response.json();

        if (messageEl) {
          messageEl.classList.remove("hidden", "bg-green-800", "bg-red-800");

          if (response.ok) {
            messageEl.classList.add("bg-green-800");
            messageEl.textContent = result.message || "JWT_SECRET 已更新。請重啟服務以生效。";

            // 更新顯示的 JWT_SECRET
            if (jwtSecretInput) {
              jwtSecretInput.value = formData.get("newJwtSecret");
            }

            // 清空輸入欄位
            newJwtSecretInput.value = "";
            const adminPasswordInput = jwtForm.querySelector('input[name="adminPassword"]');
            if (adminPasswordInput) adminPasswordInput.value = "";
          } else {
            messageEl.classList.add("bg-red-800");
            messageEl.textContent = result.message || "更新 JWT_SECRET 失敗。";
          }
        }
      } catch {
        if (messageEl) {
          messageEl.classList.remove("hidden", "bg-green-800");
          messageEl.classList.add("bg-red-800");
          messageEl.textContent = "更新 JWT_SECRET 失敗，請重試。";
        }
      } finally {
        submitBtn.disabled = false;
        submitBtn.value = originalValue;
      }
    });
  }
});
