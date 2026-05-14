# Roadmap 与当前状态

> 文件目的：说明 ConvertX-CN 当前功能状态、实验性内容、待确认事项与未来重构方向。
> 适合读者：使用者、开发者、维护者。
> 最后更新依据：`src/`、`api-server/`、`Dockerfile*`、`tests/`、现有 docs。
> 相关文件：[API Server](api-server.md)、[引擎说明](engines.md)、[格式矩阵](format-matrix.md)

## 目录

- [已完成](#已完成)
- [目前可用](#目前可用)
- [实验性](#实验性)
- [待确认](#待确认)
- [未来重构](#未来重构)

## 已完成

- Web UI 基本上传、转换、下载和历史流程。
- Bun + Elysia Web Server。
- SQLite 数据库初始化。
- 多 converter 聚合机制。
- 多语言 UI 架构。
- Dockerfile / Dockerfile.lite / Dockerfile.full 构建入口。
- Rust API Server 初版。
- converter、transfer、e2e、API Server 测试目录。

## 目前可用

- Web UI 私有部署。
- Docker Compose 启动。
- 多种 converter 注册。
- 部分 API Server REST route。
- GraphQL route 入口。

## 实验性

- API Server GraphQL。
- API Server 任务式转换流程。
- MinerU VLM 模式。
- 部分 PDF 翻译 provider。
- 自动格式推断与 inference 相关能力。

## 待确认

- Lite / Standard / Full 的最终发布差异。
- 每个 converter 在 arm64 的通过情况。
- 旧文档中提到但当前路由未出现的 API。
- 部分 env 是否仍有效。
- Full 版注释中的额外依赖是否会在发布流程启用。

## 未来重构

API Server 应作为重点重构方向：

- 明确稳定 REST API surface。
- 决定 GraphQL 是否保留。
- 统一 engine registry 来源。
- 提供 OpenAPI schema 或明确不提供。
- 持久化 job store。
- 明确 Web UI backend 与 API Server 的职责边界。
- 避免对外文档承诺尚未实现的 route。
