# RAS API 定義說明（Remote AI Service API）

> 版本：2.0.0 | 最後更新：2026-01-31

---

## 一、RAS API 是什麼？

### 一句話版本

**RAS API 是 ConvertX-CN 的對外檔案轉換服務接口，讓外部系統可以透過標準 HTTP 呼叫進行檔案格式轉換。**

### 詳細版本

RAS（Remote AI Service）API 是一套專為外部整合設計的 RESTful API 服務，提供：

- **多引擎檔案轉換**：支援 25+ 種轉換引擎（FFmpeg、ImageMagick、LibreOffice、MinerU、PDFMathTranslate 等）
- **非同步任務處理**：Job-based 架構，適合大檔案和長時間轉換
- **統一錯誤處理**：標準化的錯誤碼和回應格式
- **可擴充引擎系統**：新引擎可無縫接入，不影響現有 API

---

## 二、服務模型

### 採用：非同步 Job API + 同步查詢 API

```
┌─────────────────────────────────────────────────────────────────┐
│                      RAS API 服務模型                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────┐      ┌──────────┐      ┌──────────┐              │
│  │ 提交任務  │ ───► │ 查詢狀態  │ ───► │ 取得結果  │              │
│  │ POST /jobs│      │GET /jobs/│      │GET /jobs/│              │
│  │          │      │  {id}    │      │{id}/result│              │
│  └──────────┘      └──────────┘      └──────────┘              │
│       │                 │                  │                   │
│       ▼                 ▼                  ▼                   │
│  ┌──────────┐      ┌──────────┐      ┌──────────┐              │
│  │ Job ID   │      │ Status   │      │ Download │              │
│  │ 返回     │      │ 返回     │      │ 返回     │              │
│  └──────────┘      └──────────┘      └──────────┘              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**為什麼選擇 Job-based？**

1. **大檔案友善**：上傳後立即返回，不會 timeout
2. **長時間轉換**：AI 轉換可能需要數分鐘，Job 模式不會阻塞
3. **狀態追蹤**：使用者可隨時查詢進度
4. **錯誤恢復**：失敗的任務可以重試

---

## 三、使用者可以做什麼？

### 上傳什麼？

| 類別   | 格式範例                             |
| ------ | ------------------------------------ |
| 文件   | PDF, DOCX, XLSX, PPTX, TXT, MD, HTML |
| 圖片   | PNG, JPG, WEBP, SVG, HEIC, TIFF      |
| 影音   | MP4, WEBM, AVI, MP3, WAV, FLAC       |
| 電子書 | EPUB, MOBI, AZW3                     |
| 資料   | JSON, YAML, TOML, CSV                |

### 指定哪些 AI 引擎？

| 引擎 ID            | 說明       | 特色                |
| ------------------ | ---------- | ------------------- |
| `ffmpeg`           | 多媒體轉換 | 影片/音訊格式互轉   |
| `imagemagick`      | 圖片處理   | 100+ 圖片格式支援   |
| `libreoffice`      | 辦公文件   | DOC/XLS/PPT → PDF   |
| `pandoc`           | 文件轉換   | Markdown/HTML/LaTeX |
| `mineru`           | PDF 解析   | AI 驅動的 PDF 萃取  |
| `pdfmathtranslate` | PDF 翻譯   | 保留數學公式        |
| `ocrmypdf`         | OCR 識別   | 讓 PDF 可搜尋       |
| `calibre`          | 電子書     | EPUB/MOBI 互轉      |

### 拿回什麼結果？

- **轉換後的檔案**：可直接下載
- **任務狀態**：pending → processing → completed/failed
- **錯誤資訊**：詳細的失敗原因和建議

---

## 四、API 穩定承諾邊界

### ✅ 穩定欄位（不會變動）

```json
{
  "success": true,           // 永遠是 boolean
  "data": { ... },           // 永遠是 object
  "error": { ... },          // 永遠是 object (失敗時)
  "meta": {
    "version": "2.0.0",      // 語意化版本
    "request_id": "uuid",    // 請求追蹤 ID
    "timestamp": "ISO8601"   // 時間戳
  }
}
```

### ⚠️ Engine-specific 欄位

這些欄位可能隨引擎版本更新而變化：

```json
{
  "engine_params": {
    "mineru": {
      "table_mode": "markdown", // 可能新增選項
      "ocr_language": "chi_sim" // 可能支援更多語言
    },
    "ffmpeg": {
      "codec": "libx264", // 可能新增編碼器
      "quality": "high" // 可能調整品質等級
    }
  }
}
```

---

## 五、API 架構圖

```
/api/v1/
├── health                    # 健康檢查（公開）
├── info                      # API 資訊（公開）
│
├── engines/                  # 引擎管理
│   ├── GET /                 # 列出所有引擎（公開）
│   ├── GET /{engine_id}      # 引擎詳情（公開）
│   └── GET /{engine_id}/conversions  # 支援的轉換（公開）
│
├── formats/                  # 格式查詢
│   ├── GET /                 # 所有支援格式（公開）
│   └── GET /{format}/targets # 可轉換目標（公開）
│
├── validate/                 # 驗證轉換
│   └── POST /                # 檢查是否可轉換（公開）
│
└── jobs/                     # 任務管理（需認證）
    ├── POST /                # 建立轉換任務
    ├── GET /                 # 列出我的任務
    ├── GET /{job_id}         # 查詢任務狀態
    ├── GET /{job_id}/result  # 下載轉換結果
    └── DELETE /{job_id}      # 刪除任務
```

### 為什麼這樣設計？

1. **查詢與操作分離**：`/engines`、`/formats` 是唯讀查詢，`/jobs` 是狀態操作
2. **公開與認證分離**：查詢類 API 不需認證，降低使用門檻
3. **RESTful 語義**：資源導向設計，符合業界標準
4. **版本化**：`/api/v1/` 前綴支援未來升級

---

## 六、端點責任說明

| 端點類別                | 責任           | 認證 | 冪等性 |
| ----------------------- | -------------- | ---- | ------ |
| `/health`               | 服務存活檢查   | 否   | 是     |
| `/info`                 | API 能力描述   | 否   | 是     |
| `/engines`              | 引擎能力查詢   | 否   | 是     |
| `/formats`              | 格式支援查詢   | 否   | 是     |
| `/validate`             | 轉換可行性驗證 | 否   | 是     |
| `POST /jobs`            | 建立轉換任務   | 是   | 否     |
| `GET /jobs`             | 列出使用者任務 | 是   | 是     |
| `GET /jobs/{id}`        | 查詢特定任務   | 是   | 是     |
| `GET /jobs/{id}/result` | 下載結果       | 是   | 是     |
| `DELETE /jobs/{id}`     | 刪除任務       | 是   | 是     |

---

## 七、未來新增引擎不需改 API

Engine 採用「註冊機制」設計：

```rust
// 引擎只需實作 trait，即可自動註冊
impl ConversionEngine for NewEngine {
    fn id(&self) -> &str { "new_engine" }
    fn conversions(&self) -> &HashMap<String, Vec<String>> { ... }
    async fn convert(&self, input: &Path, output: &Path, options: &Value) -> Result<()> { ... }
}

// 註冊後自動出現在 API
registry.register(NewEngine::new());
```

新引擎接入後：

- `/engines` 自動列出
- `/engines/{id}` 自動支援
- `/jobs` 可指定使用
- **無需修改任何 API 程式碼**
