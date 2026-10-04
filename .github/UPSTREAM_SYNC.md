# 上游提交審查與選擇性同步

`upstream-sync.json` 的 `reviewedCommit` 記錄已逐項審查的上游 `main` 提交。判斷更新時使用這個提交作為起點，不使用版本號或本地與上游的 Git merge-base。選擇性移植會保留不同的 Git 歷史；檢查點一致不代表所有檔案與上游相同。

## 每日檢查

`auto-upstream-sync.yml` 每天 UTC 03:00 執行，也可以在 Actions → Auto Upstream Sync 手動執行。它只讀取儲存庫、拉取上游並列出尚未審查的提交，有更新時保存 `upstream-commit-review` 報告。手動的 `force_sync` 只強制產生報告。

此流程不直接合併、不推送分支、不建立通知 Issue，也不發布映像。這樣可以保留中文介面、Lite 引擎可用性檢查、PDFMathTranslate 免費翻譯與本地安全措施，避免未審查更新經由舊的 `dev` 自動合併流程發布。

## 選擇性更新

1. 從最新 `main` 建立工作分支，執行 `git fetch upstream main`。
2. 執行 `bash scripts/check-upstream-commits.sh upstream/main upstream-sync.json`，依實際提交檢查變更。
3. 分別記錄採用、已有等效實作與暫緩的理由；把有益變更適配到本地架構。
4. 執行單元測試、靜態檢查、實際轉換及必要的瀏覽器／Docker E2E 驗證。
5. 全部新增的 `main` 提交都有審查決定後，才更新 `reviewedCommit`。尚未合併的上游 PR 頭部 SHA 應另行記錄，不能冒充上游 `main` 的檢查點。
6. 中文提交並建立 PR，通過 CI 後合併；正式發版仍使用本地發布流程。

當上游改寫歷史、已審查提交不再是最新提交的祖先時，檢查直接失敗並要求重新審查，不會自動回退到其他基準。

`upstream-sync.yml` 仍保留手動推送 `dev` 後的建構與 smoke test 行為；每日檢查已不再推送 `dev`，因此不會因為發現更新就觸發該發布流程。完整的本次決策見 [2026-10-04 提交審查](../docs/upstream-commit-review-20261004.md)。
