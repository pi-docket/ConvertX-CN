# 开发指南

> 文件目的：说明本地开发、项目结构、常用命令、添加 converter/API/env/i18n 的流程。
> 适合读者：贡献者、维护者。
> 最后更新依据：`package.json`、`api-server/Cargo.toml`、`src/`、`tests/`、`Dockerfile*`。
> 相关文件：[架构说明](architecture.md)、[测试指南](testing.md)、[格式矩阵](format-matrix.md)

## 目录

- [技术栈](#技术栈)
- [项目结构](#项目结构)
- [常用命令](#常用命令)
- [新增 converter](#新增-converter)
- [新增格式](#新增格式)
- [新增环境变量](#新增环境变量)
- [更新 i18n](#更新-i18n)
- [新增 API endpoint](#新增-api-endpoint)
- [Docker image 构建](#docker-image-构建)
- [Release / Changelog](#release--changelog)

## 技术栈

- Bun
- TypeScript
- Elysia
- Kita HTML JSX
- TailwindCSS
- Bun SQLite
- Rust
- Axum
- Tokio
- async-graphql

## 项目结构

| 路径 | 说明 |
|---|---|
| `src/index.tsx` | Web Server 入口。 |
| `src/pages/` | 页面和 API route。 |
| `src/converters/` | 转换器实现。 |
| `src/db/` | SQLite 初始化和类型。 |
| `src/helpers/` | env、OCR、启动状态、内存生命周期等 helper。 |
| `src/i18n/`、`src/locales/` | 多语言 UI。 |
| `src/transfer/` | 分块上传、下载、打包治理。 |
| `api-server/` | Rust API Server。 |
| `tests/` | Web/converter/e2e tests。 |
| `scripts/` | Docker 构建、模型、验证与运行脚本。 |

## 常用命令

Web：

```bash
bun run dev
bun run hot
bun run build
bun run lint
bun run format
bun test
bun run test:e2e
bun run test:e2e:quick
bun run test:e2e:matrix
bun run test:e2e:translation
bun run test:e2e:comprehensive
```

API Server：

```bash
cd api-server
cargo build
cargo test
cargo run
```

## 新增 converter

1. 新增 `src/converters/<engine>.ts`。
2. export `properties`，包含 `from` 与 `to`。
3. export `convert(...)`。
4. 在 `src/converters/main.ts` import 并注册。
5. 新增 `tests/converters/<engine>.test.ts`。
6. 更新 Dockerfile required binary 或 Python package。
7. 更新 [引擎说明](engines.md) 与 [格式矩阵](format-matrix.md)。

## 新增格式

- 更新对应 converter 的 `properties.from` 或 `properties.to`。
- 补测试 fixture 或 converter 测试。
- 更新格式矩阵。
- 若底层工具只在某些 Docker variant 可用，标注版本差异。

## 新增环境变量

1. 在代码中读取 env。
2. 加到 `.env.example`。
3. 如果 API Server 使用，更新 `api-server/.env.example` 或 `.env.api.example`。
4. 如果 Compose 使用，更新 `compose.yaml`。
5. 更新 [环境变量](configuration.md)。
6. 为默认值和异常情况补测试或验证脚本。

## 更新 i18n

- UI 翻译文件在 `src/locales/`。
- Locale 注册在 `src/i18n/index.ts`。
- 新增 key 时应先更新 `en.json` 与 `zh-CN.json`，再补其他语言。
- 文档翻译规则见 [i18n 文档维护指南](i18n-docs-guide.md)。

## 新增 API endpoint

1. 修改 `api-server/src/main.rs` route。
2. 新增或修改 `handlers.rs`。
3. 更新 request/response model。
4. 更新 error mapping。
5. 新增 `api-server/tests/`。
6. 更新 [API Reference](api-reference.md)。
7. 如果接口不稳定，先放入 [Roadmap](roadmap.md)。

## Docker image 构建

```bash
docker build -f Dockerfile -t convertx-cn:local .
docker build -f Dockerfile.lite -t convertx-cn:lite-local .
docker build -f Dockerfile.full -t convertx-cn:full-local .
```

构建后应运行 `scripts/verify-installation.sh` 或等效验证。

## Release / Changelog

- 版本变化记录在 `CHANGELOG.md`。
- 文档更新应同步 [changelog-guide.md](changelog-guide.md)。
- 影响 API、env、Docker variant 或格式支持的变更必须在文档中标注。
