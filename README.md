![ConvertX-CN](images/logo.png)

# ConvertX-CN

ConvertX-CN 是一个以 Docker 为主要交付方式的文件转换服务，提供 Web UI、批量上传、转换历史、格式推断、多语言界面，以及可选的 Rust API Server。

[![Docker Pulls](https://img.shields.io/docker/pulls/convertx/convertx-cn?style=flat&logo=docker)](https://hub.docker.com/r/convertx/convertx-cn)
[![GitHub Release](https://img.shields.io/github/v/release/pi-docket/ConvertX-CN)](https://github.com/pi-docket/ConvertX-CN/releases)
[![License AGPL-3.0](https://img.shields.io/badge/license-AGPL--3.0-blue)](LICENSE)
![Docker Image Size (Latest Lite)](<https://img.shields.io/docker/image-size/convertx/convertx-cn/latest-lite?label=image%20size%20(latest-lite)>)

[Docker Hub](https://hub.docker.com/r/convertx/convertx-cn) · [Releases](https://github.com/pi-docket/ConvertX-CN/releases) · [License](LICENSE)

## 主要特色

- 支持多类文件转换：影音、图片、文档、电子书、PDF、OCR、向量图、3D 模型与结构化数据。
- 内置多种转换引擎，包括 FFmpeg、ImageMagick、GraphicsMagick、libvips、LibreOffice、Pandoc、Calibre、Inkscape、PDFMathTranslate、BabelDOC、MinerU、OCRmyPDF 等。
- 提供 Web UI，支持用户登录、上传、转换、下载和历史记录。
- 提供 Lite / Standard / Full 映像选择，便于在镜像体积与功能完整度之间取舍。
- 提供可选 API Server，用于 REST API、JWT 鉴权与任务式转换流程；该部分仍可能重构。

## 适合谁使用

- 需要私有部署文件转换服务的个人或团队。
- 需要用 Docker 快速集成多种转换工具的部署者。
- 需要通过 API 接入 ConvertX-CN 转换能力的开发者。
- 想维护转换引擎、格式矩阵或文档体系的贡献者。

## Quick Start

```bash
mkdir -p convertx-cn/data
cd convertx-cn
cp .env.example .env
# 编辑 .env，设置固定且足够随机的 JWT_SECRET
docker compose up -d
```

启动后打开：

```text
http://localhost:3000
```

最小 `compose.yaml` 示例：

```yaml
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
```

Docker Run 示例：

```bash
docker run -d \
  --name convertx-cn \
  --restart unless-stopped \
  -p 3000:3000 \
  -v ./data:/app/data \
  --env-file .env \
  convertx/convertx-cn:latest
```

## 在线演示(正在維護)

[![Live Demo](https://img.shields.io/badge/demo-online-brightgreen)](https://convertx-cn.bioailab.qzz.io)

演示地址：https://convertx-cn.bioailab.qzz.io

| 项目 | 内容              |
| ---- | ----------------- |
| 账号 | admin@example.com |
| 密码 | admin             |

> 演示站仅供测试，请勿上传敏感文件，会定期清理数据。

## 文档入口

| 文件                                         | 说明                                      | 适合读者        |
| -------------------------------------------- | ----------------------------------------- | --------------- |
| [快速开始](docs/zh-CN/getting-started.md)    | 5 分钟启动 ConvertX-CN                    | 一般使用者      |
| [安装方式](docs/zh-CN/installation.md)       | Docker Compose、Docker Run、本地开发安装  | 使用者 / 部署者 |
| [部署指南](docs/zh-CN/deployment.md)         | Docker、反向代理、HTTPS、备份、更新       | 部署者          |
| [环境变量](docs/zh-CN/configuration.md)      | 所有 `.env` 设置与来源说明                | 部署者 / 维护者 |
| [引擎说明](docs/zh-CN/engines.md)            | 支持哪些引擎、依赖和限制                  | 使用者 / 开发者 |
| [格式矩阵](docs/zh-CN/format-matrix.md)      | 输入输出格式与版本支持矩阵                | 使用者 / 开发者 |
| [API Server](docs/zh-CN/api-server.md)       | Rust API Server 的定位、状态与限制        | 开发者          |
| [API Reference](docs/zh-CN/api-reference.md) | 当前 REST / GraphQL API 参考              | 开发者          |
| [架构说明](docs/zh-CN/architecture.md)       | Web UI、转换器、API Server 与 Docker 架构 | 维护者          |
| [开发指南](docs/zh-CN/development.md)        | 技术栈、项目结构、测试与贡献流程          | 贡献者          |
| [测试指南](docs/zh-CN/testing.md)            | 单元测试、converter 测试、e2e、API tests  | 贡献者          |
| [错误排查](docs/zh-CN/troubleshooting.md)    | 常见错误、原因与解决方式                  | 所有人          |
| [安全说明](docs/zh-CN/security.md)           | JWT、公开部署、上传文件与 Docker 安全     | 部署者          |

## 版本选择摘要

| 版本     | 适合场景                        | 说明                                                                |
| -------- | ------------------------------- | ------------------------------------------------------------------- |
| Lite     | 轻量部署、常见格式转换          | 镜像较小，部分 OCR、PDF 翻译、MinerU/VLM 能力可能不可用或待确认。   |
| Standard | 推荐默认选择                    | 覆盖主要转换引擎、OCR、PDF 与多语言场景。                           |
| Full     | 需要更完整 OCR 语言包或扩展依赖 | 以 Standard 为基础扩展，具体差异以 Dockerfile.full 和发布镜像为准。 |

## API Server 状态

API Server 是可选服务，不影响 Web UI 的基本使用。当前实现位于 `api-server/`，使用 Rust + Axum，提供 REST API 与 GraphQL 入口；由于后续可能重构，对外集成前请阅读 [API Server](docs/zh-CN/api-server.md) 与 [API Reference](docs/zh-CN/api-reference.md)。

## 安全提醒

- 生产环境必须设置固定、随机且足够长的 `JWT_SECRET`。
- 公开部署时请使用 HTTPS，并正确配置反向代理相关环境变量。
- 不建议在公网开启未认证访问。
- 上传和转换敏感文件前，请确认数据目录、备份策略和访问控制符合你的安全要求。

## 授权与致谢

ConvertX-CN 使用 AGPL-3.0 授权。项目集成并依赖多个开源转换工具，详见各工具原始项目与本仓库文档。
