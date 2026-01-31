# Docker 部署指南

本文件說明如何使用 Docker 部署 ConvertX-CN。

---

## 快速開始（推薦）

### 步驟 1：建立專案目錄

```bash
mkdir -p ~/convertx-cn && cd ~/convertx-cn
```

### 步驟 2：建立環境變數檔案 `.env`

```bash
cat > .env << 'EOF'
# ================================
# ConvertX-CN 環境變數配置
# ================================

# 🔐 JWT 認證金鑰（必須設定，至少 32 字元）
# ⚠️ 請務必更換為你自己的隨機字串！
JWT_SECRET=your-super-secret-jwt-key-change-this-to-random-string

# 🕐 自動清理週期（小時）
AUTO_DELETE_EVERY_N_HOURS=24

# 🌐 允許 HTTP（非 HTTPS）存取
HTTP_ALLOWED=true

# ================================
# API Server 專用（可選）
# ================================

# API Server 後端地址（Docker Compose 內部網路）
CONVERTX_BACKEND_URL=http://convertx:3000

# API Server 監聽端口
RAS_API_PORT=7890
EOF
```

> ⚠️ **重要**：請務必將 `JWT_SECRET` 更換為你自己的隨機字串（至少 32 字元）！

### 步驟 3：建立 docker-compose.yml

**CPU 版本：**

```yaml
# docker-compose.yml
services:
  convertx:
    image: convertx/convertx-cn:latest
    container_name: convertx-cn
    restart: unless-stopped
    ports:
      - "3000:3000" # Web UI 端口
    volumes:
      - ./data:/app/data
    env_file:
      - .env
```

**GPU 版本（NVIDIA）：**

```yaml
# docker-compose.yml
services:
  convertx:
    image: convertx/convertx-cn:latest
    container_name: convertx-cn
    restart: unless-stopped
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
    env_file:
      - .env
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: all
              capabilities: [gpu]
```

### 步驟 4：啟動服務

```bash
mkdir -p data
docker compose pull
docker compose up -d
```

### 步驟 5：驗證服務

```bash
# 檢查服務狀態
docker compose ps

# 檢查日誌
docker compose logs -f

# 測試連線
curl http://localhost:3000
```

---

## 🔧 修改端口

如果你需要修改 Web UI 的對外端口（例如改為 7303）：

**修改 docker-compose.yml：**

```yaml
ports:
  - "7303:3000" # 左邊是對外端口，右邊是容器內部端口
```

> 📝 只需修改冒號左邊的數字。右邊的 `3000` 是容器內部端口，不要修改。

---

## 架構說明

### Web UI（主服務）

```
┌─────────────────┐     ┌──────────────────┐
│   瀏覽器使用者    │────▶│   Web UI         │──▶ 內建轉換工具
│                 │     │   (Bun, :3000)   │
└─────────────────┘     └──────────────────┘
```

Web UI 已內建所有轉換工具，直接使用即可。

### Web UI + API Server（進階）

```
┌─────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   外部程式/腳本   │────▶│   API Server     │────▶│   Web UI         │
│   (REST/GraphQL) │     │   (輕量代理)      │     │   (已有工具)      │
└─────────────────┘     └──────────────────┘     └──────────────────┘
```

API Server 是輕量代理，轉發請求給 Web UI，不需要安裝額外工具。

---

## JWT 統一認證

### 設計理念

Web UI 和 API Server 共用同一個 `JWT_SECRET`：

- ✅ Web UI 登入產生的 Token 可直接用於 API 認證
- ✅ 無需維護兩套認證系統
- ✅ 部署時只需在 `.env` 設定一次

### 配置方式

在 `.env` 檔案中設定（已在上面步驟 2 建立）：

```bash
JWT_SECRET=your-super-secret-jwt-key-at-least-32-characters
```

---

## 加入 API Server（可選）

如果需要 REST/GraphQL API 給外部程式呼叫，有兩種方式：

### 方式 1：使用預編譯 Binary（推薦）

從 [GitHub Releases](https://github.com/pi-docket/ConvertX-CN/releases) 下載預編譯的 API Server：

```bash
# 1. 下載適合你系統的版本
# Linux AMD64
curl -L -o convertx-api.tar.gz \
  https://github.com/pi-docket/ConvertX-CN/releases/latest/download/convertx-api-linux-amd64.tar.gz

# 2. 解壓
tar -xzf convertx-api.tar.gz

# 3. 設定環境變數（使用與 Web UI 相同的 .env）
export $(grep -v '^#' .env | xargs)
export CONVERTX_BACKEND_URL=http://localhost:3000

# 4. 啟動 API Server
./convertx-api
```

**🔧 修改 API Server 端口：**

```bash
# 在 .env 中設定
RAS_API_PORT=8080

# 或直接設定環境變數
export RAS_API_PORT=8080
./convertx-api
```

### 方式 2：使用 Docker Compose 建置

**1. 下載 api-server 目錄：**

```bash
cd ~/convertx-cn
git clone --depth 1 https://github.com/pi-docket/ConvertX-CN.git /tmp/convertx-cn
cp -r /tmp/convertx-cn/api-server ./
rm -rf /tmp/convertx-cn
```

**2. 更新 docker-compose.yml：**

```yaml
services:
  # Web UI（主服務）
  convertx:
    image: convertx/convertx-cn:latest
    container_name: convertx-cn
    restart: unless-stopped
    ports:
      - "3000:3000" # Web UI 端口
    volumes:
      - ./data:/app/data
    env_file:
      - .env

  # API Server（輕量代理）
  convertx-api:
    build:
      context: ./api-server
      dockerfile: Dockerfile
    container_name: convertx-api
    restart: unless-stopped
    ports:
      - "7890:7890" # API Server 端口
    env_file:
      - .env
    environment:
      # 覆蓋 .env 中的設定，指向 Docker 內部網路
      - CONVERTX_BACKEND_URL=http://convertx:3000
    depends_on:
      - convertx
```

**🔧 修改 API Server 端口：**

```yaml
# 修改 ports 和環境變數
ports:
  - "8080:8080" # 改為你想要的端口
environment:
  - RAS_API_PORT=8080 # 容器內部端口也要同步修改
  - CONVERTX_BACKEND_URL=http://convertx:3000
```

**3. 啟動服務：**

```bash
docker compose down
docker compose up -d --build
```

### API 端點

| 端點                  | 說明         |
| --------------------- | ------------ |
| `GET /api/v1/health`  | 健康檢查     |
| `GET /api/v1/info`    | API 資訊     |
| `GET /api/v1/engines` | 引擎列表     |
| `GET /api/v1/formats` | 格式列表     |
| `POST /api/v1/jobs`   | 建立轉換任務 |
| `GET /swagger-ui`     | Swagger 文件 |

### API 使用範例

```bash
# 健康檢查
curl http://localhost:7890/api/v1/health

# 取得支援格式（需要 JWT Token）
TOKEN=$(curl -s -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your-password"}' | jq -r '.token')

curl http://localhost:7890/api/v1/formats \
  -H "Authorization: Bearer $TOKEN"
```

---

## Docker Image 版本

### 官方預建版（推薦）

| Tag                           | 說明               |
| ----------------------------- | ------------------ |
| `convertx/convertx-cn:latest` | 最新穩定版         |
| `convertx/convertx-cn:v0.1.x` | 指定版本號         |
| `convertx/convertx-cn:lite`   | 輕量版（約 1.5GB） |

**內建功能：**

- ✅ 核心轉換工具（FFmpeg、LibreOffice、ImageMagick 等）
- ✅ OCR 支援：英文、繁/簡中文、日文、韓文、德文、法文
- ✅ 字型：Noto CJK、Liberation、自訂中文字型
- ✅ TexLive（支援 CJK/德/法）
- ✅ 24 小時自動清理（內建）

**Image 大小：約 4-6 GB**

---

## Docker Run

### 基本啟動

```bash
docker run -d \
  --name convertx-cn \
  --restart unless-stopped \
  -p 3000:3000 \
  -v ./data:/app/data \
  -e TZ=Asia/Taipei \
  -e JWT_SECRET=你的隨機字串至少32字元 \
  convertx/convertx-cn:latest
```

### 進階選項

```bash
docker run -d \
  --name convertx-cn \
  --restart unless-stopped \
  -p 3000:3000 \
  -v ./data:/app/data \
  -e TZ=Asia/Taipei \
  -e JWT_SECRET=你的隨機字串 \
  -e ACCOUNT_REGISTRATION=false \
  -e HTTP_ALLOWED=true \
  -e AUTO_DELETE_EVERY_N_HOURS=24 \
  convertx/convertx-cn:latest
```

---

## 資料持久化

### Volume 結構

```
./data/
├── convertx.db  # SQLite 資料庫
├── uploads/     # 上傳的原始檔案
└── output/      # 轉換後的檔案
```

### 備份與還原

**備份：**

```bash
tar -czvf convertx-backup-$(date +%Y%m%d).tar.gz ./data
```

**還原：**

```bash
tar -xzvf convertx-backup-20260120.tar.gz
```

---

## 硬體加速

### NVIDIA GPU (CUDA/NVENC)

1. 安裝 [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html)

2. Docker Compose 配置：

```yaml
services:
  convertx:
    image: convertx/convertx-cn:latest
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: all
              capabilities: [gpu]
    environment:
      - FFMPEG_ARGS=-hwaccel cuda -hwaccel_output_format cuda
      - FFMPEG_OUTPUT_ARGS=-c:v h264_nvenc -preset fast
```

### Intel Quick Sync Video (QSV)

```yaml
services:
  convertx:
    image: convertx/convertx-cn:latest
    devices:
      - /dev/dri:/dev/dri
    environment:
      - FFMPEG_ARGS=-hwaccel qsv
      - FFMPEG_OUTPUT_ARGS=-c:v h264_qsv -preset faster
```

---

## 版本更新

```bash
docker compose pull
docker compose up -d
```

或手動：

```bash
docker pull convertx/convertx-cn:latest
docker stop convertx-cn
docker rm convertx-cn
docker run -d --name convertx-cn ...
```

---

## 疑難排解

### 查看日誌

```bash
docker logs -f convertx-cn
```

### 進入容器

```bash
docker exec -it convertx-cn /bin/bash
```

### 常見問題

| 問題        | 解決方法                       |
| ----------- | ------------------------------ |
| 啟動失敗    | 檢查日誌 `docker logs`         |
| Port 被占用 | 改用其他 port `-p 8080:3000`   |
| 權限錯誤    | `chmod -R 777 ./data`          |
| 記憶體不足  | 增加記憶體限制或減少同時轉換數 |

---

## 相關文件

- [Docker Compose 詳解](Docker組合.md)
- [反向代理設定](反向代理.md)
- [環境變數設定](../配置設定/環境變數.md)
