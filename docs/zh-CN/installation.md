# 安装方式

> 文件目的：说明 ConvertX-CN 的安装方式、镜像版本和本地开发安装入口。
> 适合读者：使用者、部署者、开发者。
> 最后更新依据：`Dockerfile`、`Dockerfile.lite`、`Dockerfile.full`、`compose.yaml`、`package.json`、`api-server/Cargo.toml`。
> 相关文件：[快速开始](getting-started.md)、[部署指南](deployment.md)、[开发指南](development.md)

## 目录

- [推荐方式](#推荐方式)
- [Docker Compose](#docker-compose)
- [Docker Run](#docker-run)
- [Lite / Standard / Full](#lite--standard--full)
- [API Server](#api-server)
- [本地开发安装](#本地开发安装)
- [待确认](#待确认)

## 推荐方式

推荐使用 Docker Compose。项目包含大量系统工具、Python 工具、字体、OCR 与模型依赖，手动在宿主机安装容易出现版本差异。

## Docker Compose

仓库根目录的 `compose.yaml` 定义了：

- `convertx`：Web UI / Web Server，默认映射 `3000:3000`。
- `convertx-api`：可选 API Server，profile 为 `api`，默认映射 `7890:7890`。

最小启动：

```bash
cp .env.example .env
docker compose up -d
```

启动 API Server：

```bash
cp api-server/.env.api.example .env.api
docker compose --profile api up -d
```

## Docker Run

```bash
docker run -d \
  --name convertx-cn \
  --restart unless-stopped \
  -p 3000:3000 \
  -v ./data:/app/data \
  --env-file .env \
  convertx/convertx-cn:latest
```

## Lite / Standard / Full

| 版本 | Dockerfile | 说明 |
|---|---|---|
| Lite | `Dockerfile.lite` | 轻量版本，保留常见转换工具，部分高级功能可能缺失。 |
| Standard | `Dockerfile` | 默认推荐版本，包含主要系统工具、Python 工具、OCR、PDF 翻译、MinerU 相关依赖与模型准备流程。 |
| Full | `Dockerfile.full` | 基于 Standard 扩展，当前文件中大量扩展 OCR/TeX 依赖以注释形式存在，实际发布差异需要复核。 |

## API Server

API Server 位于 `api-server/`，使用 Rust + Axum 实作。它是可选服务，主要用于 REST API、JWT Bearer 鉴权和任务式转换流程。

## 本地开发安装

Web 项目使用 Bun：

```bash
bun install
bun run dev
```

API Server 使用 Cargo：

```bash
cd api-server
cargo run
```

本地开发仍需要宿主机安装对应转换引擎，否则 converter 测试或实际转换可能失败。

## 待确认

- 当前发布镜像的 tag 命名与 Lite / Standard / Full 的最终对应关系。
- Full 版实际启用的额外 OCR / TeX 依赖。
- arm64 架构下每个外部 binary 的最终可用性。
