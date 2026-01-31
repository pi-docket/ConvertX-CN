# Docker 部署指南

本文件說明如何使用 Docker 部署 ConvertX-CN。

---

## 快速開始（推薦）

### 一鍵部署（CPU 版本）

```bash
# 1. 建立專案目錄
mkdir -p ~/convertx-cn && cd ~/convertx-cn

# 2. 建立環境變數
cat > .env << 'EOF'
JWT_SECRET=your-super-secret-jwt-key-change-this
AUTO_DELETE_EVERY_N_HOURS=24
HTTP_ALLOWED=true
EOF

# 3. 建立 docker-compose.yml
cat > docker-compose.yml << 'EOF'
services:
  convertx:
    image: convertx/convertx-cn:latest
    container_name: convertx-cn
    restart: unless-stopped
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
    environment:
      - JWT_SECRET=${JWT_SECRET}
      - AUTO_DELETE_EVERY_N_HOURS=24
      - HTTP_ALLOWED=true
EOF

# 4. 啟動服務
mkdir -p data
docker compose pull
docker compose up -d
```

### 一鍵部署（GPU 版本）

```bash
cat > docker-compose.yml << 'EOF'
services:
  convertx:
    image: convertx/convertx-cn:latest
    container_name: convertx-cn
    restart: unless-stopped
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
    environment:
      - JWT_SECRET=${JWT_SECRET}
      - AUTO_DELETE_EVERY_N_HOURS=24
      - HTTP_ALLOWED=true
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: all
              capabilities: [gpu]
EOF

docker compose up -d
```

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

Web UI 和 RAS API Server 共用同一個 `JWT_SECRET`：

- ✅ Web UI 登入產生的 Token 可直接用於 API 認證
- ✅ 無需維護兩套認證系統
- ✅ 部署時只需設定一次

### 配置方式

在 `.env` 檔案中設定：

```bash
JWT_SECRET=your-super-secret-jwt-key-at-least-32-characters
```

---

## 加入 API Server（可選）

如果需要 REST/GraphQL API 給外部程式呼叫：

### 1. 下載 api-server 目錄

```bash
cd ~/convertx-cn
git clone --depth 1 https://github.com/pi-docket/ConvertX-CN.git /tmp/convertx-cn
cp -r /tmp/convertx-cn/api-server ./
rm -rf /tmp/convertx-cn
```

### 2. 更新 docker-compose.yml

```yaml
services:
  # Web UI（主服務）
  convertx:
    image: convertx/convertx-cn:latest
    container_name: convertx-cn
    restart: unless-stopped
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
    environment:
      - JWT_SECRET=${JWT_SECRET}
      - AUTO_DELETE_EVERY_N_HOURS=24
      - HTTP_ALLOWED=true

  # API Server（輕量代理）
  convertx-api:
    build:
      context: ./api-server
      dockerfile: Dockerfile
    container_name: convertx-api
    restart: unless-stopped
    ports:
      - "7890:7890"
    environment:
      - JWT_SECRET=${JWT_SECRET}
      - CONVERTX_BACKEND_URL=http://convertx:3000
    depends_on:
      - convertx
```

### 3. 啟動服務

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
