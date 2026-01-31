# ConvertX RAS API 完整使用文件

> **Remote AI Service API** - 檔案格式轉換服務
>
> 版本：2.0.0 | 端口：7890 | 最後更新：2026-01-31

---

## 📘 API Overview

### RAS API 是什麼？

**RAS (Remote AI Service) API** 是 ConvertX-CN 的對外公開 API，讓您可以透過標準 HTTP 呼叫進行檔案格式轉換。

**一句話說明**：上傳檔案 → 指定目標格式 → 取回轉換結果

### 適合誰用？

| 使用場景          | 說明                      |
| ----------------- | ------------------------- |
| 📱 **App 開發者** | 在 App 中整合檔案轉換功能 |
| 🔄 **自動化流程** | CI/CD 中的文件處理        |
| 🤖 **AI 應用**    | PDF 解析、文件萃取        |
| 🏢 **企業系統**   | 文件格式標準化            |

### 快速開始

```bash
# 1. 檢查服務狀態
curl http://localhost:7890/api/v1/health

# 2. 查看支援的引擎
curl http://localhost:7890/api/v1/engines

# 3. 驗證轉換是否支援
curl -X POST http://localhost:7890/api/v1/validate \
  -H "Content-Type: application/json" \
  -d '{"input_format": "docx", "output_format": "pdf"}'
```

---

## 🔑 API 呼叫流程

### 標準轉換流程

```
┌─────────────────────────────────────────────────────────────────┐
│                      轉換流程三步驟                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │  Step 1      │    │  Step 2      │    │  Step 3      │      │
│  │  建立任務     │───►│  查詢狀態     │───►│  取得結果     │      │
│  │              │    │              │    │              │      │
│  │ POST /jobs   │    │GET /jobs/{id}│    │GET /jobs/    │      │
│  │              │    │              │    │  {id}/result │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│         │                   │                   │               │
│         ▼                   ▼                   ▼               │
│    返回 job_id         返回 status          下載檔案            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Step 1: 建立轉換任務

```bash
curl -X POST http://localhost:7890/api/v1/jobs \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@document.docx" \
  -F "target_format=pdf" \
  -F "engine=libreoffice"
```

**回應：**

```json
{
  "success": true,
  "data": {
    "job_id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "pending",
    "status_url": "/api/v1/jobs/550e8400-e29b-41d4-a716-446655440000"
  },
  "meta": {
    "version": "2.0.0",
    "timestamp": "2026-01-31T12:00:00Z",
    "request_id": "abc123"
  }
}
```

### Step 2: 查詢任務狀態

```bash
curl http://localhost:7890/api/v1/jobs/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**回應（處理中）：**

```json
{
  "success": true,
  "data": {
    "job": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "status": "processing",
      "source_format": "docx",
      "target_format": "pdf",
      "engine": "libreoffice",
      "created_at": "2026-01-31T12:00:00Z"
    },
    "result_url": null
  }
}
```

**回應（完成）：**

```json
{
  "success": true,
  "data": {
    "job": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "status": "completed",
      "output_filename": "document.pdf"
    },
    "result_url": "/api/v1/jobs/550e8400-e29b-41d4-a716-446655440000/result"
  }
}
```

### Step 3: 下載結果

```bash
curl -O http://localhost:7890/api/v1/jobs/550e8400-e29b-41d4-a716-446655440000/result \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 🔌 API Reference

### 基本資訊

| 項目         | 值                                          |
| ------------ | ------------------------------------------- |
| Base URL     | `http://localhost:7890/api/v1`              |
| 預設端口     | **7890**                                    |
| Content-Type | `application/json` 或 `multipart/form-data` |
| 認證方式     | Bearer Token                                |

### 回應格式

所有 API 都使用統一的回應格式：

```json
{
  "success": true,
  "data": { ... },
  "error": null,
  "meta": {
    "version": "2.0.0",
    "timestamp": "2026-01-31T12:00:00Z",
    "request_id": "uuid"
  }
}
```

---

### 公開端點（不需認證）

#### GET /health

健康檢查，用於監控和負載均衡。

```bash
curl http://localhost:7890/api/v1/health
```

**回應：**

```json
{
  "status": "healthy",
  "version": "2.0.0",
  "timestamp": "2026-01-31T12:00:00Z"
}
```

---

#### GET /info

取得 API 資訊和能力。

```bash
curl http://localhost:7890/api/v1/info
```

**回應：**

```json
{
  "success": true,
  "data": {
    "name": "ConvertX RAS API",
    "version": "2.0.0",
    "description": "ConvertX 遠端 AI 服務 API - 檔案格式轉換服務",
    "documentation": "/swagger-ui",
    "endpoints": {
      "public": [
        "GET /api/v1/health",
        "GET /api/v1/info",
        "GET /api/v1/engines",
        "GET /api/v1/engines/{id}",
        "GET /api/v1/formats",
        "GET /api/v1/formats/{format}/targets",
        "POST /api/v1/validate"
      ],
      "authenticated": [
        "POST /api/v1/jobs",
        "GET /api/v1/jobs",
        "GET /api/v1/jobs/{id}",
        "GET /api/v1/jobs/{id}/result",
        "DELETE /api/v1/jobs/{id}"
      ]
    },
    "capabilities": {
      "total_engines": 9,
      "available_engines": 9,
      "max_file_size": 524288000
    }
  }
}
```

---

#### GET /engines

列出所有轉換引擎。

```bash
curl http://localhost:7890/api/v1/engines
```

**回應：**

```json
{
  "success": true,
  "data": {
    "engines": [
      {
        "id": "ffmpeg",
        "name": "FFmpeg",
        "description": "Audio and video conversion using FFmpeg",
        "category": "media",
        "supported_input_formats": ["mp4", "webm", "avi", "mkv", "mov", "mp3", "wav"],
        "supported_output_formats": ["mp4", "webm", "avi", "mp3", "wav", "gif"],
        "available": true
      },
      {
        "id": "libreoffice",
        "name": "LibreOffice",
        "description": "Office document conversion using LibreOffice",
        "category": "document",
        "supported_input_formats": ["doc", "docx", "odt", "xls", "xlsx", "ppt", "pptx"],
        "supported_output_formats": ["pdf", "html", "txt"],
        "available": true
      }
    ]
  }
}
```

---

#### GET /engines/{id}

取得特定引擎詳情。

```bash
curl http://localhost:7890/api/v1/engines/libreoffice
```

**回應：**

```json
{
  "success": true,
  "data": {
    "engine": {
      "id": "libreoffice",
      "name": "LibreOffice",
      "description": "Office document conversion using LibreOffice",
      "category": "document",
      "supported_input_formats": ["doc", "docx", "odt", "xls", "xlsx", "ppt", "pptx"],
      "supported_output_formats": ["pdf", "html", "txt"],
      "available": true,
      "conversions": [
        { "from": "doc", "to": "pdf" },
        { "from": "docx", "to": "pdf" },
        { "from": "xls", "to": "pdf" }
      ]
    }
  }
}
```

---

#### GET /formats

列出所有支援的格式。

```bash
curl http://localhost:7890/api/v1/formats
```

**回應：**

```json
{
  "success": true,
  "data": {
    "inputs": [
      "avi",
      "bmp",
      "doc",
      "docx",
      "epub",
      "gif",
      "jpg",
      "json",
      "md",
      "mp3",
      "mp4",
      "pdf",
      "png",
      "ppt",
      "pptx",
      "svg",
      "tiff",
      "toml",
      "wav",
      "webm",
      "webp",
      "xls",
      "xlsx",
      "xml",
      "yaml"
    ],
    "outputs": [
      "aac",
      "avi",
      "bmp",
      "csv",
      "docx",
      "epub",
      "gif",
      "html",
      "ico",
      "jpg",
      "json",
      "latex",
      "m4a",
      "md",
      "mkv",
      "mobi",
      "mov",
      "mp3",
      "mp4",
      "ogg",
      "pdf",
      "png",
      "rst",
      "tiff",
      "toml",
      "txt",
      "wav",
      "webm",
      "webp",
      "xml",
      "yaml"
    ],
    "input_count": 25,
    "output_count": 31
  }
}
```

---

#### GET /formats/{format}/targets

查詢特定格式可轉換的目標。

```bash
curl http://localhost:7890/api/v1/formats/pdf/targets
```

**回應：**

```json
{
  "success": true,
  "data": {
    "input_format": "pdf",
    "converters": [
      {
        "engine": "calibre",
        "outputs": ["epub", "mobi", "txt", "html"]
      },
      {
        "engine": "mineru",
        "outputs": ["md", "json", "html"]
      },
      {
        "engine": "pdfmathtranslate",
        "outputs": ["pdf"]
      }
    ],
    "all_outputs": ["epub", "html", "json", "md", "mobi", "pdf", "txt"]
  }
}
```

---

#### POST /validate

驗證轉換是否支援。

```bash
curl -X POST http://localhost:7890/api/v1/validate \
  -H "Content-Type: application/json" \
  -d '{
    "input_format": "docx",
    "output_format": "pdf",
    "engine": "libreoffice"
  }'
```

**回應（支援）：**

```json
{
  "success": true,
  "data": {
    "valid": true,
    "message": "Conversion from 'docx' to 'pdf' is supported",
    "engine": "libreoffice",
    "available_engines": ["libreoffice", "pandoc"]
  }
}
```

**回應（不支援）：**

```json
{
  "success": true,
  "data": {
    "valid": false,
    "reason": "OUTPUT_FORMAT_NOT_SUPPORTED",
    "message": "Cannot convert 'docx' to 'mp4'",
    "suggestions": ["pdf", "html", "txt", "odt"]
  }
}
```

---

### 受保護端點（需要認證）

#### POST /jobs

建立轉換任務。

**請求格式：** `multipart/form-data`

| 欄位          | 類型   | 必填 | 說明                         |
| ------------- | ------ | ---- | ---------------------------- |
| file          | File   | ✅   | 要轉換的檔案                 |
| target_format | String | ✅   | 目標格式（如 pdf、docx）     |
| engine        | String | ❌   | 指定引擎（不指定則自動選擇） |
| options       | JSON   | ❌   | 引擎特定參數                 |

```bash
curl -X POST http://localhost:7890/api/v1/jobs \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@document.docx" \
  -F "target_format=pdf"
```

**回應：**

```json
{
  "success": true,
  "data": {
    "job_id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "pending",
    "status_url": "/api/v1/jobs/550e8400-e29b-41d4-a716-446655440000"
  }
}
```

---

#### GET /jobs

列出使用者的所有任務。

```bash
curl http://localhost:7890/api/v1/jobs \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**回應：**

```json
{
  "success": true,
  "data": {
    "jobs": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "original_filename": "document.docx",
        "source_format": "docx",
        "target_format": "pdf",
        "engine": "libreoffice",
        "status": "completed",
        "created_at": "2026-01-31T12:00:00Z",
        "completed_at": "2026-01-31T12:00:05Z"
      }
    ],
    "total": 1
  }
}
```

---

#### GET /jobs/{id}

查詢特定任務狀態。

```bash
curl http://localhost:7890/api/v1/jobs/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

#### GET /jobs/{id}/result

下載轉換結果。

```bash
curl -O http://localhost:7890/api/v1/jobs/550e8400-e29b-41d4-a716-446655440000/result \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

#### DELETE /jobs/{id}

刪除任務。

```bash
curl -X DELETE http://localhost:7890/api/v1/jobs/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## ⚙ Engine 使用方式

### 如何選擇引擎？

1. **自動選擇**（推薦）：不指定 `engine` 參數，系統會自動選擇最適合的引擎
2. **手動指定**：在請求中指定 `engine` 參數

```bash
# 自動選擇
curl -X POST ... -F "target_format=pdf"

# 手動指定
curl -X POST ... -F "target_format=pdf" -F "engine=libreoffice"
```

### 如何傳遞引擎參數？

使用 `options` 欄位傳遞 JSON 格式的引擎參數：

```bash
curl -X POST http://localhost:7890/api/v1/jobs \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@paper.pdf" \
  -F "target_format=md" \
  -F "engine=mineru" \
  -F 'options={"table_mode": "markdown", "ocr_language": "chi_sim"}'
```

### 引擎參數設計原則

```json
{
  "engine": "mineru",
  "pipeline": "pdf_to_md",
  "params": {
    "table_mode": "markdown",
    "ocr_language": "chi_sim"
  }
}
```

| 欄位       | 責任             | 穩定性      |
| ---------- | ---------------- | ----------- |
| `engine`   | 選擇轉換引擎     | ✅ 穩定     |
| `pipeline` | 引擎內部處理流程 | ⚠️ 引擎相依 |
| `params`   | 引擎特定參數     | ⚠️ 引擎相依 |

### 常見引擎參數

#### MinerU (PDF → Markdown)

```json
{
  "table_mode": "markdown",
  "ocr_language": "chi_sim",
  "extract_images": true
}
```

#### PDFMathTranslate (PDF 翻譯)

```json
{
  "target_language": "zh-TW",
  "preserve_layout": true
}
```

#### FFmpeg (影片轉換)

```json
{
  "codec": "libx264",
  "quality": "high",
  "resolution": "1920x1080"
}
```

---

## ❌ Error Codes

| 錯誤碼                   | HTTP 狀態 | 說明         |
| ------------------------ | --------- | ------------ |
| `SUCCESS`                | 200       | 成功         |
| `BAD_REQUEST`            | 400       | 請求格式錯誤 |
| `UNAUTHORIZED`           | 401       | 未認證       |
| `FORBIDDEN`              | 403       | 無權限       |
| `NOT_FOUND`              | 404       | 資源不存在   |
| `FILE_TOO_LARGE`         | 413       | 檔案太大     |
| `UNSUPPORTED_CONVERSION` | 400       | 不支援的轉換 |
| `ENGINE_NOT_FOUND`       | 404       | 引擎不存在   |
| `JOB_NOT_FOUND`          | 404       | 任務不存在   |
| `CONVERSION_FAILED`      | 500       | 轉換失敗     |

### 錯誤回應範例

```json
{
  "success": false,
  "error": {
    "code": "UNSUPPORTED_CONVERSION",
    "message": "Cannot convert 'docx' to 'mp4'",
    "details": {
      "suggestions": ["pdf", "html", "txt"]
    }
  },
  "meta": {
    "version": "2.0.0",
    "timestamp": "2026-01-31T12:00:00Z",
    "request_id": "abc123"
  }
}
```

---

## 🔧 環境變數

| 變數名           | 預設值           | 說明             |
| ---------------- | ---------------- | ---------------- |
| `RAS_API_HOST`   | `0.0.0.0`        | 監聽地址         |
| `RAS_API_PORT`   | `7890`           | 監聽端口（固定） |
| `JWT_SECRET`     | (內建)           | JWT 密鑰         |
| `UPLOAD_DIR`     | `./data/uploads` | 上傳目錄         |
| `OUTPUT_DIR`     | `./data/output`  | 輸出目錄         |
| `MAX_FILE_SIZE`  | `524288000`      | 最大檔案 (500MB) |
| `ENABLE_SWAGGER` | `true`           | 啟用 Swagger UI  |

---

## 📚 Swagger UI

訪問 `http://localhost:7890/swagger-ui` 可以使用互動式 API 文件。

---

## 🚀 快速整合範例

### Python

```python
import requests

BASE_URL = "http://localhost:7890/api/v1"
TOKEN = "your-token"

# 建立轉換任務
with open("document.docx", "rb") as f:
    response = requests.post(
        f"{BASE_URL}/jobs",
        headers={"Authorization": f"Bearer {TOKEN}"},
        files={"file": f},
        data={"target_format": "pdf"}
    )
    job_id = response.json()["data"]["job_id"]

# 查詢狀態
status = requests.get(
    f"{BASE_URL}/jobs/{job_id}",
    headers={"Authorization": f"Bearer {TOKEN}"}
).json()

# 下載結果
if status["data"]["job"]["status"] == "completed":
    result = requests.get(
        f"{BASE_URL}/jobs/{job_id}/result",
        headers={"Authorization": f"Bearer {TOKEN}"}
    )
    with open("output.pdf", "wb") as f:
        f.write(result.content)
```

### JavaScript / Node.js

```javascript
const FormData = require("form-data");
const fs = require("fs");
const axios = require("axios");

const BASE_URL = "http://localhost:7890/api/v1";
const TOKEN = "your-token";

async function convertFile() {
  // 建立任務
  const form = new FormData();
  form.append("file", fs.createReadStream("document.docx"));
  form.append("target_format", "pdf");

  const { data: createRes } = await axios.post(`${BASE_URL}/jobs`, form, {
    headers: {
      ...form.getHeaders(),
      Authorization: `Bearer ${TOKEN}`,
    },
  });

  const jobId = createRes.data.job_id;

  // 輪詢狀態
  let status;
  do {
    await new Promise((r) => setTimeout(r, 1000));
    const { data } = await axios.get(`${BASE_URL}/jobs/${jobId}`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    status = data.data.job.status;
  } while (status === "pending" || status === "processing");

  // 下載結果
  if (status === "completed") {
    const { data } = await axios.get(`${BASE_URL}/jobs/${jobId}/result`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
      responseType: "stream",
    });
    data.pipe(fs.createWriteStream("output.pdf"));
  }
}
```

### cURL 一鍵腳本

```bash
#!/bin/bash
TOKEN="your-token"
FILE="document.docx"
FORMAT="pdf"

# 建立任務
JOB_ID=$(curl -s -X POST "http://localhost:7890/api/v1/jobs" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@$FILE" \
  -F "target_format=$FORMAT" | jq -r '.data.job_id')

echo "Job ID: $JOB_ID"

# 等待完成
while true; do
  STATUS=$(curl -s "http://localhost:7890/api/v1/jobs/$JOB_ID" \
    -H "Authorization: Bearer $TOKEN" | jq -r '.data.job.status')
  echo "Status: $STATUS"
  [ "$STATUS" = "completed" ] && break
  [ "$STATUS" = "failed" ] && exit 1
  sleep 2
done

# 下載
curl -o "output.$FORMAT" "http://localhost:7890/api/v1/jobs/$JOB_ID/result" \
  -H "Authorization: Bearer $TOKEN"
echo "Downloaded: output.$FORMAT"
```

---

## 🔐 認證方式

### Bearer Token 認證

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:7890/api/v1/jobs
```

### 取得 Token

透過 Web UI 登入後，可在設定頁面取得 API Token。

---

## 📋 API 架構圖

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

---

## 🛠 技術規格

### Rust 實作

RAS API 使用 Rust 實作，技術選型：

| 元件          | 選擇               | 理由                        |
| ------------- | ------------------ | --------------------------- |
| Web Framework | Axum               | Tower 生態系整合、類型安全  |
| JSON          | Serde              | 業界標準、零成本抽象        |
| 錯誤處理      | thiserror + anyhow | 類型化錯誤 + 靈活的錯誤傳播 |
| API 文件      | utoipa             | OpenAPI 3.0 自動生成        |

### 專案結構

```
api-server/src/
├── main.rs              # 入口點
├── lib.rs               # 模組匯出
├── config.rs            # 配置管理
├── error.rs             # 錯誤處理
├── openapi.rs           # OpenAPI 文件生成
│
├── routes/              # API 路由
│   ├── mod.rs
│   ├── health.rs
│   ├── info.rs
│   ├── engines.rs
│   ├── formats.rs
│   ├── validate.rs
│   └── jobs.rs
│
├── models/              # 資料模型
│   ├── mod.rs
│   ├── job.rs
│   ├── engine.rs
│   └── api.rs
│
└── services/            # 業務邏輯
    ├── mod.rs
    ├── dispatcher.rs
    └── engine_registry.rs
```

---

## ✅ 驗收清單

使用此文件後，您應該能：

- ✅ 知道「RAS API 是什麼」
- ✅ 了解 API 的呼叫流程
- ✅ 使用公開端點查詢引擎和格式
- ✅ 使用認證端點建立轉換任務
- ✅ 正確處理錯誤回應
- ✅ 傳遞引擎特定參數
