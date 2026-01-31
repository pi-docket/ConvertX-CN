# Docker 部署指南

本文件說明如何使用 Docker 部署 ConvertX-CN。

---

## 快速開始（推薦）

使用完整的 `docker-compose.production.yml` 配置：

```bash
# 1. 建立資料目錄
mkdir -p data

# 2. 產生 JWT 密鑰
echo "JWT_SECRET=$(openssl rand -hex 32)" > .env

# 3. 啟動服務
docker compose -f docker-compose.production.yml up -d
```

### Profile 選擇

```bash
# 只啟動 Web UI（預設）
docker compose -f docker-compose.production.yml up -d

# Web UI + API Server（JWT 統一認證）
docker compose -f docker-compose.production.yml --profile api up -d

# Web UI + GPU 加速
docker compose -f docker-compose.production.yml --profile gpu up -d

# Web UI + MinerU（CPU-only）
docker compose -f docker-compose.production.yml --profile mineru up -d

# Web UI + API + 24 小時自動清理（完整版）
docker compose -f docker-compose.production.yml --profile api --profile cleanup up -d
```

---

## JWT 統一認證（v2.0.0 新增）

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

或在 `docker-compose.yml` 中：

```yaml
services:
  convertx:
    environment:
      - JWT_SECRET=${JWT_SECRET}

  convertx-api:
    environment:
      - JWT_SECRET=${JWT_SECRET}
```

---

## Docker Image 版本

### 官方預建版（推薦）

| Tag                           | 說明       |
| ----------------------------- | ---------- |
| `convertx/convertx-cn:latest` | 最新穩定版 |
| `convertx/convertx-cn:v0.1.x` | 指定版本號 |

**內建功能：**

- ✅ 核心轉換工具（FFmpeg、LibreOffice、ImageMagick 等）
- ✅ OCR 支援：英文、繁/簡中文、日文、韓文、德文、法文
- ✅ 字型：Noto CJK、Liberation、自訂中文字型
- ✅ TexLive（支援 CJK/德/法）

**Image 大小：約 4-6 GB**

### 完整版（自行 Build）

使用 `Dockerfile.full` 自行建構，適合需要：

- 65 種 OCR 語言
- 完整 TexLive
- 額外字型套件

```bash
docker build -f Dockerfile.full -t convertx-cn-full .
```

> ⚠️ 注意：Image 大小可能超過 **10GB**，Build 時間約 **30-60 分鐘**

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

### 參數說明

| 參數                       | 說明       |
| -------------------------- | ---------- |
| `-d`                       | 背景執行   |
| `--name convertx-cn`       | 容器名稱   |
| `--restart unless-stopped` | 自動重啟   |
| `-p 3000:3000`             | 連接埠映射 |
| `-v ./data:/app/data`      | 資料持久化 |
| `-e TZ=Asia/Taipei`        | 時區設定   |

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

### 建立資料夾

**重要**：請務必先建立資料夾，否則 Docker 會建立匿名 volume。

**Linux / macOS：**

```bash
mkdir -p ~/convertx-cn/data
```

**Windows PowerShell：**

```powershell
mkdir C:\convertx-cn\data
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

### AMD VAAPI

```yaml
services:
  convertx:
    image: convertx/convertx-cn:latest
    devices:
      - /dev/dri:/dev/dri
    environment:
      - FFMPEG_ARGS=-hwaccel vaapi -hwaccel_device /dev/dri/renderD128
      - FFMPEG_OUTPUT_ARGS=-c:v h264_vaapi
```

---

## 資源限制

### 記憶體限制

```yaml
services:
  convertx:
    deploy:
      resources:
        limits:
          memory: 4G
        reservations:
          memory: 2G
```

### CPU 限制

```yaml
services:
  convertx:
    deploy:
      resources:
        limits:
          cpus: "2"
```

---

## 版本更新

**1. 拉取最新版本：**

```bash
docker pull convertx/convertx-cn:latest
```

**2. 停止並移除舊容器：**

```bash
docker stop convertx-cn
docker rm convertx-cn
```

**3. 重新啟動（使用相同的參數）：**

```bash
docker run -d --name convertx-cn ...
```

或使用 Docker Compose：

```bash
docker compose pull
docker compose up -d
```

---

## 疑難排解

### 查看日誌

```bash
docker logs convertx-cn
```

持續追蹤日誌：

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
