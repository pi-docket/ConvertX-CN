# Changelog

## [0.1.25](https://github.com/pi-docket/ConvertX-CN/releases/tag/v0.1.25) (2026-02-13)

智能上游同步、Docker 修復與完整合併。

### 🔄 Upstream Sync

- **完整合併 upstream/main**：正式合併上游 4 個提交，確保分支完全同步
- **智能衝突解決**：保留所有 CN 自訂功能的同時完成合併
  - 保留 CN 增強的 PORT 與啟動系統
  - 保留 CN 獨立的依賴管理（ESLint 9.x）
  - 保留 CN 改進的 workflow 配置
- **GitHub 分支狀態**：從 "321 ahead, 4 behind" 優化為 "321 ahead, 0 behind"
- **保護 CN 自訂功能**：確保 316+ 個 CN 獨有提交不被覆蓋
  - inferenceApi（AI 推論 API）
  - enginesApi、convertersApi、rasApi
  - memoryDiagnostics（記憶體診斷）
  - uploadChunk/downloadChunk（分塊傳輸）
  - displayStartupInfo（美化啟動資訊）
- **PORT 環境變數支援**：確認 CN 版本已支援動態 PORT 配置（優於上游實現）

### 🐛 Bug Fixes

- **Docker Build 修復**：更新 Calibre 版本從 9.1.0 到 9.2.1（9.1.0 binary 不可用）
- **結果卡片溢出修復**：修復長檔名撐破 glass 卡片邊界的問題
- **article 容器保護**：為 article 加上 `overflow: hidden` 防止內容溢出
- **table-fixed 佈局**：結果頁與歷史頁表格改用 `table-fixed`，確保欄位不被撐開

### ✨ Improvements

- **更積極的檔名截斷**：使用 `max-w-[200px]` + `truncate` + `min-w-0` 強制省略過長檔名
- **Hover 顯示完整名稱**：所有檔名元素加上 `title` 屬性，滑鼠懸停即可查看完整檔名
- **箭頭符號固定寬度**：歷史頁箭頭加上 `shrink-0`，防止被文字擠壓

### 🤖 Automation

- **Docker Hub 自動驗證**：Release 後自動驗證 images 是否成功推送
- **PR 智能處理**：自動處理 upstream-sync PR，識別已合併/依賴更新
- **Calibre 版本檢查**：每週自動檢查並創建更新 PR

### 📊 Version Analysis

- **上游版本**：v0.17.0（基礎版本）
- **CN 版本**：v0.1.25（增強版本）
- **分支狀態**：321 commits ahead, 0 commits behind（完全同步）
- **合併策略**：完整 merge upstream/main + 智能衝突解決

---

## [0.1.24](https://github.com/pi-docket/ConvertX-CN/releases/tag/v0.1.24) (2026-02-05)

MinerU 後端優化與 Lite 版本 Dockerfile 優化。

### 🐛 Bug Fixes

- **MinerU 後端配置**：將 MinerU 預設使用 pipeline 模式，提升轉換穩定性

### 🔧 Docker

- **Lite Dockerfile 優化**：優化輕量版 Docker 映像構建流程

---

## [0.1.23](https://github.com/pi-docket/ConvertX-CN/releases/tag/v0.1.23) (2026-02-03)

多語言翻譯與程式碼品質修復版本。

### ✨ Features

- **主題選擇器新增主題**
  - 新增 Prismatic（炫彩）全螢幕主題
  - 已為全部 65 種語言添加對應翻譯

### 🐛 Bug Fixes

- **移除設定頁面**：刪除未完成的 settings.tsx 頁面
- **記憶體管理優化**：移除未使用的 `getTask` 導出函數
- **程式碼清理**：移除未使用的導入（`join`、`WEBROOT`）
- **參數命名修正**：將未使用的 `memoryInfo` 參數重命名為 `_memoryInfo`
- **E2E 測試修復**：使用 `test.skipIf()` 優雅跳過缺少工具的測試

### 🔧 Docker

- **xvfb-run 安裝驗證**：在 Dockerfile 中添加 xvfb-run 可用性檢查，確保 Inkscape 和 Calibre 的 headless 模式正確運作

### 🌐 Translations

- **全部語言翻譯補齊**：為 62 種語言添加 `screenThemePrismatic` 翻譯
  - 歐洲語言：德語、法語、西班牙語、義大利語、葡萄牙語、俄語等
  - 亞洲語言：日語、韓語、印地語、孟加拉語、泰語、越南語等
  - 中東語言：阿拉伯語、希伯來語、波斯語、土耳其語
  - 非洲語言：斯瓦希里語、祖魯語、阿姆哈拉語等

### 🔧 Code Quality

- 通過完整的 lint 檢查（tsc、knip、eslint、prettier）
- 修復所有 TypeScript 類型錯誤
- 統一程式碼格式

---

## [0.1.22](https://github.com/pi-docket/ConvertX-CN/releases/tag/v0.1.22) (2026-02-02)

UI 修復與程式碼品質改進版本。

### ✨ Features

- **主題選擇器改進**：支援亮色/暗色模式自適應顏色
  - 自訂顏色區塊的文字顏色會根據目前主題自動調整
  - HEX 輸入框、透明度標籤等元素使用 CSS 變數確保可見性
  - 改善棋盤格背景色以適應不同主題

### 🐛 Bug Fixes

- **下拉選單定位修復**：修復主題/語言選擇器在捲動或窄視窗時的定位問題
  - 動態計算下拉選單寬度，避免超出視窗邊界
  - 使用 `position: fixed` 和 DOM 移動機制，解決 z-index 堆疊問題
  - 新增 `isolation: isolate` 確保正確的層級關係

- **亮色模式文字可見性**：修復自訂顏色選擇器在亮色模式下文字不可見的問題
  - 將硬編碼的暗色模式顏色改為 CSS 變數（`--glass-text`、`--glass-text-muted`）

### 🔧 Code Quality

- **ESLint 配置升級**：遷移至 ESLint 9.x flat config 格式
  - 修正 `better-tailwindcss` 插件配置方式
  - 更新規則名稱 `no-unregistered-classes`
  - 新增自訂 CSS class 忽略模式

- **移除未使用程式碼**：清理未使用的導入和函式
  - 移除 `@typescript-eslint/parser` 依賴
  - 清理 `startupStatus.ts` 未使用的導入
  - 使用 `Bun.spawnSync()` 替代 `require("node:child_process")`

---

## [0.1.21](https://github.com/pi-docket/ConvertX-CN/releases/tag/v0.1.21) (2026-02-01)

主題顏色系統重構版本。

### ✨ Features

- **主題顏色選擇器重構**：全新的顏色選擇 UI
  - 亮/暗模式切換按鈕（太陽/月亮圖標）
  - 下拉箭頭展開顏色選擇器
  - 僅顯示色塊（無文字），點擊即時套用
  - 支援單色、漸層、霓虹、自訂顏色
  - 自訂顏色使用原生 Color Picker
  - localStorage 持久化和系統偏好偵測

- **新增主題顏色**：
  - 單色：綠、藍、紫、粉、橙、青、灰、黃
  - 漸層：極光、日落、海洋、森林、火焰
  - 霓虹：霓虹青、霓虹粉、霓虹紫、霓虹綠、彩虹

### 🐛 Bug Fixes

- **TypeScript 類型修復**：修復 `startupStatus.ts` 中 server 參數類型不相容問題
- **ESLint 修復**：移除未使用的 `version` 導入，將 `require()` 改為 ES module 導入

### 📦 Build

- **theme.js 重構**：從 v3.0 升級到 v4.0
  - 新增顏色選擇功能（setColor、setCustomColor）
  - 新增下拉選單管理（toggleDropdown、closeDropdown）
  - 支援 data-color 和 data-style CSS 屬性選擇器

- **colors.css 擴充**：新增 Yellow、Forest、Fire 漸層主題

---

## [0.1.20](https://github.com/pi-docket/ConvertX-CN/releases/tag/v0.1.20) (2026-01-31)

API Server 代理模式重構與部署優化版本。

### ✨ Features

- **API Server 代理模式**：重構 API Server 為輕量代理
  - API Server 不再自行安裝轉換工具，改為轉發請求給 Web UI
  - Image 體積從 ~2GB 縮小至 ~50MB
  - 新增 `CONVERTX_BACKEND_URL` 環境變數設定後端地址
  - 架構更清晰：外部程式 → API Server (代理) → Web UI (轉換)

- **UI 搜尋增強**：支援按引擎名稱搜尋轉換器
  - 可搜尋 "ffmpeg"、"imagemagick" 等引擎關鍵字
  - 同時支援目標格式和引擎名稱的模糊搜尋

### 📝 Documentation

- **部署文檔重寫**：簡化 Docker 部署指南
  - 移除過時的 `docker-compose.production.yml`
  - 新增一鍵部署腳本（CPU/GPU 版本）
  - 新增 API Server 代理模式說明
  - 更新 JWT 統一認證配置說明

### 🐛 Bug Fixes

- **API Server Dockerfile**：修復套件安裝錯誤
  - 移除不存在的套件：`imagemagick-7.q16`、`resvg`、`dasel`
  - 代理模式不需要安裝這些工具

### 📦 Build

- **Dockerfile.lite 版本同步**：更新至 v0.1.20-lite
- **版本號統一**：同步更新 package.json、version.json、Dockerfile

---

## [0.1.19](https://github.com/pi-docket/ConvertX-CN/releases/tag/v0.1.19) (2026-01-28)

Docker 構建修復與 SEO 優化版本。

### 🐛 Bug Fixes

- **ImageMagick 版本修復**：修復 Docker build 時 `magick` 命令找不到的問題
  - 問題原因：版本號 `7.1.2-13` 在 GitHub 上不存在，導致下載失敗
  - 修復方案：改用正確版本 `7.1.1-47`（2025-01 官方最新穩定版）
  - 額外改進：分離運行時庫與編譯依賴，添加編譯過程日誌

- **MinerU doclayout_yolo 模組修復**：修復 `mineru -m auto` 出現 `ModuleNotFoundError: No module named 'doclayout_yolo'` 錯誤
  - 問題原因：`doclayout-yolo` 不是 MinerU 的直接依賴，但 hybrid/layout pipeline 需要它
  - 修復方案：在 Dockerfile 中額外安裝 `doclayout-yolo` 並驗證模組載入

### ✨ Features

- **版本公告靜態檔**：新增 `public/version.json` 作為官方網站版本公告
  - 用於 Cloudflare Pages 部署，供客戶端查詢最新版本
  - 包含 app、version、updatedAt 欄位

### 🎨 SEO 優化

- **JSON-LD 結構化資料**：添加 WebSite schema 結構化資料
  - 修正 Google 搜尋結果顯示「DigitalPlat」而非「ConvertX-CN」的問題
  - 添加 publisher、potentialAction 等 schema.org 屬性
- **Twitter Card 增強**：添加 `twitter:site` meta 標籤

### 📦 Build

- **ImageMagick 7.1.1-47**：使用正確的 GitHub release 版本
- **ARM64 MinerU 標記**：ARM64 平台添加 disabled 標記檔案
  - 創建 `/opt/convertx/disabled-engines/mineru`
  - 設置 `MINERU_DISABLED=1` 環境變數

---

## [0.1.18](https://github.com/pi-docket/ConvertX-CN/releases/tag/v0.1.18) (2026-01-26)

輸出治理系統與轉換器修復版本。

### ✨ Features

- **TRA 封裝系統**：新增 Transfer Result Archive (TRA) 封裝機制
  - 規則：單一輸出直接交付，多輸出自動封裝為 `.tra` 檔案
  - TRA 使用 tar 格式（無壓縮），包含 preview + artifacts/ + manifest.json
  - 完整的 manifest 結構，記錄任務類型、引擎、輸出數量等資訊

- **FFmpeg 輸出治理**：強制禁止 deprecated pixel format
  - 禁止 `yuvj420p`（deprecated），強制使用 `yuv420p` + `-color_range pc`
  - 圖片輸出自動加入 `-frames:v 1` 限制單張輸出
  - 新增 `validateFFmpegArgs()` 驗證函式

- **PDF Packager 下載修復**：修復輸出檔名與下載路徑不匹配問題
  - PDF Packager 輸出 `pack_<chip>.tar`，正確記錄到資料庫

### 🐛 Bug Fixes

- **OCRmyPDF Ghostscript 修復**：修復 Ghostscript 10.0.0-10.02.0 regression
  - 加入 `--output-type pdf` 參數避免 `--skip-text` 失效問題

- **BabelDOC CLI 修復**：更新 CLI 參數以符合新版 babeldoc
  - 使用 `--files`, `--output`, `--lang-out` 替代舊參數
  - 新增輸出檔案自動探索（支援 -mono.pdf, -dual.pdf 命名）

- **PDFMathTranslate 版本鎖定**：修復 scs AttributeError
  - 固定 `pdf2zh==1.9.11`，避免 2.0 版破壞性變更
  - 固定 `pdfminer.six<20251229`，避免新版 API 不兼容

### 📦 Build

- **版本號更新**：v0.1.18
- **Dockerfile 改進**：
  - 新增 pdf2zh 和 pdfminer.six 版本鎖定
  - 更新注釋說明版本固定原因

### 📝 Documentation

- **新增輸出治理文件**：`docs/功能說明/輸出治理.md`
  - 完整說明 TRA 封裝格式與設計理念
  - FFmpeg 像素格式治理規則
  - 單輸出 vs 多輸出判斷邏輯

---

## [0.1.17](https://github.com/pi-docket/ConvertX-CN/releases/tag/v0.1.17) (2026-01-25)

CPU-only 輕量版，大幅減小 Docker Image 大小。

### ✨ Features

- **CPU-only 輕量版**：將預設 Docker Image 改為 CPU-only 模式
  - 移除 PyTorch CUDA 依賴（`libtorch_cuda.so` ~5-8GB）
  - Image 大小從 ~18GB 降至 ~3-5GB
  - MinerU 仍可正常運行，使用 `pipeline` backend 在純 CPU 環境執行

- **GPU 加速可選**：在 `Dockerfile.full` 中新增 GPU 加速選項
  - 用戶可取消註解以安裝 PyTorch CUDA
  - 適合有 NVIDIA GPU 且需要高速 PDF 解析的使用者

### 📦 Build

- **Dockerfile 改進**：
  - 將 `mineru[all]` 改為 `mineru`，避免安裝 PyTorch CUDA
  - 更新注釋說明 CPU-only 設計理念
- **Dockerfile.full 更新**：
  - 新增 GPU 加速區塊（註解狀態，用戶可自行啟用）
  - 更新擴充功能總覽表

### 📝 Notes

- 需要 GPU 加速的用戶請使用 `Dockerfile.full` 並啟用 PyTorch CUDA 區塊
- CPU 模式下 MinerU 速度較慢，但功能完整

---

## [0.1.16](https://github.com/pi-docket/ConvertX-CN/releases/tag/v0.1.16) (2026-01-24)

一般版 Docker Image 修復版本，確保開箱即用。

### 🐛 Bug Fixes

- **一般版 Docker Image 大小修復**：修復 0.1.15 版本 image 體積異常問題
  - 問題：一般版 image 僅約 1.5-2 GB，應為 8-12 GB
  - 原因：release.yml 未明確指定 Dockerfile，可能導致 cache 問題
  - 修復：明確指定 `file: Dockerfile` 並使用獨立的 cache key

- **嚴格模型驗證**：新增 build-time 模型驗證機制
  - 若 ONNX 模型缺失或過小，build 將失敗
  - 若 PDFMathTranslate 字型數量不足，build 將失敗
  - 確保發布的 image 一定包含所有必要模型

- **下載重試機制**：所有 curl 下載增加重試機制
  - 新增 `--retry 3 --retry-delay 5 --retry-all-errors` 參數
  - 覆蓋範圍：Bun、dasel、resvg、vtracer、ONNX 模型、字型檔案

### 📦 Build

- **release.yml 改進**：
  - 新增 `file: Dockerfile` 明確指定使用一般版 Dockerfile
  - 使用 `buildcache-full` 作為 cache key，避免與 Lite 版交叉污染
- **Dockerfile 強化**：
  - 版本號更新為 v0.1.16
  - 新增嚴格模型驗證區塊（驗證 ONNX、字型、MinerU）
  - 驗證失敗時 build 將中止並報錯
  - 所有下載均添加重試機制

### 📚 Documentation

- **版本術語統一**：
  - **一般版**（Standard）：官方預建版 `convertx-cn:latest`，約 8-12 GB，開箱即用
  - **擴充版**（Extended）：使用 `Dockerfile.full` 自建，支援 65 種 OCR 語言，>10 GB
  - **Lite 版**（Lightweight）：`convertx-cn:latest-lite`，約 1.2 GB，基本轉檔
- **環境變數文檔重整**：
  - 刪除重複的 `docs/環境變數總覽.md`
  - 改進 `docs/配置設定/環境變數.md` 結構
  - 新增快速參考表（分類：安全性、一般、轉換、PDF翻譯）
- **Docker 部署指南更新**：
  - 新增版本對照表
  - 明確三種版本的區別與適用場景

---

## [0.1.15](https://github.com/pi-docket/ConvertX-CN/releases/tag/v0.1.15) (2026-01-24)

Docker 基礎架構優化版本，新增 Lite 版 Docker Image。

### ✨ Features

- **Lite 版 Docker Image**：新增輕量版 Docker Image，適合資源受限環境
  - 目標體積 < 1.5 GB（vs 一般版 8-12 GB）
  - 保留日常最常用功能：LibreOffice、FFmpeg、Pandoc、Ghostscript、qpdf
  - 移除 AI/OCR/翻譯等進階功能
  - 支援 amd64 和 arm64 架構
  - Runtime 憑證初始化（容器首次啟動時自動產生簽章憑證）

### 📦 Build

- **Docker Build Lite Workflow**：新增 `docker-build-lite.yml` 自動觸發 Lite 版構建
  - Tag 格式：`v*.*.*-lite`（如 `v0.1.15-lite`）
  - 動態版本號修改（Build-time 自動加上 `-lite` 後綴）
  - 分開處理 GHCR 和 Docker Hub manifest 推送，避免跨 registry 問題

### 🐛 Bug Fixes

- **Lite 版 endesive 問題**：移除 build-time endesive 安裝，改用 runtime 初始化
  - 解決 ARM64 架構上 pykcs11 編譯失敗的問題
  - PDF 簽章功能改為可選（需使用者自行安裝 endesive 或使用一般版）

---

## [0.1.14](https://github.com/pi-docket/ConvertX-CN/releases/tag/v0.1.14) (2026-01-23)

OCR 功能強化版本，新增 OCRmyPDF 轉換引擎。

### ✨ Features

- **OCRmyPDF 轉換引擎**：新增獨立的 OCR 轉換引擎，支援將掃描版 PDF 轉換為可搜尋 PDF
  - 支援 7 種語言：英文、繁體中文、簡體中文、日文、韓文、德文、法文
  - 與 PDFMathTranslate 風格一致的 UI 格式（`pdf-en`、`pdf-zh-TW` 等）
  - 自動偵測頁面方向並旋轉
  - 自動校正傾斜
  - 跳過已有文字層的頁面
  - 詳細的5階段處理進度輸出

### 📦 Build

- **Dockerfile**：安裝 ocrmypdf 與 Tesseract OCR 語言包（階段 9/11）

### 📚 Documentation

- 更新 OCR 功能文件，說明 OCRmyPDF 轉換引擎用法

---

## [0.1.13](https://github.com/pi-docket/ConvertX-CN/releases/tag/v0.1.13) (2026-01-23)

工作流程優化與測試修復版本。

### 📦 CI/CD

- **翻譯測試優化**：改用免費翻譯服務（Google/Bing），移除付費 API 金鑰依賴
- **自動化測試**：翻譯測試現在會在 push 時自動執行

### 🧪 Testing

- **Inkscape 測試修復**：更新測試以配合 xvfb-run 包裝器
- **format-matrix 測試修復**：修復超時參數中的 `sampled` 未定義錯誤

---

## [0.1.12](https://github.com/pi-docket/ConvertX-CN/releases/tag/v0.1.12) (2026-01-23)

測試與品質強化版本，大幅提升 CI/CD 可靠性與測試覆蓋率。

### 🧪 Testing

- **E2E 測試套件**：新增完整的 End-to-End 測試架構，覆蓋 21 項轉換流程
- **CI/CD E2E 整合**：在 Release 工作流程中加入 E2E 測試驗證
- **Mock 測試優化**：重構 E2E 測試架構，移除殘留檔案

### 🐛 Bug Fixes

- **帳戶頁面 XSS 修復**：使用 `<span safe>` 包裹翻譯文字，修復 HTML 標籤顯示為純文字的問題
- **Inkscape Headless 模式**：使用 `xvfb-run` 執行 Inkscape，解決 Docker 容器內無顯示器的問題
- **Inkscape Export 語法**：改用 `--export-type` 與 `--export-filename` 參數，確保跨版本相容性
- **bun.lock 同步**：修復套件管理器寫入權限問題

### 📦 CI/CD

- **模型驗證**：新增模型完整性驗證步驟
- **Headless 驗證**：新增無頭模式環境檢查
- **Merge 策略**：採用 `--no-ff` 合併策略，保留完整分支歷史

### 📚 Documentation

- **README 更新**：新增測試功能說明與注意事項

---

## [0.1.11](https://github.com/pi-docket/ConvertX-CN/releases/tag/v0.1.11) (2026-01-22)

穩定性與品質維護版本。

### 🛡️ Stability & Quality

- **模型驗證腳本**：新增 `verify-models.sh` 腳本，可在容器內驗證預下載模型完整性
- **Dockerfile 版本標示**：明確標註 v0.1.11 版本資訊

### 🔧 Maintenance

- 更新工作流程中的 Node.js 和 Bun 版本
- 調整 CI/CD 依賴項版本
- 修正工作流程名稱格式
- 新增遠端服務更新工作流程（透過 Tailscale SSH 更新 Docker 服務）

### ✅ Quality Assurance

- 159 個測試全數通過
- TypeScript / ESLint / Prettier / Knip 檢查全數通過
- Build 流程驗證完成

---

## [0.1.10](https://github.com/pi-docket/ConvertX-CN/releases/tag/v0.1.10) (2026-01-21)

在 0.1.10 版本中，ConvertX-CN 迎來了多項重大功能擴充與架構強化。這是一個里程碑式的版本，為專案帶來了全新的 API 伺服器、兩個強大的文件轉換引擎，以及完整的大檔案傳輸機制。

### ✨ Features

- **Rust API Server（全新）**：新增獨立的 Rust API 伺服器，同時支援 REST API 與 GraphQL API。所有 API 請求皆需 JWT Bearer Token 驗證，整合 20+ 種轉換引擎，並在轉換不支援時自動回傳可用替代方案。這為程式化呼叫 ConvertX 開啟了全新的可能性。

- **MinerU 文件轉換引擎**：整合 MinerU 智慧文件解析引擎，支援將 PDF、PPT、PPTX、DOC、DOCX、XLS、XLSX 等文件轉換為 Markdown 格式。提供兩種輸出模式：`md-t`（表格模式）與 `md-i`（圖片模式），轉換結果以 `.tar` 封裝輸出。

- **PDFMathTranslate 翻譯引擎**：新增 PDF 數學公式保留翻譯功能，支援 15 種目標語言（包含繁體中文、簡體中文、英文、日文、韓文、德文、法文等）。轉換結果包含原始 PDF 與翻譯後 PDF，一同打包為 `.tar` 檔案。

- **分塊傳輸機制（Chunk Transfer）**：針對大檔案傳輸設計的全新機制。超過 10MB 的檔案將自動切割為 5MB 分塊上傳，並支援斷點續傳與亂序上傳合併。下載端同樣支援分塊下載，確保大檔案傳輸穩定可靠。

- **深色模式切換**：Header 新增主題切換按鈕，支援淺色 / 深色模式一鍵切換，偏好設定自動儲存至本地。

### 🐛 Bug Fixes

- **Lint 問題修復**：修復 XSS K601 安全警告、Knip 未使用匯出偵測、以及 ESLint 錯誤，確保程式碼品質符合規範。

### 📦 Infrastructure

- **Docker Compose 擴充**：新增 API Server 的 Docker Compose profiles 整合，可透過 `--profile api` 一併啟動 API 伺服器。包含完整的環境變數範例與健康檢查腳本。

- **Dockerfile 強化**：擴充主 Dockerfile 以支援 PDFMathTranslate 所需的 Python 環境與模型預載。

### 📚 Documentation

- **README 大幅擴充**：新增 API Server 說明、新轉換器介紹、以及更詳細的部署指南。
- **i18n 文件更新**：新增主題切換相關的國際化字串，覆蓋所有 65 種語言。

### 🧪 Testing

- 新增 MinerU converter 完整測試（11 個測試案例）
- 新增 PDFMathTranslate converter 完整測試（13 個測試案例）
- 新增 Chunk Transfer 模組完整測試（上傳 / 下載 / 封裝共 32 個測試案例）
- 所有 159 個測試案例全數通過

---

## [0.1.9](https://github.com/pi-docket/ConvertX-CN/releases/tag/v0.1.9) (2026-01-20)

### ✨ Features

- **全頁拖曳上傳**：檔案可拖曳到頁面任何位置上傳
- **Setup 頁面語言切換**：首次設定頁面新增語言選擇器

### 🐛 Bug Fixes

- **語言選擇器 UI 修復**：
  - 語言 icon 尺寸從 h-5 w-5 增大至 h-6 w-6，與文字視覺高度一致
  - Dropdown 背景改為完全不透明，提升可讀性
  - 新增 scrollbar 樣式，改善滾動體驗
  - 邊框顏色加深，增強視覺對比

### 🌍 i18n

- **提示訊息國際化**：所有 confirm / alert 訊息改用 i18n
- **Setup 頁面 i18n 完整化**：首次設定頁面所有文字皆使用 i18n key

### 📚 Documentation

**README 重新定位為「開箱即用」**：

- 精簡至 100 行內，5 分鐘完成部署
- 只保留必要參數說明
- 進階內容移至 docs 子目錄

**新增文件結構**：

| 目錄               | 內容                               |
| ------------------ | ---------------------------------- |
| `docs/deployment/` | quickstart, docker-compose, update |
| `docs/config/`     | environment, security              |
| `docs/versions/`   | latest, pinned-version             |

**文件拆分原則**：

- README = 新手入口（一分鐘看懂怎麼部署）
- docs/ = 進階參考（完整設定、情境範例）
- 每個文件都有清楚的連結導航

---

## [0.1.8](https://github.com/pi-docket/ConvertX-CN/releases/tag/v0.1.8) (2026-01-20)

### 🐛 Bug Fixes

- **LibreOffice PDF→DOCX**: 修復 PDF 轉 DOCX 一定失敗的問題
  - 新增 PDF Import Pipeline：使用 `--infilter=writer_pdf_import`
  - 分流邏輯：PDF→文字格式 vs 一般轉換
  - 支援 PDF→DOCX/ODT/RTF/TXT/HTML

### 🛡️ Reliability

- **輸出檔案驗證**: 新增 `existsSync` 檢查，確保轉換真的成功
- **錯誤訊息優化**: 根據 stderr 內容提供有意義的中文錯誤訊息
  - 識別加密檔案、損壞檔案、缺少 filter 等情況
  - 避免 ENOENT 錯誤擴散

### 📝 Technical Notes

- LibreOffice 架構說明：
  - Export Pipeline：原生格式→導出格式（DOCX→PDF）
  - Import Pipeline：非原生格式→原生格式（PDF→DOCX）
  - PDF 作為輸入時必須使用 `writer_pdf_import`

### ⚠️ Known Limitations

以下情況仍會失敗（LibreOffice 限制）：

- 加密/密碼保護的 PDF/DOCX
- 損壞的檔案
- 缺少必要字型（可能成功但版面錯亂）
- 並行大量轉檔（LibreOffice 對 concurrent instance 不友善）

---

## [0.1.7](https://github.com/pi-docket/ConvertX-CN/releases/tag/v0.1.7) (2026-01-20)

### 🐛 Bug Fixes

- **登入問題**: 修復遠端部署時登入後被導回登入頁的問題
  - 將 Cookie `sameSite` 從 `strict` 改為 `lax`
  - 新增 Cookie `path` 設定確保覆蓋整個應用
  - 新增 `TRUST_PROXY` 環境變數支援 reverse proxy

### 🚀 Features

- **Dockerfile 擴充**: 直接內建進階功能（不再分 Full 版）
  - 新增 `texlive-lang-arabic` 阿拉伯語 LaTeX 支援
  - 新增 `texlive-lang-other` 希伯來語等 LaTeX 支援
  - 新增 `python3-opencv` 電腦視覺轉換支援
  - 新增 `libavcodec-extra` 額外影片編解碼器
- **Locale**: 預設改為 `zh_TW.UTF-8` 確保中文 PDF 正確顯示
- **Pandoc**: PDF 引擎改用 `pdflatex` 提高相容性

### 📝 Docs

- 更新 compose.yaml 加入 `TRUST_PROXY` 說明
- 新增遠端部署注意事項

---

## [0.1.6](https://github.com/pi-docket/ConvertX-CN/releases/tag/v0.1.6) (2026-01-20)

### Features

- **Docker 架構**: 整理並優化官方 Dockerfile
  - 更新 Dockerfile 註解與文件說明
  - 新增 Dockerfile.full 完整版範本
- **Dockerfile.full**: 進階使用者自行 build 的完整範本
  - 包含 65 種 OCR 語言（預設關閉）
  - 包含完整 TexLive 選項（預設關閉）
  - 包含額外字型套件（預設關閉）
  - 所有進階功能以註解方式提供，使用者自行選擇

### Docs

- 更新 docs/docker.md
  - 說明官方 Image vs 完整版差異
  - 新增自訂 Build 指南
  - 新增可選功能大小說明

### Optimization

- 優化 Dockerfile 結構與註解
- 清楚標示哪些功能未內建於官方 Image

---

## [0.1.5](https://github.com/pi-docket/ConvertX-CN/releases/tag/v0.1.5) (2026-01-20)

### Features

- **註冊功能**: 移除 ACCOUNT_REGISTRATION 限制，註冊頁面始終可用
- **語言選單**: UI 改為可滾動（max-height: 320px），避免畫面被撐爆
- **文件系統**: 新增 FAQ 常見問題文件

### Bug Fixes

- Login 頁面始終顯示 Register 連結
- 註冊後可直接登入（與原作者 v0.17.0 行為一致）

### Docs

- 簡化 README 快速開始說明
- 更新 getting-started.md 加入資料夾初始化指令
- 新增 docs/faq.md 常見問題

---

## [0.1.4](https://github.com/pi-docket/ConvertX-CN/releases/tag/v0.1.4) (2026-01-20)

### Features

- **i18n**: 擴展支援 65 種語言（從 5 種大幅擴展）
  - 歐洲語系：de, fr, es, it, pt, ru, nl, pl, uk, cs, sv, da, fi, no, el, hu, ro, bg, hr, sk, sl, lt, lv, et, sr, ca, eu, gl, is, ga, cy, mt, mk, sq
  - 中東語系：ar, he, fa, tr
  - 南亞語系：hi, bn, ta, te, mr, gu, kn, ml, ne, si
  - 東南亞語系：th, vi, id, ms, fil, my, km, lo
  - 非洲語系：af, sw, am, zu
- **註冊功能**: 預設開放使用者註冊（開箱即用）
- **文件**: 完整的文件系統
  - 新增 getting-started.md 快速入門指南
  - 新增 docker.md Docker 部署指南
  - 新增 environment-variables.md 環境變數說明
  - 新增 url-id-and-storage.md 儲存結構說明
  - 新增 advanced-usage.md 進階使用指南
  - 更新 i18n.md 65 種語言清單

### Bug Fixes

- 修復 i18n 模組導入路徑問題
- 修復 TypeScript 編譯錯誤

### Breaking Changes

- `ACCOUNT_REGISTRATION` 預設值從 `false` 改為 `true`（開箱即用）

---

## [0.1.3](https://github.com/C4illin/ConvertX/releases/tag/v0.1.3) (2026-01-20)

### Features

- **i18n**: Add multi-language UI support with 5 languages
  - English (en) - default
  - Traditional Chinese (zh-TW) / 繁體中文
  - Simplified Chinese (zh-CN) / 简体中文
  - Japanese (ja) / 日本語
  - Korean (ko) / 한국어
- Add language selector dropdown in navigation header
- Auto-detect user's preferred language from browser settings
- Persist language preference in cookies
- All UI text (buttons, labels, messages, errors) now supports translation
- Extensible i18n architecture for adding more languages in the future

### Technical Details

- New `/src/i18n/` directory with translation core functionality
- New `/src/locales/` directory with JSON translation files
- New `LanguageSelector` component for language switching
- Updated all page components to support localization
- Client-side translation helper for dynamic content

---

## [0.15.0](https://github.com/C4illin/ConvertX/compare/v0.14.1...v0.15.0) (2025-10-07)

### Features

- add download all file by file alongside the tar download ([#415](https://github.com/C4illin/ConvertX/issues/415)) ([3e7e95b](https://github.com/C4illin/ConvertX/commit/3e7e95b53c78469f4aada996e835fcc6b9fde134))
- vtracer implemented and added docker file binaries install ([76c840d](https://github.com/C4illin/ConvertX/commit/76c840dbaa4a26d0623422b61581bb761ad6a6bc))

### Bug Fixes

- add language env ([f789d9d](https://github.com/C4illin/ConvertX/commit/f789d9dfe381780dcc715b70bcf304d570a73e3f))
- add lmodern ([761f56b](https://github.com/C4illin/ConvertX/commit/761f56b869d3a4faa7550d90b3da2d853baf8a1d)), closes [#320](https://github.com/C4illin/ConvertX/issues/320)
- missing public files ([8a888cc](https://github.com/C4illin/ConvertX/commit/8a888ccda679a31f801855e37800f52f1a1fda6e)), closes [#314](https://github.com/C4illin/ConvertX/issues/314)
- move color variables to seperate directory ([3bf82b5](https://github.com/C4illin/ConvertX/commit/3bf82b5b86177f95531293cab1dfee1e12c898a1)), closes [#53](https://github.com/C4illin/ConvertX/issues/53)
- run qtwebengine without sandbox ([9f2bdad](https://github.com/C4illin/ConvertX/commit/9f2bdadde779d88973296e81af103ed0016f5411))
- update favicon ([827f22e](https://github.com/C4illin/ConvertX/commit/827f22e2fc33bf32a02befb3c5bd519511826b38)), closes [#158](https://github.com/C4illin/ConvertX/issues/158)

## [0.14.1](https://github.com/C4illin/ConvertX/compare/v0.14.0...v0.14.1) (2025-06-04)

### Bug Fixes

- change to baseline build ([6ea3058](https://github.com/C4illin/ConvertX/commit/6ea3058e66262f7a14633bddcecd5573948f524a)), closes [#311](https://github.com/C4illin/ConvertX/issues/311)

## [0.14.0](https://github.com/C4illin/ConvertX/compare/v0.13.0...v0.14.0) (2025-06-03)

### Features

- add dvisvgm ([625e1a5](https://github.com/C4illin/ConvertX/commit/625e1a51f620fe9da79d0127eb6c95f468d9ea2b))
- add ImageMagick ([b47e575](https://github.com/C4illin/ConvertX/commit/b47e5755f677056e8acecad54c0c2e28a5e137f3)), closes [#295](https://github.com/C4illin/ConvertX/issues/295), closes [#269](https://github.com/C4illin/ConvertX/issues/269)
- enhance job details display with file information ([50725ed](https://github.com/C4illin/ConvertX/commit/50725edd021bb9a7f58c85b79c1eab355ad22ced)), closes [#251](https://github.com/C4illin/ConvertX/issues/251)
- improve job details interaction and accessibility ([29ba229](https://github.com/C4illin/ConvertX/commit/29ba229bc23d2019d2ee9829da7852f884ffa611))
- show version in footer ([9a49ded](https://github.com/C4illin/ConvertX/commit/9a49dedacac7e67a432b6da0daf1967038d97d26))

### Bug Fixes

- add av1 and h26X with containers ([af5c768](https://github.com/C4illin/ConvertX/commit/af5c768dc74b3124fd7ef4b29e27c83a5d19ad49)), closes [#287](https://github.com/C4illin/ConvertX/issues/287), closes [#293](https://github.com/C4illin/ConvertX/issues/293)
- progress bars on firefox ([ff2c005](https://github.com/C4illin/ConvertX/commit/ff2c0057e890b9ecb552df30914333349ea20eb7))
- register button style ([b9bbf77](https://github.com/C4illin/ConvertX/commit/b9bbf7792f01fcaa77e3520925de107e856926f1))
- switch from alpine to debian trixie ([4e4c029](https://github.com/C4illin/ConvertX/commit/4e4c029cb800df86affb99c3a82dda9e6708bdde)), closes [#234](https://github.com/C4illin/ConvertX/issues/234), closes [#199](https://github.com/C4illin/ConvertX/issues/199)

## [0.13.0](https://github.com/C4illin/ConvertX/compare/v0.12.1...v0.13.0) (2025-05-14)

### Features

- add HIDE_HISTORY option to control visibility of history page ([9d1c931](https://github.com/C4illin/ConvertX/commit/9d1c93155cc33ed6c83f9e5122afff8f28d0e4bf))
- add potrace converter ([bdbd4a1](https://github.com/C4illin/ConvertX/commit/bdbd4a122c09559b089b985ea12c5f3e085107da))
- Add support for .HIF files ([70705c1](https://github.com/C4illin/ConvertX/commit/70705c1850d470296df85958c02a01fb5bc3a25f))
- add support for drag/drop of images ([ff2ef74](https://github.com/C4illin/ConvertX/commit/ff2ef7413542cf10ba7a6e246763bcecd6829ec1))

### Bug Fixes

- add timezone support ([4b5c732](https://github.com/C4illin/ConvertX/commit/4b5c732380bc844dccf340ea1eb4f8bfe3bb44a5)), closes [#258](https://github.com/C4illin/ConvertX/issues/258)

## [0.12.1](https://github.com/C4illin/ConvertX/compare/v0.12.0...v0.12.1) (2025-03-20)

### Bug Fixes

- rollback to bun 1.2.2 ([cdae798](https://github.com/C4illin/ConvertX/commit/cdae798fcf5879e4adea87386a38748b9a1e1ddc))

## [0.12.0](https://github.com/C4illin/ConvertX/compare/v0.11.1...v0.12.0) (2025-03-06)

### Features

- added progress bar for file upload ([db60f35](https://github.com/C4illin/ConvertX/commit/db60f355b2973f43f8e5990e6fe4e351b959b659))
- made every upload file independent ([cc54bdc](https://github.com/C4illin/ConvertX/commit/cc54bdcbe764c41cc3273485d072fd3178ad2dca))
- replace exec with execFile ([9263d17](https://github.com/C4illin/ConvertX/commit/9263d17609dc4b2b367eb7fee67b3182e283b3a3))

### Bug Fixes

- add libheif ([6b92540](https://github.com/C4illin/ConvertX/commit/6b9254047c0598963aee1d99e20ba1650a0368bf))
- add libheif ([decfea5](https://github.com/C4illin/ConvertX/commit/decfea5dc9627b216bb276a9e1578c32cfa1deb6)), closes [#202](https://github.com/C4illin/ConvertX/issues/202)
- added onerror log ([ae4bbc8](https://github.com/C4illin/ConvertX/commit/ae4bbc8baacbaf67763c62ea44140bb21cc17230))
- refactored uploadFile to only accept a single file instead of multiple ([dc82a43](https://github.com/C4illin/ConvertX/commit/dc82a438d4104b79ff423d502a6779a43928968a))
- update libheif to 1.19.5 ([fba5e21](https://github.com/C4illin/ConvertX/commit/fba5e212e8d0eaba8971e239e35aeb521f3cd813)), closes [#202](https://github.com/C4illin/ConvertX/issues/202)

## [0.11.1](https://github.com/C4illin/ConvertX/compare/v0.11.0...v0.11.1) (2025-02-07)

### Bug Fixes

- mobile view overflow ([bec58ac](https://github.com/C4illin/ConvertX/commit/bec58ac59f9600e35385b9e21d174f3ab1b42b1d))

## [0.11.0](https://github.com/C4illin/ConvertX/compare/v0.10.1...v0.11.0) (2025-02-05)

### Features

- add deps for vaapi ([2bbbd03](https://github.com/C4illin/ConvertX/commit/2bbbd03554d384a4488143f29e5fc863cfdf333b)), closes [#192](https://github.com/C4illin/ConvertX/issues/192)

### Bug Fixes

- don't crash if file is not found ([16f27c1](https://github.com/C4illin/ConvertX/commit/16f27c13bbc1c0e5fa2316f3db11d0918524053b))
- install numpy for inkscape ([0e61051](https://github.com/C4illin/ConvertX/commit/0e61051fc6be188164c3865b4fb579c140859fdc))

## [0.10.1](https://github.com/C4illin/ConvertX/compare/v0.10.0...v0.10.1) (2025-01-21)

### Bug Fixes

- ffmpeg works without ffmpeg_args ([3b7ea88](https://github.com/C4illin/ConvertX/commit/3b7ea88b7382f7c21b120bdc9bda5bb10547f55d)), closes [#212](https://github.com/C4illin/ConvertX/issues/212)

## [0.10.0](https://github.com/C4illin/ConvertX/compare/v0.9.0...v0.10.0) (2025-01-18)

### Features

- add calibre ([03d3edf](https://github.com/C4illin/ConvertX/commit/03d3edfff65c252dd4b8922fc98257c089c1ff74)), closes [#191](https://github.com/C4illin/ConvertX/issues/191)

### Bug Fixes

- add FFMPEG_ARGS env variable ([f537c81](https://github.com/C4illin/ConvertX/commit/f537c81db7815df8017f834e3162291197e1c40f)), closes [#190](https://github.com/C4illin/ConvertX/issues/190)
- add qt6-qtbase-private-dev from community repo ([95dbc9f](https://github.com/C4illin/ConvertX/commit/95dbc9f678bec7e6e2c03587e1473fb8ff708ea3))
- skip account setup when ALLOW_UNAUTHENTICATED is true ([538c5b6](https://github.com/C4illin/ConvertX/commit/538c5b60c9e27a8184740305475245da79bae143))

## [0.9.0](https://github.com/C4illin/ConvertX/compare/v0.8.1...v0.9.0) (2024-11-21)

### Features

- add inkscape for vector images ([f3740e9](https://github.com/C4illin/ConvertX/commit/f3740e9ded100b8500f3613517960248bbd3c210))
- Allow to chose webroot ([36cb6cc](https://github.com/C4illin/ConvertX/commit/36cb6cc589d80d0a87fa8dbe605db71a9a2570f9)), closes [#180](https://github.com/C4illin/ConvertX/issues/180)
- disable convert when uploading ([58e220e](https://github.com/C4illin/ConvertX/commit/58e220e82d7f9c163d6ea4dc31092c08a3e254f4)), closes [#177](https://github.com/C4illin/ConvertX/issues/177)

### Bug Fixes

- treat unknown as m4a ([1a442d6](https://github.com/C4illin/ConvertX/commit/1a442d6e69606afef63b1e7df36aa83d111fa23d)), closes [#178](https://github.com/C4illin/ConvertX/issues/178)
- wait for both upload and selection ([4c05fd7](https://github.com/C4illin/ConvertX/commit/4c05fd72bbbf91ee02327f6fcbf749b78272376b)), closes [#177](https://github.com/C4illin/ConvertX/issues/177)

## [0.8.1](https://github.com/C4illin/ConvertX/compare/v0.8.0...v0.8.1) (2024-10-05)

### Bug Fixes

- disable convert button when input is empty ([78844d7](https://github.com/C4illin/ConvertX/commit/78844d7bd55990789ed07c81e49043e688cbe656)), closes [#151](https://github.com/C4illin/ConvertX/issues/151)
- resize to fit for ico ([b4e53db](https://github.com/C4illin/ConvertX/commit/b4e53dbb8e70b3a95b44e5b756759d16117a87e1)), closes [#157](https://github.com/C4illin/ConvertX/issues/157)
- treat jfif as jpeg ([339b79f](https://github.com/C4illin/ConvertX/commit/339b79f786131deb93f0d5683e03178fdcab1ef5)), closes [#163](https://github.com/C4illin/ConvertX/issues/163)

## [0.8.0](https://github.com/C4illin/ConvertX/compare/v0.7.0...v0.8.0) (2024-09-30)

### Features

- add light theme, fixes [#156](https://github.com/C4illin/ConvertX/issues/156) ([72636c5](https://github.com/C4illin/ConvertX/commit/72636c5059ebf09c8fece2e268293650b2f8ccf6))

### Bug Fixes

- add support for usd for assimp, [#144](https://github.com/C4illin/ConvertX/issues/144) ([2057167](https://github.com/C4illin/ConvertX/commit/20571675766209ad1251f07e687d29a6791afc8b))
- cleanup formats and add opus, fixes [#159](https://github.com/C4illin/ConvertX/issues/159) ([ae1dfaf](https://github.com/C4illin/ConvertX/commit/ae1dfafc9d9116a57b08c2f7fc326990e00824b0))
- support .awb and clean up, fixes [#153](https://github.com/C4illin/ConvertX/issues/153), [#92](https://github.com/C4illin/ConvertX/issues/92) ([1c9e67f](https://github.com/C4illin/ConvertX/commit/1c9e67fc3201e0e5dee91e8981adf34daaabf33a))

## [0.7.0](https://github.com/C4illin/ConvertX/compare/v0.6.0...v0.7.0) (2024-09-26)

### Features

- Add support for 3d assets through assimp converter ([63a4328](https://github.com/C4illin/ConvertX/commit/63a4328d4a1e01df3e0ec4a877bad8c8ffe71129))

### Bug Fixes

- wrong layout on search with few options ([8817389](https://github.com/C4illin/ConvertX/commit/88173891ba2d69da46eda46f3f598a9b54f26f96))

## [0.6.0](https://github.com/C4illin/ConvertX/compare/v0.5.0...v0.6.0) (2024-09-25)

### Features

- ui remake with tailwind ([22f823c](https://github.com/C4illin/ConvertX/commit/22f823c535b20382981f86a13616b830a1f3392f))

### Bug Fixes

- rename css file to force update cache, fixes [#141](https://github.com/C4illin/ConvertX/issues/141) ([47139a5](https://github.com/C4illin/ConvertX/commit/47139a550bd3d847da288c61bf8f88953b79c673))

## [0.5.0](https://github.com/C4illin/ConvertX/compare/v0.4.1...v0.5.0) (2024-09-20)

### Features

- add option to customize how often files are automatically deleted ([317c932](https://github.com/C4illin/ConvertX/commit/317c932c2a26280bf37ed3d3bf9b879413590f5a))

### Bug Fixes

- improve file name replacement logic ([60ba7c9](https://github.com/C4illin/ConvertX/commit/60ba7c93fbdc961f3569882fade7cc13dee7a7a5))

## [0.4.1](https://github.com/C4illin/ConvertX/compare/v0.4.0...v0.4.1) (2024-09-15)

### Bug Fixes

- allow non lowercase true and false values, fixes [#122](https://github.com/C4illin/ConvertX/issues/122) ([bef1710](https://github.com/C4illin/ConvertX/commit/bef1710e3376baa7e25c107ded20a40d18b8c6b0))

## [0.4.0](https://github.com/C4illin/ConvertX/compare/v0.3.3...v0.4.0) (2024-08-26)

### Features

- add option for unauthenticated file conversions [#114](https://github.com/C4illin/ConvertX/issues/114) ([f0d0e43](https://github.com/C4illin/ConvertX/commit/f0d0e4392983c3e4c530304ea88e023fda9bcac0))
- add resvg converter ([d5eeef9](https://github.com/C4illin/ConvertX/commit/d5eeef9f6884b2bb878508bed97ea9ceaa662995))
- add robots.txt ([6597c1d](https://github.com/C4illin/ConvertX/commit/6597c1d7caeb4dfb6bc47b442e4dfc9840ad12b7))
- Add search bar for formats ([53fff59](https://github.com/C4illin/ConvertX/commit/53fff594fc4d69306abcb2a5cad890fcd0953a58))

### Bug Fixes

- keep unauthenticated user logged in if allowed [#114](https://github.com/C4illin/ConvertX/issues/114) ([bc4ad49](https://github.com/C4illin/ConvertX/commit/bc4ad492852fad8cb832a0c03485cccdd7f7b117))
- pdf support in vips ([8ca4f15](https://github.com/C4illin/ConvertX/commit/8ca4f1587df7f358893941c656d78d75f04dac93))
- Slow click on conversion popup does not work ([4d9c4d6](https://github.com/C4illin/ConvertX/commit/4d9c4d64aa0266f3928935ada68d91ac81f638aa))

## [0.3.3](https://github.com/C4illin/ConvertX/compare/v0.3.2...v0.3.3) (2024-07-30)

### Bug Fixes

- downgrade @elysiajs/html dependency to version 1.0.2 ([c714ade](https://github.com/C4illin/ConvertX/commit/c714ade3e23865ba6cfaf76c9e7259df1cda222c))

## [0.3.2](https://github.com/C4illin/ConvertX/compare/v0.3.1...v0.3.2) (2024-07-09)

### Bug Fixes

- increase max request body to support large uploads ([3ae2db5](https://github.com/C4illin/ConvertX/commit/3ae2db5d9b36fe3dcd4372ddcd32aa573ea59aa6)), closes [#64](https://github.com/C4illin/ConvertX/issues/64)

## [0.3.1](https://github.com/C4illin/ConvertX/compare/v0.3.0...v0.3.1) (2024-06-27)

### Bug Fixes

- release releases ([4d4c13a](https://github.com/C4illin/ConvertX/commit/4d4c13a8d85ec7c9209ad41cdbea7d4380b0edbf))

## [0.3.0](https://github.com/C4illin/ConvertX/compare/v0.2.0...v0.3.0) (2024-06-27)

### Features

- add version number to log ([4dcb796](https://github.com/C4illin/ConvertX/commit/4dcb796e1bd27badc078d0638076cd9f1e81c4a4)), closes [#44](https://github.com/C4illin/ConvertX/issues/44)
- change to xelatex ([fae2ba9](https://github.com/C4illin/ConvertX/commit/fae2ba9c54461dccdccd1bfb5e76398540d11d0b))
- print version of installed converters to log ([801cf28](https://github.com/C4illin/ConvertX/commit/801cf28d1e5edac9353b0b16be75a4fb48470b8a))

## [0.2.0](https://github.com/C4illin/ConvertX/compare/v0.1.2...v0.2.0) (2024-06-20)

### Features

- add libjxl for jpegxl conversion ([ff680cb](https://github.com/C4illin/ConvertX/commit/ff680cb29534a25c3148a90fd064bb86c71fb482))
- change from debian to alpine ([1316957](https://github.com/C4illin/ConvertX/commit/13169574f0134ae236f8d41287bb73930b575e82)), closes [#34](https://github.com/C4illin/ConvertX/issues/34)

## [0.1.2](https://github.com/C4illin/ConvertX/compare/v0.1.1...v0.1.2) (2024-06-10)

### Bug Fixes

- fix incorrect redirect ([25df58b](https://github.com/C4illin/ConvertX/commit/25df58ba82321aaa6617811a6995cb96c2a00a40)), closes [#23](https://github.com/C4illin/ConvertX/issues/23)

## [0.1.1](https://github.com/C4illin/ConvertX/compare/v0.1.0...v0.1.1) (2024-05-30)

### Bug Fixes

- :bug: make sure all redirects are 302 ([9970fd3](https://github.com/C4illin/ConvertX/commit/9970fd3f89190af96f8762edc3817d1e03082b3a)), closes [#12](https://github.com/C4illin/ConvertX/issues/12)

## 0.1.0 (2024-05-30)

### Features

- remove file from file list in index.html ([787ff97](https://github.com/C4illin/ConvertX/commit/787ff9741ecbbf4fb4c02b43bd22a214a173fd7b))

### Miscellaneous Chores

- release 0.1.0 ([54d9aec](https://github.com/C4illin/ConvertX/commit/54d9aecbf949689b12aa7e5e8e9be7b9032f4431))
