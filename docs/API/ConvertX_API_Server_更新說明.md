# 🚀 ConvertX API Server 更新說明（systemd 版）

本文件說明如何在 **使用 systemd 管理的情境下**，安全、可回滾地更新 ConvertX API Server。

---

## 📌 適用環境

- Web UI：Docker（對外 Port **7303**）
- API Server：systemd（對外 Port **7890**）
- Web UI 與 API Server **共用 `JWT_SECRET`**
- API Server 為 **Rust 編譯後的 binary**

---

## ✅ 更新前檢查（請先確認）

- API Server **已由 systemd 管理**
- 未使用 `./convertx-api &` 手動背景執行
- Port `7890` 未被其他程式佔用
- `.env` 中的 `JWT_SECRET` 與 Web UI 相同

---

## 🔹 Step 1：停止 API Server

```bash
sudo systemctl stop convertx-api
```
