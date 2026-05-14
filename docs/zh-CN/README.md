# ConvertX-CN 文档中心

> 文件目的：提供 ConvertX-CN 文档总入口与推荐阅读路径。
> 适合读者：使用者、部署者、开发者、维护者。
> 最后更新依据：`README.md`、`package.json`、`.env.example`、`compose.yaml`、`src/`、`api-server/`、`tests/`、`Dockerfile*`。
> 相关文件：[快速开始](getting-started.md)、[部署指南](deployment.md)、[环境变量](configuration.md)、[引擎说明](engines.md)、[API Server](api-server.md)

## 目录

- [阅读路径](#阅读路径)
- [核心文档](#核心文档)
- [维护原则](#维护原则)
- [待确认事项](#待确认事项)

## 阅读路径

| 目标 | 建议阅读 |
|---|---|
| 先跑起来 | [快速开始](getting-started.md) |
| 正式部署 | [安装方式](installation.md)、[部署指南](deployment.md)、[安全说明](security.md) |
| 调整配置 | [环境变量](configuration.md) |
| 确认支持格式 | [引擎说明](engines.md)、[格式矩阵](format-matrix.md) |
| 接 API | [API Server](api-server.md)、[API Reference](api-reference.md) |
| 贡献代码 | [架构说明](architecture.md)、[开发指南](development.md)、[测试指南](testing.md) |
| 排错 | [错误排查](troubleshooting.md) |

## 核心文档

| 文件 | 说明 | 适合读者 |
|---|---|---|
| [getting-started.md](getting-started.md) | 最短可用启动流程 | 一般使用者 |
| [installation.md](installation.md) | 安装方式与版本选择 | 使用者 / 部署者 |
| [deployment.md](deployment.md) | 生产部署、反向代理、备份与更新 | 部署者 |
| [configuration.md](configuration.md) | Web UI、API Server 与 Docker 环境变量 | 部署者 / 维护者 |
| [engines.md](engines.md) | 转换引擎、依赖、限制与测试位置 | 使用者 / 开发者 |
| [format-matrix.md](format-matrix.md) | 输入输出格式支持矩阵 | 使用者 / 开发者 |
| [api-server.md](api-server.md) | API Server 当前状态与未来重构说明 | 开发者 |
| [api-reference.md](api-reference.md) | 当前 API 路由、认证、请求与响应 | 开发者 |
| [architecture.md](architecture.md) | 系统架构、模块关系与流程图 | 维护者 |
| [development.md](development.md) | 本地开发、添加 converter、测试与发布 | 贡献者 |
| [testing.md](testing.md) | 测试类型、命令与验证方法 | 贡献者 |
| [troubleshooting.md](troubleshooting.md) | 常见问题与解决方式 | 所有人 |
| [security.md](security.md) | 安全配置与公开服务风险 | 部署者 |
| [roadmap.md](roadmap.md) | 当前状态、实验性功能与未来重构 | 所有人 |
| [i18n-docs-guide.md](i18n-docs-guide.md) | 文档多语言维护规则 | 文档维护者 / 翻译者 |

## 维护原则

- 简体中文是当前主文档版本。
- 英文文档从 zh-CN 翻译，不独立扩展未经确认的内容。
- 所有文件顶部必须说明目的、读者、最后更新依据和相关链接。
- 代码标识、环境变量、API route、Engine ID 和文件路径不翻译。
- 无法从代码确认的内容必须标注「待确认」。

## 待确认事项

- Lite / Standard / Full 每个引擎的精确差异需要基于镜像构建结果复核。
- 部分旧 API 文档提到的路由未在当前 `api-server/src/main.rs` 中出现。
- 部分环境变量只在示例文件出现，尚未在代码中确认生效。
