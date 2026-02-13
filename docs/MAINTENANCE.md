# ConvertX-CN 自動維護系統

## 📊 系統概覽

本文件說明 ConvertX-CN 專案的自動維護流程與監控系統。

---

## 🎯 已實現的自動化流程

### 1. 🐳 Docker Hub 驗證系統

**文件**: `.github/workflows/verify-docker-hub.yml`

**功能**:

- 在 Release workflow 完成後自動驗證 Docker Hub 上的 images
- 檢查 AMD64、ARM64 和 multi-arch manifest 是否存在
- 生成驗證報告
- 失敗時提供詳細錯誤資訊

**觸發時機**:

- Release workflow 完成後自動執行
- 可手動觸發驗證特定 tag

**使用方式**:

```bash
# 手動驗證特定版本
gh workflow run verify-docker-hub.yml -f tag=v0.1.25
```

---

### 2. 🔄 Upstream PR 自動處理

**文件**: `.github/workflows/auto-handle-upstream-pr.yml`

**功能**:

- 自動分析 upstream-sync PR
- 檢查 commits 是否已合併
- 自動關閉已合併的 PR（標記 `resolved-upstream`）
- 自動關閉依賴更新 PR（標記 `ignored-upstream`）
- 標記需要手動審查的 PR（標記 `needs-manual-review`）
- 定期清理超過 30 天的過期 PR

**處理邏輯**:

#### 情況 A: 已合併 → 自動關閉

```
如果所有 commits 已存在於 main:
  → 添加 comment "Already included"
  → 關閉 PR
  → 標記 "resolved-upstream"
```

#### 情況 B: 依賴更新 → 自動關閉

```
如果包含 renovate/dependabot/lock file 更新:
  → 添加 comment "Not merging - custom CN override"
  → 關閉 PR
  → 標記 "ignored-upstream"
```

#### 情況 C: 實質性變更 → 需要審查

```
如果包含實質性程式碼變更:
  → 添加 comment "Requires Manual Review"
  → 標記 "needs-manual-review"
  → 等待人工決策
```

---

### 3. 📦 Calibre 版本自動檢查

**文件**: `.github/workflows/check-calibre-version.yml`

**功能**:

- 每週一自動檢查 Calibre 最新版本
- 驗證新版本 binary 是否可用
- 自動更新 Dockerfile
- 創建 PR 供審查

**執行時間**:

- 每週一早上 8:00 (UTC 0:00)
- 可手動觸發

**使用方式**:

```bash
# 手動檢查 Calibre 版本
gh workflow run check-calibre-version.yml
```

**PR 內容**:

- 自動更新版本號
- 更新相關註釋
- 提供驗證清單
- 標記 `dependencies`, `docker`, `auto-update`

---

## 🛠️ 維護操作指南

### 處理 Upstream 更新

#### 步驟 1: 分析上游變更

```bash
# 取得最新 upstream
git fetch upstream

# 查看新 commits
git log HEAD..upstream/main --oneline

# 詳細查看變更
git log HEAD..upstream/main --stat
```

#### 步驟 2: 評估是否合併

**合併標準**:

✅ **應該合併**:

- 明確的 bug 修復
- 安全性更新
- 效能改進
- CI/CD 優化
- 文件更新

❌ **不應合併**:

- 依賴套件更新（有獨立管理）
- 架構重構（可能破壞 CN 功能）
- 功能移除
- 與 CN 衝突的變更

#### 步驟 3: 選擇性合併

```bash
# Cherry-pick 特定 commit
git cherry-pick <commit-sha>

# 如果衝突，優先保留 CN 功能
git status
git diff

# 解決衝突後
git add .
git cherry-pick --continue
```

---

### 處理 Docker Build 失敗

#### 常見問題與解決方案

##### 1. Calibre 下載失敗

**症狀**: `exit code: 22` (curl HTTP error)

**診斷**:

```bash
# 檢查 Dockerfile 中的版本
grep "CALIBRE_VERSION" Dockerfile

# 驗證版本是否可用
curl -I "https://github.com/kovidgoyal/calibre/releases/download/v<VERSION>/calibre-<VERSION>-x86_64.txz"
```

**解決**:

1. 查看 Calibre releases: https://github.com/kovidgoyal/calibre/releases
2. 確認最新版本
3. 更新 Dockerfile 中的 `CALIBRE_VERSION`
4. 提交並重新觸發 build

**自動化**: `check-calibre-version.yml` 會每週自動檢查

##### 2. 磁碟空間不足

**症狀**: `no space left on device`

**診斷**:

```bash
# 查看 workflow log 中的磁碟空間報告
gh run view <run-id> --log | grep "可用空間"
```

**解決**:

- Release workflow 已包含極限磁碟清理
- 如仍不足，考慮分離更多構建階段

##### 3. Docker Hub 推送失敗

**症狀**: Build 成功但 image 不在 Docker Hub

**診斷**:

```bash
# 驗證 Docker Hub 上的 image
docker manifest inspect convertx/convertx-cn:v0.1.25
```

**解決**:

1. 檢查 Docker Hub credentials
2. 確認 workflow 使用 `--push` flag
3. 檢查 Docker Hub API rate limit
4. 查看 `verify-docker-hub.yml` 報告

---

### 手動發布流程

```bash
# 1. 更新版本號
vim package.json  # 修改 "version"

# 2. 更新 CHANGELOG
vim CHANGELOG.md

# 3. 提交變更
git add package.json CHANGELOG.md
git commit -m "chore(release): v0.1.26"

# 4. 創建並推送 tag
git tag -a v0.1.26 -m "release: v0.1.26"
git push origin main --tags

# 5. 等待 Release workflow 完成
gh run watch

# 6. 驗證 Docker Hub
gh workflow run verify-docker-hub.yml -f tag=v0.1.26
```

---

## 📈 監控與驗證

### 檢查 Workflow 狀態

```bash
# 查看最近的 workflow 執行
gh run list --limit 10

# 查看特定 workflow
gh run view <run-id>

# 查看 logs
gh run view <run-id> --log

# 監控進行中的 workflow
gh run watch <run-id>
```

### 驗證 Docker Images

```bash
# 檢查 image 是否存在
docker manifest inspect convertx/convertx-cn:v0.1.25

# 檢查所有 tags
curl -s "https://hub.docker.com/v2/repositories/convertx/convertx-cn/tags?page_size=100" | jq -r '.results[].name'

# 拉取並測試
docker pull convertx/convertx-cn:v0.1.25
docker run --rm convertx/convertx-cn:v0.1.25 --version
```

### 檢查 PR 狀態

```bash
# 查看 open PRs
gh pr list --state open

# 查看特定標籤的 PRs
gh pr list --label "needs-manual-review"

# 查看已關閉的 upstream PRs
gh pr list --state closed --label "resolved-upstream"
```

---

## 🔧 故障排除

### Workflow 失敗

**問題**: Workflow 執行失敗

**步驟**:

1. 查看詳細 logs: `gh run view <run-id> --log`
2. 檢查錯誤訊息
3. 查看相關 annotations
4. 必要時手動重新執行: `gh run rerun <run-id>`

### Docker Build 超時

**問題**: Build 超過時間限制

**解決**:

- GitHub Actions 免費版限制 6 小時
- 考慮使用 self-hosted runner
- 或優化 Dockerfile（減少層數、使用 cache）

### Calibre 自動更新失敗

**問題**: Calibre 檢查 workflow 創建的 PR 失敗

**步驟**:

1. 查看 PR 內容
2. 手動驗證 Calibre 版本可用性
3. 檢查 Dockerfile syntax
4. 手動測試 Docker build

---

## 📋 定期維護清單

### 每週

- [ ] 檢查 open PRs（自動化已處理大部分）
- [ ] 查看 Calibre 版本（自動化）
- [ ] 檢查 Docker Hub images

### 每月

- [ ] 審查 upstream 變更
- [ ] 更新依賴套件
- [ ] 檢查 workflow performance
- [ ] 清理舊的 Docker tags

### 每季

- [ ] 全面審查 upstream 分支差異
- [ ] 評估是否需要重大功能合併
- [ ] 更新文件
- [ ] 性能測試

---

## 🚀 未來改進建議

### 短期 (1-2 月)

1. **增強 Docker 驗證**
   - 添加自動重試機制
   - 驗證 image size 是否合理
   - 測試基本功能（healthcheck）

2. **PR 處理增強**
   - 自動 cherry-pick 安全修復
   - 更智能的衝突檢測
   - 自動標記 PR 優先級

3. **通知系統**
   - 失敗時發送通知
   - 每週摘要報告
   - 關鍵事件警報

### 中期 (3-6 月)

1. **依賴自動更新**
   - 自動檢查所有依賴
   - 創建批量更新 PR
   - 自動化測試

2. **效能監控**
   - Docker image size 追蹤
   - Build time 趨勢分析
   - 轉換性能基準測試

3. **文件自動化**
   - 自動生成 CHANGELOG
   - API 文件自動同步
   - 版本比較報告

### 長期 (6-12 月)

1. **完全自動發布**
   - 基於 conventional commits 自動決定版本號
   - 自動生成 release notes
   - 自動化 QA 流程

2. **智能合併**
   - AI 輔助判斷是否合併 upstream
   - 自動化衝突解決
   - 風險評估系統

3. **監控儀表板**
   - 實時狀態顯示
   - 歷史趨勢圖
   - 預測性維護

---

## 📞 支援

**遇到問題？**

1. 查看本文件的故障排除章節
2. 檢查 GitHub Actions logs
3. 查看最近的 commits 和 PRs
4. 在 Issues 中搜尋類似問題

**報告問題請包含**:

- Workflow run ID
- 錯誤訊息
- 相關 logs
- 復現步驟

---

**最後更新**: 2026-02-13  
**維護者**: ConvertX-CN Team  
**版本**: v1.0
