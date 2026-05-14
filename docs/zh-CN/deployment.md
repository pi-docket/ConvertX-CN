# 部署指南

> 文件目的：说明生产环境部署、反向代理、HTTPS、持久化、备份、更新与 API Server profile。
> 适合读者：部署者、维护者。
> 最后更新依据：`compose.yaml`、`.env.example`、`Dockerfile*`、`src/helpers/env.ts`、`src/helpers/startupStatus.ts`、`api-server/src/config.rs`。
> 相关文件：[快速开始](getting-started.md)、[环境变量](configuration.md)、[安全说明](security.md)、[错误排查](troubleshooting.md)

## 目录

- [Docker Run](#docker-run)
- [Docker Compose](#docker-compose)
- [版本选择](#版本选择)
- [反向代理](#反向代理)
- [HTTPS 与 Cookie](#https-与-cookie)
- [WEBROOT 子路径](#webroot-子路径)
- [data 目录持久化](#data-目录持久化)
- [备份与还原](#备份与还原)
- [更新方式](#更新方式)
- [API Server profile](#api-server-profile)
- [GPU / FFmpeg / MinerU](#gpu--ffmpeg--mineru)

## Docker Run

Docker Run 适合简单部署：

```bash
docker run -d \
  --name convertx-cn \
  --restart unless-stopped \
  -p 3000:3000 \
  -v ./data:/app/data \
  --env-file .env \
  convertx/convertx-cn:latest
```

## Docker Compose

Compose 适合生产部署，因为它更容易启用 API Server、挂载数据目录和管理环境变量。

```bash
docker compose up -d
```

启用 API Server：

```bash
docker compose --profile api up -d
```

## 版本选择

- Lite：镜像较小，适合常见转换。
- Standard：默认推荐。
- Full：适合需要更完整依赖的场景，但具体额外能力需以构建和发布说明确认。

## 反向代理

可使用 Nginx、Caddy、Traefik 或 Cloudflare Tunnel。反向代理应转发：

- Host
- X-Forwarded-For
- X-Forwarded-Proto
- X-Forwarded-Host

如果由反向代理提供 HTTPS，建议设置：

```env
TRUST_PROXY=true
HTTP_ALLOWED=false
```

本地 HTTP 测试可设置：

```env
HTTP_ALLOWED=true
```

## HTTPS 与 Cookie

Web UI 登录依赖 JWT Cookie。生产环境应使用 HTTPS；如果 HTTPS 终止在代理层，必须正确配置 `TRUST_PROXY`，否则可能出现登录后跳回登录页。

## WEBROOT 子路径

如果部署在子路径，例如：

```text
https://example.com/convertx/
```

设置：

```env
WEBROOT=/convertx
```

反向代理也需要同步配置路径转发。

## data 目录持久化

必须挂载：

```yaml
volumes:
  - ./data:/app/data
```

`data` 中包含上传文件、输出文件和 SQLite 数据库。未持久化会导致容器重建后数据丢失。

## 备份与还原

备份：

```bash
tar -czf convertx-data-backup.tar.gz ./data
```

还原：

```bash
tar -xzf convertx-data-backup.tar.gz
```

建议先停止容器再备份，避免 SQLite 写入中产生不一致。

## 更新方式

```bash
docker compose pull
docker compose up -d
```

更新前建议备份 `data` 和 `.env`。

## API Server profile

`convertx-api` 是可选服务：

```bash
docker compose --profile api up -d
```

API Server 默认端口为 `7890`，会使用 `CONVERTX_BACKEND_URL` 调用 Web UI 后端。当前 API Server 仍可能重构，不建议把其接口视为长期稳定。

## GPU / FFmpeg / MinerU

- FFmpeg 可通过 `FFMPEG_ARGS` 与 `FFMPEG_OUTPUT_ARGS` 传入额外参数，例如硬件加速参数。
- MinerU 支持 `pipeline` 与 VLM 相关配置，但 VLM、模型路径和 llama.cpp server 支持需要按镜像与架构实测。
- GPU、VAAPI、CUDA 等能力依赖宿主机驱动、Docker runtime 与镜像内 binary 支持，文档中不能默认承诺可用。
