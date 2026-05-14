# 安全说明

> 文件目的：说明 ConvertX-CN 私有或公开部署时的安全注意事项。
> 适合读者：部署者、维护者。
> 最后更新依据：`.env.example`、`src/helpers/env.ts`、`src/pages/user.tsx`、`api-server/src/auth.rs`、`compose.yaml`。
> 相关文件：[部署指南](deployment.md)、[环境变量](configuration.md)、[API Server](api-server.md)

## 目录

- [JWT_SECRET](#jwt_secret)
- [公开服务风险](#公开服务风险)
- [未认证访问](#未认证访问)
- [注册策略](#注册策略)
- [上传大小与自动删除](#上传大小与自动删除)
- [API Server JWT 与 Scope](#api-server-jwt-与-scope)
- [HTTPS 与反向代理](#https-与反向代理)
- [敏感文件](#敏感文件)
- [data 目录](#data-目录)
- [Docker 权限](#docker-权限)
- [AGPL 授权](#agpl-授权)

## JWT_SECRET

生产环境必须设置固定、随机、足够长的 `JWT_SECRET`。建议至少 32 字节随机值。

```bash
openssl rand -hex 32
```

未固定 `JWT_SECRET` 会导致 Web UI 重启后旧 session 全部失效。API Server 未设置 `JWT_SECRET` 会启动失败。

## 公开服务风险

ConvertX-CN 会处理用户上传文件并调用大量外部转换工具。公开到公网时，必须考虑：

- 滥用上传和转换资源。
- 恶意文件触发底层工具漏洞。
- 敏感文件泄漏。
- 磁盘被填满。

## 未认证访问

`ALLOW_UNAUTHENTICATED=true` 会允许未登录使用，公开环境不建议开启。

## 注册策略

公开部署建议：

```env
ACCOUNT_REGISTRATION=false
```

只保留管理员创建或预置用户的方式。

## 上传大小与自动删除

- API Server 使用 `MAX_FILE_SIZE` 限制上传。
- Web UI 上传大小变量 `HTTP_ALLOWED_FILE_SIZE` 目前待确认。
- `AUTO_DELETE_EVERY_N_HOURS` 控制旧 job 自动删除。

## API Server JWT 与 Scope

API Server 验证 JWT Bearer token。`scope` 为空时当前代码视为允许；如果需要严格权限，签发 token 时应明确设置 scope。

推荐 scope：

- `convert`
- `download`
- `read`
- `list_engines`

## HTTPS 与反向代理

生产环境应使用 HTTPS。反向代理部署时设置：

```env
TRUST_PROXY=true
HTTP_ALLOWED=false
```

并转发 `X-Forwarded-Proto`。

## 敏感文件

不要把敏感文件上传到不受信任的公开实例。管理员应明确告知用户文件保存位置、清理策略和备份策略。

## data 目录

`data` 目录包含：

- 上传文件
- 输出文件
- SQLite 数据库
- API Server 上传和输出目录

应限制文件系统权限并定期备份。

## Docker 权限

避免以过高权限运行容器。若使用 GPU、硬件加速或额外设备挂载，只开放必要设备。

## AGPL 授权

ConvertX-CN 使用 AGPL-3.0。网络服务分发和修改版本的合规义务需自行确认。
