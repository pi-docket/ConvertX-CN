# 测试指南

> 文件目的：说明 ConvertX-CN 的测试类型、命令、覆盖范围和常见失败原因。
> 适合读者：贡献者、维护者。
> 最后更新依据：`package.json`、`tests/`、`api-server/tests/`、`scripts/run-e2e-tests.sh`。
> 相关文件：[开发指南](development.md)、[引擎说明](engines.md)

## 目录

- [测试类型](#测试类型)
- [Web / TypeScript 测试](#web--typescript-测试)
- [Converter 测试](#converter-测试)
- [E2E 测试](#e2e-测试)
- [API Server 测试](#api-server-测试)
- [Docker 内测试](#docker-内测试)
- [新增测试资料](#新增测试资料)
- [常见失败原因](#常见失败原因)

## 测试类型

| 类型 | 路径 | 说明 |
|---|---|---|
| Converter tests | `tests/converters/` | 覆盖各转换器。 |
| Transfer tests | `tests/transfer/` | 分块上传、下载、transfer 行为。 |
| E2E tests | `tests/e2e/` | API、格式矩阵、翻译、综合流程。 |
| API Server tests | `api-server/tests/` | Rust API、GraphQL、integration tests。 |

## Web / TypeScript 测试

```bash
bun test
```

Lint：

```bash
bun run lint
```

Build：

```bash
bun run build
```

## Converter 测试

```bash
bun test tests/converters/
```

单个引擎：

```bash
bun test tests/converters/ffmpeg.test.ts
```

## E2E 测试

```bash
bun run test:e2e
bun run test:e2e:quick
bun run test:e2e:matrix
bun run test:e2e:translation
bun run test:e2e:comprehensive
```

测试 fixture 位于：

```text
tests/e2e/fixtures/
```

## API Server 测试

```bash
cd api-server
cargo test
```

测试文件：

- `api-server/tests/api_tests.rs`
- `api-server/tests/graphql_tests.rs`
- `api-server/tests/integration_tests.rs`

## Docker 内测试

建议在镜像构建后验证：

```bash
docker run --rm convertx-cn:local /app/scripts/verify-installation.sh
```

实际命令需以镜像内脚本路径和 entrypoint 行为为准。

## 新增测试资料

- 小文件优先，避免仓库膨胀。
- 尽量覆盖最小可验证输入。
- 对需要大型模型、外部 API、GPU 的测试应标为 e2e 或可跳过。

## 常见失败原因

- 宿主机没有安装 converter binary。
- Docker Lite 缺少某些引擎。
- OCR 语言包缺失。
- PDF 翻译需要网络、模型或 API key。
- arm64 binary 不可用。
- 测试超时或内存不足。
- API Server `JWT_SECRET` 未设置。
