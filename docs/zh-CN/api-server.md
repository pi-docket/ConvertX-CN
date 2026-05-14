# API Server

> 文件目的：说明 ConvertX-CN API Server 的定位、当前实现、限制与未来重构方向。
> 适合读者：API 使用者、开发者、维护者。
> 最后更新依据：`api-server/src/main.rs`、`api-server/src/config.rs`、`api-server/src/auth.rs`、`api-server/src/handlers.rs`、`api-server/src/models.rs`、`api-server/Cargo.toml`、`compose.yaml`。
> 相关文件：[API Reference](api-reference.md)、[部署指南](deployment.md)、[Roadmap](roadmap.md)

## 目录

- [定位](#定位)
- [目前实作](#目前实作)
- [目前可用但不稳定](#目前可用但不稳定)
- [与 Web UI 的关系](#与-web-ui-的关系)
- [JWT 与权限](#jwt-与权限)
- [文件存储](#文件存储)
- [未来重构方向](#未来重构方向)
- [旧文件差异](#旧文件差异)

## 定位

API Server 是可选服务，不影响 ConvertX-CN Web UI 的基本使用。它位于 `api-server/`，使用 Rust 实作，目标是提供面向程序调用的 REST API 与任务式转换流程。

## 目前实作

- Web 框架：Axum。
- Runtime：Tokio。
- GraphQL：`async-graphql` 依赖存在，`/graphql` route 当前会初始化。
- 认证：JWT Bearer Token。
- 转换：接收 multipart 上传，创建内存 job，然后代理到 Web UI backend 的 `/api/convert`。
- 健康检查：检查自身和 backend `/api/health`。

当前 REST 路由：

| 方法 | 路由 | 认证 | 说明 |
|---|---|---|---|
| GET | `/api/health` | 否 | API Server health。 |
| GET | `/health` | 否 | health alias。 |
| GET | `/api/v1/engines` | 是 | 列出 API Server registry 中的 engines。 |
| GET | `/api/v1/engines/{engine_id}` | 是 | 获取单个 engine。 |
| POST | `/api/v1/convert` | 是 | 上传文件并创建转换 job。 |
| GET | `/api/v1/jobs/{job_id}` | 是 | 查询 job 状态。 |
| GET | `/api/v1/jobs/{job_id}/download` | 是 | 下载完成结果 zip。 |
| GET/POST | `/graphql` | 否 / schema 内部处理 | GraphQL Playground 与 handler。 |

## 目前可用但不稳定

- GraphQL 入口存在，但应视为实验性。
- Engine registry 在 `api-server/src/engine.rs` 中硬编码，可能与 Web UI `src/converters/main.ts` 不完全同步。
- Job store 是内存 HashMap，API Server 重启后 job 消失。
- 转换请求代理到 Web UI `/api/convert`，不是完全独立转换服务。

## 与 Web UI 的关系

API Server 依赖 `CONVERTX_BACKEND_URL` 指向 Web UI backend。默认值：

```env
CONVERTX_BACKEND_URL=http://convertx:3000
```

API Server 会调用：

- `${CONVERTX_BACKEND_URL}/api/health`
- `${CONVERTX_BACKEND_URL}/api/convert`

## JWT 与权限

JWT Claims：

| Claim | 类型 | 必填 | 说明 |
|---|---|---|---|
| `sub` | string | 是 | 用户 ID。 |
| `email` | string | 否 | 用户 email。 |
| `scope` | string[] | 否 | 权限范围。空 scope 当前视为允许。 |
| `iat` | number | 是 | 签发时间。 |
| `exp` | number | 是 | 过期时间。 |

Scope：

| Scope | 说明 |
|---|---|
| `convert` | 允许创建转换任务。 |
| `download` | 允许下载结果。 |
| `read` | 读取类权限。 |
| `list_engines` | 列出 engines。 |
| `*` | 全部权限。 |

## 文件存储

API Server 使用：

- `UPLOAD_DIR`：上传文件目录。
- `OUTPUT_DIR`：输出文件目录。

这些目录独立于 Web UI 的 job 数据库。API Server job metadata 当前存储在内存中。

## 未来重构方向

- API route 稳定化与版本策略。
- OpenAPI / Swagger 是否重新引入。
- GraphQL 是否保留或标为实验性。
- Engine registry 改为从 Web UI converter metadata 或共享 schema 生成。
- Job store 持久化。
- 上传、转换、下载流程与 Web UI 后端接口统一。

## 旧文件差异

旧文件或 compose 注释可能提到以下内容，但当前代码未确认：

- `GET /api/v1/health`
- `GET /api/v1/formats`
- `POST /api/v1/validate`
- `POST /api/v1/jobs`
- `GET /api/v1/jobs`
- `DELETE /api/v1/jobs/{job_id}`
- Swagger UI `/swagger-ui`

这些内容在文档中只能标注为「旧文件提及，但目前程式码未确认」。
