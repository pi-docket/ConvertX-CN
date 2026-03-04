# ConvertX-CN 上游整合策略

## 概述

ConvertX-CN 是 [C4illin/ConvertX](https://github.com/C4illin/ConvertX) 的中文在地化分支。本文件定義如何持續從上游同步更新，同時保留 CN 自定義內容。

---

## 分支架構

```
upstream/main (C4illin/ConvertX)
       │
       ▼
      dev  ← 自動同步目標（每日 03:00 UTC）
       │
       ▼
      main ← 正式發布分支（含 CN 自定義）
```

| 分支 | 用途 | 保護策略 |
|------|------|----------|
| `main` | 正式發布、CN 自定義內容 | 需透過 PR 合併 |
| `dev` | 上游同步暫存、整合測試 | 自動同步工作流操作 |

---

## 自動同步流程

### 觸發方式
- **排程**：每日 03:00 UTC（`.github/workflows/auto-upstream-sync.yml`）
- **手動**：透過 GitHub Actions `workflow_dispatch`

### 同步成功
1. 工作流自動合併 `upstream/main` → `dev`
2. 自動關閉先前的 `upstream-sync` 和 `merge-conflict` Issues
3. 建立新的成功通知 Issue

### 同步衝突
1. 工作流偵測到合併衝突
2. 檢查是否已存在 `merge-conflict` Issue
   - **有**：在既有 Issue 新增留言更新狀態
   - **無**：建立新的衝突 Issue，附帶衝突檔案清單
3. 需要維護者手動解決

---

## CN 自定義檔案清單

以下是 `main` 分支相對於上游的主要自定義區域，合併時需特別注意：

### 核心自定義（合併時保留 CN 版本）
| 路徑 | 說明 |
|------|------|
| `src/i18n/` | 多語言設定（含繁體中文） |
| `src/locales/` | 翻譯檔案 |
| `docs/` | 中文文件 |
| `public/i18n.js` | 前端國際化腳本 |

### CI/CD 自定義（合併時保留 CN 版本）
| 路徑 | 說明 |
|------|------|
| `.github/workflows/` | 自動同步、部署、驗證工作流 |
| `Dockerfile` | 包含中文字型、MinerU 等額外工具 |
| `Dockerfile.lite` | 精簡版映像 |
| `Dockerfile.full` | 完整版映像 |
| `compose.yaml` | Docker Compose 配置 |
| `scripts/` | 安裝腳本（字型、模型下載等） |

### API Server（CN 獨有）
| 路徑 | 說明 |
|------|------|
| `api-server/` | Rust GraphQL API 伺服器 |

### 模型與資源（CN 獨有）
| 路徑 | 說明 |
|------|------|
| `models/` | ONNX/VLM 模型（已加入 .gitignore） |
| `fonts/` | 中文字型 |

---

## 手動解決衝突流程

當自動同步產生衝突時，依照以下步驟處理：

### 1. 拉取最新狀態
```bash
git fetch upstream
git checkout dev
git pull origin dev
```

### 2. 嘗試合併
```bash
git merge upstream/main --allow-unrelated-histories
```

### 3. 解決衝突
依照以下優先順序決策：

| 檔案類型 | 策略 | 說明 |
|----------|------|------|
| `src/i18n/`, `src/locales/`, `docs/` | **保留 CN** | 自定義翻譯和文件 |
| `.github/workflows/` | **保留 CN** | 自定義 CI/CD |
| `Dockerfile*` | **手動合併** | 保留 CN 工具，採用上游基底更新 |
| `package.json` | **手動合併** | 採用上游依賴更新，保留 CN 額外套件 |
| `src/converters/` | **採用上游** | 通常無 CN 自定義 |
| `src/components/` | **手動合併** | 檢查是否有 i18n 相關修改 |
| 其他 `src/` | **採用上游** | 業務邏輯通常跟隨上游 |

### 4. 完成合併
```bash
git add .
git commit -m "chore: merge upstream/main (resolve conflicts, keep CN customizations)"
git push origin dev
```

### 5. 測試驗證
- `upstream-sync.yml` 會在 dev push 後自動執行建置和冒煙測試
- 確認測試通過後，建立 `dev → main` 的 PR

---

## 定期維護檢查清單

### 每週
- [ ] 檢查是否有未處理的 `merge-conflict` Issue
- [ ] 確認 dev 分支與 upstream/main 的差距不超過 2 週

### 每月
- [ ] 審查 `main` 和 `dev` 的分歧程度
- [ ] 更新本文件中的 CN 自定義檔案清單
- [ ] 檢查 Docker 映像是否需要安全更新

### 每次上游大版本更新
- [ ] 完整對比 upstream 變更清單
- [ ] 測試所有 CN 自定義功能是否相容
- [ ] 更新版本號和 CHANGELOG

---

## 統計資訊

> 以下數據為 2025 年 6 月快照，隨開發演進會變動。

- **main 獨有提交**：~250 筆（含 CN 自定義和維護提交）
- **dev 獨有提交**：~7 筆（CI 工作流 + 上游最新）
- **檔案差異**：~7,376 檔案有差異（主要來自 node_modules lock 和二進制資源）

---

## 相關文件

- [MAINTENANCE.md](MAINTENANCE.md) - 自動維護系統說明
- [auto-upstream-sync.yml](../.github/workflows/auto-upstream-sync.yml) - 同步工作流
- [upstream-sync.yml](../.github/workflows/upstream-sync.yml) - 建置測試工作流
