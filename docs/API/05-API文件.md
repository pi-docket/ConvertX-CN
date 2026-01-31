# API 文件

ConvertX-CN 提供選用的 API Server，支援 REST API 介面供第三方程式呼叫。

---

## 目錄

- [快速啟用](#快速啟用)
- [JWT 認證配置](#jwt-認證配置)
- [認證機制](#認證機制)
- [REST API 端點](#rest-api-端點)
- [錯誤碼說明](#錯誤碼說明)
- [使用範例](#使用範例)

---

## 快速啟用

API Server 是**選用功能**，不影響 Web UI 使用。

### 1. 配置 `.env` 檔案

**首先必須配置 `JWT_SECRET`**，這是 API Server 運作的必要條件：

```bash
# 在專案根目錄建立 .env 檔案
cat > .env << 'EOF'
# JWT 密鑰（必須設定！）
# 建議使用至少 32 字元的隨機字串
JWT_SECRET=your-super-secret-jwt-key-change-me-in-production

# API Server 設定
RAS_API_PORT=7890
CONVERTX_BACKEND_URL=http://convertx:3000

# 檔案限制
MAX_FILE_SIZE=524288000
UPLOAD_DIR=./data/uploads
OUTPUT_DIR=./data/output
EOF
```

> ⚠️ **重要**：`JWT_SECRET` 必須在生產環境中使用強密碼！

### 2. 產生安全的 JWT_SECRET

```bash
# Linux/macOS
openssl rand -base64 32

# 或使用 Python
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

### 3. 啟動 API Server

```bash
docker compose --profile api up -d
```

### 服務端口

| 服務       | 端口 | 說明         |
| ---------- | ---- | ------------ |
| Web UI     | 3000 | 網頁介面     |
| API Server | 7890 | REST API     |

### 環境變數

| 變數                   | 說明                  | 預設值                   | 必須 |
| ---------------------- | --------------------- | ------------------------ | ---- |
| `JWT_SECRET`           | JWT 驗證密鑰          | （無）                   | ✅   |
| `RAS_API_PORT`         | 監聽埠                | `7890`                   |      |
| `CONVERTX_BACKEND_URL` | Web UI 後端地址       | `http://convertx:3000`   |      |
| `UPLOAD_DIR`           | 上傳目錄              | `./data/uploads`         |      |
| `OUTPUT_DIR`           | 輸出目錄              | `./data/output`          |      |
| `MAX_FILE_SIZE`        | 最大檔案大小（bytes） | `524288000` (500MB)      |      |

---

## JWT 認證配置

### JWT Token 結構

API Server 驗證的 JWT Token 必須包含以下欄位：

```json
{
  "sub": "user-id",
  "email": "user@example.com",
  "scope": ["list_engines", "convert", "download"],
  "iat": 1700000000,
  "exp": 1700003600
}
```

### 權限範圍（Scope）

| 權限           | 說明                 |
| -------------- | -------------------- |
| `list_engines` | 查詢可用引擎         |
| `convert`      | 執行檔案轉換         |
| `download`     | 下載轉換結果         |
| `*`            | 所有權限（管理員）   |

### 產生 JWT Token（Python 範例）

```python
import jwt
import datetime

JWT_SECRET = "your-super-secret-jwt-key-change-me-in-production"

def generate_token(user_id: str, email: str, scopes: list[str]) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "scope": scopes,
        "iat": datetime.datetime.utcnow(),
        "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=1)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

# 產生完整權限的 Token
token = generate_token(
    user_id="user123",
    email="user@example.com",
    scopes=["list_engines", "convert", "download"]
)
print(f"Bearer {token}")
```

### 產生 JWT Token（Node.js 範例）

```javascript
const jwt = require('jsonwebtoken');

const JWT_SECRET = 'your-super-secret-jwt-key-change-me-in-production';

function generateToken(userId, email, scopes) {
  const payload = {
    sub: userId,
    email: email,
    scope: scopes,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600 // 1 小時後過期
  };
  return jwt.sign(payload, JWT_SECRET, { algorithm: 'HS256' });
}

const token = generateToken(
  'user123',
  'user@example.com',
  ['list_engines', 'convert', 'download']
);
console.log(`Bearer ${token}`);
```

---

## 認證機制

所有 API 請求（除健康檢查外）都需要 JWT Bearer Token：

```http
Authorization: Bearer <your-jwt-token>
```

> ⚠️ **注意**：API Server 只負責驗證 JWT，不負責產生 JWT。Token 應由您的應用程式使用相同的 `JWT_SECRET` 產生。

---

## REST API 端點

**Base URL**: `http://localhost:7890/api/v1`

### 健康檢查

檢查 API Server 運行狀態。**不需要認證**。

**請求**：

```http
GET /api/health
```

**回應**：

```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "version": "1.0.0",
    "backend_status": "healthy"
  }
}
```

---

### 列出所有引擎

取得所有可用的轉換引擎。

**請求**：

```http
GET /api/v1/engines
Authorization: Bearer <token>
```

**回應**：

```json
{
  "success": true,
  "data": {
    "engines": [
      {
        "engine_id": "ffmpeg",
        "engine_name": "FFmpeg",
        "description": "影音轉換引擎",
        "enabled": true,
        "input_formats": ["mp4", "avi", "mkv", "mov", "wmv", "flv", "webm", "mp3", "wav", "flac", "aac", "ogg", "m4a"],
        "output_formats": ["mp4", "avi", "mkv", "mov", "webm", "gif", "mp3", "wav", "flac", "aac", "ogg"],
        "max_file_size_mb": 2000,
        "requires_params": false
      },
      {
        "engine_id": "libreoffice",
        "engine_name": "LibreOffice",
        "description": "文件轉換引擎",
        "enabled": true,
        "input_formats": ["doc", "docx", "xls", "xlsx", "ppt", "pptx", "odt", "ods", "odp"],
        "output_formats": ["pdf", "docx", "xlsx", "pptx", "odt", "txt", "html"],
        "max_file_size_mb": 100,
        "requires_params": false
      }
    ],
    "total": 2
  }
}
```

---

### 取得引擎詳情

取得指定引擎的詳細資訊。

**請求**：

```http
GET /api/v1/engines/{engine_id}
Authorization: Bearer <token>
```

**回應**：

```json
{
  "success": true,
  "data": {
    "engine": {
      "engine_id": "ffmpeg",
      "engine_name": "FFmpeg",
      "description": "影音轉換引擎",
      "enabled": true,
      "input_formats": ["mp4", "avi", "mkv"],
      "output_formats": ["mp4", "webm", "mp3"],
      "max_file_size_mb": 2000,
      "requires_params": false
    }
  }
}
```

---

### 建立轉換任務

上傳檔案並建立轉換任務。**需要 `convert` 權限**。

**請求**：

```http
POST /api/v1/convert
Authorization: Bearer <token>
Content-Type: multipart/form-data

file: <binary>
params: {"output_format": "pdf", "engine_id": "libreoffice"}
```

**參數說明**：

| 欄位            | 類型   | 必須 | 說明                         |
| --------------- | ------ | ---- | ---------------------------- |
| `file`          | File   | ✅   | 要轉換的檔案                 |
| `params`        | JSON   | ✅   | 轉換參數                     |
| `output_format` | string | ✅   | 目標格式（如 pdf, mp4, png） |
| `engine_id`     | string |      | 指定引擎（可選，自動選擇）   |
| `options`       | object |      | 引擎特定參數                 |

**回應**：

```json
{
  "success": true,
  "data": {
    "job_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "status": "pending",
    "message": "Conversion job created"
  }
}
```

---

### 查詢任務狀態

取得轉換任務的當前狀態。

**請求**：

```http
GET /api/v1/jobs/{job_id}
Authorization: Bearer <token>
```

**回應（處理中）**：

```json
{
  "success": true,
  "data": {
    "job_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "status": "processing",
    "progress": 45,
    "original_filename": "document.docx",
    "input_format": "docx",
    "output_format": "pdf",
    "engine_id": "libreoffice",
    "error_message": null,
    "created_at": 1700000000,
    "updated_at": 1700000030,
    "completed_at": null,
    "download_ready": false
  }
}
```

**回應（完成）**：

```json
{
  "success": true,
  "data": {
    "job_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "status": "completed",
    "progress": 100,
    "original_filename": "document.docx",
    "input_format": "docx",
    "output_format": "pdf",
    "engine_id": "libreoffice",
    "error_message": null,
    "created_at": 1700000000,
    "updated_at": 1700000060,
    "completed_at": 1700000060,
    "download_ready": true
  }
}
```

---

### 下載轉換結果

下載轉換完成的檔案（ZIP 格式）。**需要 `download` 權限**。

**請求**：

```http
GET /api/v1/jobs/{job_id}/download
Authorization: Bearer <token>
```

**回應**：

```
HTTP/1.1 200 OK
Content-Type: application/zip
Content-Disposition: attachment; filename="a1b2c3d4-e5f6-7890-abcd-ef1234567890.zip"

<binary zip data>
```

---

## 錯誤碼說明

| HTTP 狀態碼 | 錯誤碼                  | 說明                     |
| ----------- | ----------------------- | ------------------------ |
| 400         | `INVALID_INPUT`         | 請求參數無效             |
| 400         | `UNSUPPORTED_CONVERSION`| 不支援的格式轉換         |
| 400         | `JOB_NOT_READY`         | 任務尚未完成             |
| 401         | `MISSING_AUTH_HEADER`   | 缺少授權標頭             |
| 401         | `INVALID_TOKEN`         | JWT Token 無效           |
| 401         | `TOKEN_EXPIRED`         | JWT Token 已過期         |
| 403         | `FORBIDDEN`             | 權限不足                 |
| 404         | `ENGINE_NOT_FOUND`      | 引擎不存在               |
| 404         | `JOB_NOT_FOUND`         | 任務不存在               |
| 413         | `FILE_TOO_LARGE`        | 檔案過大                 |
| 500         | `INTERNAL_ERROR`        | 內部錯誤                 |
| 502         | `BACKEND_ERROR`         | 後端服務錯誤             |

**錯誤回應格式**：

```json
{
  "error": "ENGINE_NOT_FOUND",
  "code": "ENGINE_NOT_FOUND",
  "message": "引擎不存在：unknown-engine"
}
```

---

## 使用範例

### cURL 範例

#### 1. 健康檢查

```bash
curl http://localhost:7890/api/health
```

#### 2. 列出引擎

```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:7890/api/v1/engines
```

#### 3. 轉換檔案

```bash
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@document.docx" \
  -F 'params={"output_format": "pdf"}' \
  http://localhost:7890/api/v1/convert
```

#### 4. 查詢狀態

```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:7890/api/v1/jobs/$JOB_ID
```

#### 5. 下載結果

```bash
curl -H "Authorization: Bearer $TOKEN" \
  -o result.zip \
  http://localhost:7890/api/v1/jobs/$JOB_ID/download
```

### Python 範例

```python
import requests
import jwt
import datetime

# 設定
API_URL = "http://localhost:7890"
JWT_SECRET = "your-super-secret-jwt-key-change-me-in-production"

# 產生 Token
token = jwt.encode({
    "sub": "user123",
    "scope": ["list_engines", "convert", "download"],
    "iat": datetime.datetime.utcnow(),
    "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=1)
}, JWT_SECRET, algorithm="HS256")

headers = {"Authorization": f"Bearer {token}"}

# 列出引擎
engines = requests.get(f"{API_URL}/api/v1/engines", headers=headers).json()
print("可用引擎：", [e["engine_name"] for e in engines["data"]["engines"]])

# 轉換檔案
with open("document.docx", "rb") as f:
    response = requests.post(
        f"{API_URL}/api/v1/convert",
        headers=headers,
        files={"file": f},
        data={"params": '{"output_format": "pdf"}'}
    )
    job_id = response.json()["data"]["job_id"]
    print(f"任務 ID：{job_id}")

# 等待完成並下載
import time
while True:
    status = requests.get(f"{API_URL}/api/v1/jobs/{job_id}", headers=headers).json()
    if status["data"]["status"] == "completed":
        break
    time.sleep(1)

# 下載結果
result = requests.get(f"{API_URL}/api/v1/jobs/{job_id}/download", headers=headers)
with open("result.zip", "wb") as f:
    f.write(result.content)
print("下載完成！")
```

---

## 常見問題

### Q: API Server 無法啟動？

確認 `.env` 檔案中已設定 `JWT_SECRET`：

```bash
# 檢查環境變數
cat .env | grep JWT_SECRET

# 如果沒有，請新增
echo 'JWT_SECRET=your-secret-here' >> .env
```

### Q: 收到 401 Unauthorized 錯誤？

1. 確認 Token 未過期
2. 確認使用相同的 `JWT_SECRET` 產生和驗證 Token
3. 確認 Token 格式正確：`Bearer <token>`

### Q: 收到 403 Forbidden 錯誤？

確認 Token 包含所需的權限範圍（scope）。轉換需要 `convert`，下載需要 `download`。
