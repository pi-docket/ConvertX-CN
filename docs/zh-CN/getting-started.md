# 快速开始

> 文件目的：用最短步骤启动 ConvertX-CN 并完成一次基本访问。
> 适合读者：第一次使用 ConvertX-CN 的用户。
> 最后更新依据：`README.md`、`.env.example`、`compose.yaml`、`src/index.tsx`。
> 相关文件：[安装方式](installation.md)、[部署指南](deployment.md)、[环境变量](configuration.md)、[错误排查](troubleshooting.md)

## 目录

- [前置条件](#前置条件)
- [Docker Compose 快速启动](#docker-compose-快速启动)
- [Docker Run 快速启动](#docker-run-快速启动)
- [Lite 版快速启动](#lite-版快速启动)
- [API Server 选用启动](#api-server-选用启动)
- [第一次使用](#第一次使用)
- [下一步](#下一步)

## 前置条件

- 已安装 Docker。
- 已安装 Docker Compose。
- 可以创建本地 `data` 目录用于持久化上传文件、输出文件和 SQLite 数据库。

## Docker Compose 快速启动

```bash
mkdir -p convertx-cn/data
cd convertx-cn
cp .env.example .env
```

编辑 `.env`，至少设置固定的 `JWT_SECRET`：

```env
JWT_SECRET=replace-with-a-random-secret-at-least-32-chars
TZ=Asia/Shanghai
```

启动：

```bash
docker compose up -d
```

打开：

```text
http://localhost:3000
```

## Docker Run 快速启动

```bash
mkdir -p convertx-cn/data
cd convertx-cn
cp .env.example .env
docker run -d \
  --name convertx-cn \
  --restart unless-stopped \
  -p 3000:3000 \
  -v ./data:/app/data \
  --env-file .env \
  convertx/convertx-cn:latest
```

## Lite 版快速启动

```bash
docker run -d \
  --name convertx-cn-lite \
  --restart unless-stopped \
  -p 3000:3000 \
  -v ./data:/app/data \
  --env-file .env \
  convertx/convertx-cn:lite
```

Lite 版适合常见转换和较小镜像场景。OCR、PDF 翻译、MinerU、部分图片/向量引擎支持状态请以 [引擎说明](engines.md) 和实际镜像验证为准。

## API Server 选用启动

API Server 不影响 Web UI 使用。如需要 REST API，可使用 compose profile：

```bash
cp api-server/.env.api.example .env.api
# 编辑 .env.api，并设置 API_JWT_SECRET 或通过 compose 映射为 JWT_SECRET
docker compose --profile api up -d
```

当前 API Server 仍可能重构，接入前请阅读 [API Server](api-server.md)。

## 第一次使用

1. 打开 Web UI。
2. 注册或登录用户。
3. 上传一个小文件。
4. 选择目标格式。
5. 等待转换完成并下载结果。

## 下一步

- 生产部署请继续阅读 [部署指南](deployment.md)。
- 需要完整配置请阅读 [环境变量](configuration.md)。
- 需要确认格式支持请阅读 [格式矩阵](format-matrix.md)。
