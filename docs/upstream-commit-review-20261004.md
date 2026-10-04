# 2026-10-04 上游提交審查

本次直接審查提交，不以版本號判斷更新。上游 `C4illin/ConvertX` 的 `main` 最新提交仍為 `49d1db8dd06134f4423d5c1a447cce9c920156bc`，與既有已審查檢查點相同，新增主線提交為 **0**。先前 50 個提交的取捨仍保存在 `upstream-sync.json`，本次沒有改寫其決定。

另外逐項查看下列尚未合併 PR 的實際提交，提前移植有益內容。這些 PR 不代表上游已發布；完整頭部 SHA 與提交清單保存在 `upstream-sync.json.latestCommitReview.candidates`。主線檢查點不移動到 PR 頭部，Git 歷史仍採選擇性移植，沒有宣稱與上游逐檔相同。

| 來源                                                                 | 審查頭部                                   | 本地採用／取捨                                                                                                                                             |
| -------------------------------------------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [#663 測試與錯誤案例](https://github.com/C4illin/ConvertX/pull/663)  | `83960bec8249bfcddbdf6aafd54409631170e011` | 修復 FFmpeg 參數首尾空白、轉換格式陣列遭查詢汙染、VCF 後續聯絡人欄位遺漏。其他案例已有安全處理；新增本地回歸，不用 expected-failure 標記把錯誤包裝成通過。 |
| [#567 Calc／CSV](https://github.com/C4illin/ConvertX/pull/567)       | `de438e246fbd4201237744889d362d952010413e` | 分離輸入／輸出 filter、擴充試算表來源，CSV 正確使用 Calc；額外修正 TSV 的 Tab 分隔與 UTF-8。保留 PDF→DOCX 的本地匯入流程與 Works 自動偵測。                |
| [#618 FUSE 刪除](https://github.com/C4illin/ConvertX/pull/618)       | `4daf77bd669ed1a56dfdd2ac8f76444b62cac284` | 有限次重試避免 `.fuse_hidden` 無窮刪除；不追蹤符號連結，保留任務所有權、路徑檢查與分階段刪除。清理例外不會永久停止排程。                                   |
| [#620 隱藏歷史](https://github.com/C4illin/ConvertX/pull/620)        | `6f7989b5ee78b061440986db14c503c9da0f2ef6` | 結果頁與引擎頁都遵守 `HIDE_HISTORY`。                                                                                                                      |
| [#626 剪貼簿上傳](https://github.com/C4illin/ConvertX/pull/626)      | `a0910485ff4f2c2e9eb44a7f4466554c945046ba` | 走既有分塊上傳、取消與安全 DOM 流程；保留原始檔名，無副檔名或重名時推斷 MIME，避免干擾輸入框貼上。                                                         |
| [#594 來源格式提示](https://github.com/C4illin/ConvertX/pull/594)    | `aa3936842780c931bdb6466fa9aa9f72b126e877` | 根據分類與可用引擎生成來源提示；採頁面資料，不新增重複 API 或競態。支援繁中、簡中與英文。                                                                  |
| [#568 3CX 與 URL 預選](https://github.com/C4illin/ConvertX/pull/568) | `56cb6e4ede23292e56c0fb9bb2adc9b60eef5d73` | 3CX WAV 為單聲道、8 kHz、PCM16；URL 可预選既有格式，修正自動推斷覆蓋使用者／URL 選擇的問題。                                                               |
| [#612 DjVu](https://github.com/C4illin/ConvertX/pull/612)            | `b9f49f0d3472d6e95f42affaafd6751fe3851809` | DjVu→PDF／TIFF；完整版與 Lite 安裝 `djvulibre-bin`，缺少 `ddjvu` 時不可誤標可用。同步 Rust 引擎清單；驗證輸出存在且非空。                                  |
| [#607 嵌入封面](https://github.com/C4illin/ConvertX/pull/607)        | `4c56c519ac9f7d581299d4f0d60baaf162f00588` | 暫緩：需先驗證 Lite FFmpeg 與不同容器的封面映射相容性。                                                                                                    |

## 保留與暫緩

- 保留中文介面、現有外觀、WEBROOT、分塊上傳、安全檔名顯示、POST／CSRF、持久 JWT、schema v5、任務所有權與隔離、多輸出 TRA。
- 保留完整版／Lite 的可用性偵測與正式發布流程，不修改既有 `0.1.30-lite` 發布標籤。
- 翻譯引擎仍只顯示 **PDFMathTranslate**，BabelDOC 僅為必要後端依賴；保留 **SiliconFlowFree→Google→Bing** 免費預設與替代策略。
- 上游 #646 的多输出问题已有本地任务隔离／TRA治理；#571 的 CJK 字型与 #505 的深色介面已有本地实现；#631 的完整数据备份已有部署说明。备份应先停止写入，保存整个 `data`（含 `.secrets`、数据库与上传／输出目录）及 `.env`，不能只复制 SQLite 主文件。
- 其他未合併提案（Landlock、GPU／CUDA、S3、SSO、Prisma、TypeScript 7、壓縮檔展開等）不在本次移植範圍；需獨立驗證權限、依賴、資料遷移及部署相容性。未將僅看過標題的提案宣稱為完成程式碼審查。

## 持續同步

每日排程改用 `reviewedCommit..upstream/main`，不再使用本地 merge-base 誤報已審查提交。僅產生提交審查報告，不再直接合併 `dev` 或因此發布映像。上游改寫歷史則檢查失敗，保留明確審查起點。

## 驗證與限制

- 本地 Bun 回歸 **544 通過、10 個既有 placeholder 跳過、0 失敗**；實際轉換 E2E 另有 **12 通過、0 失敗**。TypeScript、ESLint、Knip、Prettier 及前端建構通過。
- 實際 CLI 驗證中文 CSV→XLSX→TSV、3CX WAV 參數與輸出、DjVu→PDF／TIFF，檢查產物而非只檢查命令退出碼。主機 LibreOffice 為 26.8 開發版，FFmpeg 7.1.5；這些結果不能代替 Docker 各版本驗證。
- Chromium 在 WEBROOT 下完成 URL 預選、剪貼簿檔案上傳、真實 VCF 轉換及帶登入 cookie 下載，確認繁中來源提示、隐藏歷史與引擎列表。
- 重新執行 PDFMathTranslate 預設服務，SiliconFlowFree 成功產生繁中單語／雙語 PDF 與 TAR，未設定服務覆寫或 API key。
- Rust `cargo test --locked --lib --bins` 可編譯，但目前沒有內建單元測試；另對真實 API 執行 JWT 驗證的 DjVu、FFmpeg／3CX、PDFMathTranslate 引擎查詢。
- **既有 Rust 整合測試仍無法編譯**：測試引用未宣告的 `axum_test`／`base64`，以及已不存在的 `build_router`／`Config` 介面與舊路由；這不是本次新增引擎造成。本次只校正 Cargo.lock 根套件版本與 Cargo.toml 一致，不擴大為 Rust 整合測試架構重寫。完整 `cargo test --locked` 不宣稱通過。
- 新分支的 Docker E2E 結果以 GitHub CI 實際結果為準，尚未發版或重新部署。
