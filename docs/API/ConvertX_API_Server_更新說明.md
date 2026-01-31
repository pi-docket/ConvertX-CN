好，這是**可直接放進 GitHub / 專案用的 Markdown（`.md`）版本**，內容與你剛剛下載的 PDF **完全一致**，而且我已幫你整理成「正式文件等級」。

你可以直接存成：

```
ConvertX_API_Server_更新說明.md
```

---

````md
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
````

確認 Port 已釋放：

```bash
sudo ss -ltnp | grep 7890
```

👉 **沒有任何輸出才是正確狀態**

---

## 🔹 Step 2：備份舊版本（強烈建議）

```bash
cd ~/miniconda3/lid/app/convertx-cn

mv convertx-api convertx-api.bak.$(date +%Y%m%d_%H%M)
```

📌 目的：
若新版異常，可在 30 秒內回滾。

---

## 🔹 Step 3：下載並解壓新版 API Server

```bash
wget <release_url>/convertx-api-linux-amd64.tar.gz
tar -xzf convertx-api-linux-amd64.tar.gz
chmod +x convertx-api
```

確認檔案存在：

```bash
ls -lh convertx-api
```

---

## 🔹 Step 4：本地快速驗證（建議）

在交給 systemd 前，先手動驗證一次：

```bash
set -a
source .env
set +a

./convertx-api
```

看到以下訊息代表正常：

```
🚀 ConvertX-CN API Server vX.Y.Z
📡 Listening on http://0.0.0.0:7890
```

按 `Ctrl + C` 結束。

---

## 🔹 Step 5：交回 systemd 管理

```bash
sudo systemctl start convertx-api
sudo systemctl status convertx-api
```

應看到：

```
Active: active (running)
```

---

## 🔹 Step 6：功能驗證

### 1️⃣ Health Check

```bash
curl http://localhost:7890/api/health
```

### 2️⃣ GraphQL（需 JWT）

```bash
curl http://localhost:7890/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <JWT>" \
  -d '{ "query": "{ health { status version } }" }'
```

---

## 🔁 快速回滾（30 秒）

若新版異常：

```bash
sudo systemctl stop convertx-api

mv convertx-api convertx-api.bad
mv convertx-api.bak.* convertx-api

sudo systemctl start convertx-api
```

---

## ⚠️ 重要注意事項（必讀）

- 一旦由 **systemd 管理**
- ❌ **禁止再使用** `./convertx-api &`
- ❌ 不可同時 systemd + 手動啟動
- ❌ 不備份直接覆蓋

---

## 🧠 一句話總結

> **systemd 管服務，
> 更新就是「換 binary + restart」，
> 不需要也不應該重裝任何東西。**

---

## 📎 建議進階做法（未來可選）

- 使用 symlink 管理版本：

  ```bash
  ln -sf convertx-api-v2.0.1 convertx-api
  sudo systemctl restart convertx-api
  ```

- 藍綠更新（7890 / 7891）
- 自動更新腳本（CI/CD）

---

📄 文件用途建議：

- 放入 GitHub Repo（`docs/`）
- 作為內部 SOP
- 作為部署／交付文件

```

---

### ✅ 接下來我可以幫你做的（直接選）

1️⃣ 幫你把這份 `.md` **拆成 README + docs 結構**
2️⃣ 幫你做 **自動更新 shell script（update-api.sh）**
3️⃣ 幫你寫 **零停機藍綠更新版本**
4️⃣ 幫你把 API Server 的 Rust `unwrap()` 全部改成不 panic

你只要回我一個數字，我直接接著幫你補齊。
```
