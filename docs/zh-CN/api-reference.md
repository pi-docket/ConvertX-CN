# API Reference

> 文件目的：记录当前 API Server 实际实现的 API 路由、认证、请求与响应。
> 适合读者：接入 API 的开发者。
> 最后更新依据：`api-server/src/main.rs`、`api-server/src/handlers.rs`、`api-server/src/models.rs`、`api-server/src/error.rs`、`api-server/src/auth.rs`。
> 相关文件：[API Server](api-server.md)、[环境变量](configuration.md)

## 目录

- [Base URL](#base-url)
- [认证](#认证)
- [响应格式](#响应格式)
- [Health Check](#health-check)
- [Engines API](#engines-api)
- [Convert API](#convert-api)
- [Job API](#job-api)
- [Error Response](#error-response)
- [示例](#示例)
- [当前限制](#当前限制)
- [未确认路由](#未确认路由)

## Base URL

默认：

```text
http://localhost:7890
```

Compose API profile 默认映射：

```yaml
ports:
  - "7890:7890"
```

## 认证

除 health 和 `/graphql` 入口外，当前 `/api/v1/*` REST route 需要：

```http
Authorization: Bearer <jwt>
```

JWT 使用 HS256 与 `JWT_SECRET` 验证。

## 响应格式

成功响应：

```json
{
  "success": true,
  "data": {},
  "error": null
}
```

错误响应由 `ApiError` 直接返回：

```json
{
  "error": "INVALID_INPUT",
  "code": "INVALID_INPUT",
  "message": "..."
}
```

## Health Check

```http
GET /api/health
GET /health
```

响应：

```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "version": "2.0.2",
    "backend_status": "healthy"
  },
  "error": null
}
```

## Engines API

```http
GET /api/v1/engines
Authorization: Bearer <jwt>
```

```http
GET /api/v1/engines/{engine_id}
Authorization: Bearer <jwt>
```

Engine response 字段：

- `engine_id`
- `engine_name`
- `description`
- `enabled`
- `input_formats`
- `output_formats`
- `max_file_size_mb`
- `requires_params`

## Convert API

```http
POST /api/v1/convert
Authorization: Bearer <jwt>
Content-Type: multipart/form-data
```

Multipart fields：

| Field | 类型 | 必填 | 说明 |
|---|---|---|---|
| `file` | file | 是 | 上传文件。 |
| `params` 或 `options` | JSON string | 是 | 转换参数。 |

`params` JSON：

```json
{
  "output_format": "pdf",
  "engine_id": "libreoffice",
  "options": {}
}
```

响应：

```json
{
  "success": true,
  "data": {
    "job_id": "...",
    "status": "pending",
    "message": "Conversion job created"
  },
  "error": null
}
```

## Job API

查询状态：

```http
GET /api/v1/jobs/{job_id}
Authorization: Bearer <jwt>
```

下载结果：

```http
GET /api/v1/jobs/{job_id}/download
Authorization: Bearer <jwt>
```

下载返回 `application/zip`。

## Error Response

| Code | HTTP | 说明 |
|---|---:|---|
| `UNAUTHORIZED` | 401 | 未授权。 |
| `INVALID_TOKEN` | 401 | Token 无效。 |
| `TOKEN_EXPIRED` | 401 | Token 过期。 |
| `MISSING_AUTH_HEADER` | 401 | 缺少 Authorization header。 |
| `FORBIDDEN` | 403 | 权限不足。 |
| `ENGINE_NOT_FOUND` | 404 | 引擎不存在。 |
| `UNSUPPORTED_CONVERSION` | 400 | 不支持的转换。 |
| `FILE_TOO_LARGE` | 413 | 上传文件过大。 |
| `JOB_NOT_FOUND` | 404 | Job 不存在。 |
| `JOB_NOT_READY` | 400 | Job 未完成。 |
| `INVALID_INPUT` | 400 | 请求参数错误。 |
| `INTERNAL_ERROR` | 500 | 内部错误。 |
| `BACKEND_ERROR` | 502 | Web UI backend 调用失败。 |

## 示例

cURL health：

```bash
curl http://localhost:7890/api/health
```

cURL convert：

```bash
curl -X POST http://localhost:7890/api/v1/convert \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@sample.docx" \
  -F 'params={"output_format":"pdf","engine_id":"libreoffice"}'
```

JavaScript：

```js
const form = new FormData();
form.append("file", file);
form.append("params", JSON.stringify({ output_format: "pdf", engine_id: "libreoffice" }));

const response = await fetch("http://localhost:7890/api/v1/convert", {
  method: "POST",
  headers: { Authorization: `Bearer ${token}` },
  body: form,
});
```

Python：

```python
import requests

with open("sample.docx", "rb") as f:
    r = requests.post(
        "http://localhost:7890/api/v1/convert",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": f},
        data={"params": '{"output_format":"pdf","engine_id":"libreoffice"}'},
    )
print(r.json())
```

## 当前限制

- Job metadata 存在内存中，重启丢失。
- 当前 API Server 不签发 JWT，只验证调用方提供的 JWT。
- 转换实际代理到 Web UI `/api/convert`。
- GraphQL route 存在，但应视为实验性。

## 未确认路由

以下路由在旧文档中可能出现，但当前 `api-server/src/main.rs` 未确认：

- `GET /api/v1/health`
- `GET /api/v1/formats`
- `POST /api/v1/validate`
- `POST /api/v1/jobs`
- `GET /api/v1/jobs`
- `DELETE /api/v1/jobs/{job_id}`
- `/swagger-ui`
