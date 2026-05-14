# 环境变量

> 文件目的：集中说明 Web UI、API Server、Docker Compose 与 Docker variant 的环境变量。
> 适合读者：部署者、维护者、开发者。
> 最后更新依据：`.env.example`、`compose.yaml`、`src/helpers/env.ts`、`src/helpers/startupStatus.ts`、`src/pages/user.tsx`、`src/converters/*.ts`、`api-server/src/config.rs`、`api-server/.env.example`、`api-server/.env.api.example`。
> 相关文件：[部署指南](deployment.md)、[安全说明](security.md)、[API Server](api-server.md)

## 目录

- [使用规则](#使用规则)
- [必填设置](#必填设置)
- [Web UI 设置](#web-ui-设置)
- [安全设置](#安全设置)
- [转换设置](#转换设置)
- [引擎设置](#引擎设置)
- [API Server 设置](#api-server-设置)
- [Docker 设置差异](#docker-设置差异)
- [待确认或可能已废弃](#待确认或可能已废弃)

## 使用规则

- 生产环境必须显式设置 `JWT_SECRET`。
- Web UI 使用 Node/Bun 的 `process.env`。
- API Server 使用 Rust `std::env::var`。
- 示例文件中出现但代码未读取的变量，必须标注「待确认」。

## 必填设置

| 变量 | 必填 | 默认值 | 示例 | 影响功能 | 适用服务 | 来源文件 | 注意事项 |
|---|---|---|---|---|---|---|---|
| `JWT_SECRET` | 生产必填 | Web UI 未设置时会随机生成；API Server 必填 | `openssl rand -hex 32` | 登录 Cookie、JWT 验证 | Web UI / API Server | `src/pages/user.tsx`、`api-server/src/config.rs` | Web UI 不固定会导致重启后登录失效；API Server 未设置会启动失败。 |

## Web UI 设置

| 变量 | 必填 | 默认值 | 示例 | 影响功能 | 适用服务 | 来源文件 | 注意事项 |
|---|---|---|---|---|---|---|---|
| `PORT` | 否 | `3000` | `3000` | Web 监听端口 | Web UI | `src/helpers/startupStatus.ts` | Compose 默认映射 `3000:3000`。 |
| `WEBROOT` | 否 | 空 | `/convertx` | 子路径部署 | Web UI | `src/helpers/env.ts`、`src/index.tsx` | 代理层也要同步配置。 |
| `LANGUAGE` | 否 | `en` env 默认；i18n 默认 `zh-CN` | `zh-CN` | 默认语言 | Web UI | `src/helpers/env.ts`、`src/i18n/index.ts` | 默认值存在代码差异，实际显示需结合页面逻辑确认。 |
| `TZ` | 否 | 容器默认时区 | `Asia/Shanghai` | 时间显示与日志 | Web UI / Docker | `src/helpers/env.ts`、`compose.yaml` | 建议生产显式设置。 |
| `SHOW_SERVICE_STATUS` | 否 | production 自动显示 | `true` | 启动状态输出 | Web UI | `src/index.tsx` | 仅影响启动日志。 |

## 安全设置

| 变量 | 必填 | 默认值 | 示例 | 影响功能 | 适用服务 | 来源文件 | 注意事项 |
|---|---|---|---|---|---|---|---|
| `HTTP_ALLOWED` | 否 | `false` | `true` | 是否允许 HTTP | Web UI | `src/helpers/env.ts` | 本地测试可开，生产建议使用 HTTPS。 |
| `TRUST_PROXY` | 否 | `false` | `true` | 信任 `X-Forwarded-*` | Web UI | `src/helpers/env.ts` | 反向代理 HTTPS 常需要开启。 |
| `ACCOUNT_REGISTRATION` | 否 | `true` | `false` | 是否允许注册 | Web UI | `src/helpers/env.ts` | 公开部署建议关闭。 |
| `ALLOW_UNAUTHENTICATED` | 否 | `false` | `true` | 是否允许未登录使用 | Web UI | `src/helpers/env.ts` | 公开部署高风险。 |
| `UNAUTHENTICATED_USER_SHARING` | 否 | `false` | `true` | 未认证用户共享行为 | Web UI | `src/helpers/env.ts` | 具体行为需按页面流程确认。 |
| `CONVERTX_WORKER_URL` | 否 | 内置值 | URL | 加密 key provider | Web UI | `src/security/keyProvider.ts` | 待确认使用场景。 |
| `CONVERTX_ENCRYPTION_KEY` | 否 | 内置值 | hex key | 加密 key provider | Web UI | `src/security/keyProvider.ts` | 待确认使用场景。 |

## 转换设置

| 变量 | 必填 | 默认值 | 示例 | 影响功能 | 适用服务 | 来源文件 | 注意事项 |
|---|---|---|---|---|---|---|---|
| `AUTO_DELETE_EVERY_N_HOURS` | 否 | `24` | `12` | 自动清理旧 job | Web UI | `src/helpers/env.ts`、`src/index.tsx` | `0` 表示关闭清理。 |
| `MAX_CONVERT_PROCESS` | 否 | `0` | `4` | 并发转换 chunk 大小 | Web UI | `src/helpers/env.ts`、`src/converters/main.ts` | `0` 在代码中表示不分 chunk。 |
| `HIDE_HISTORY` | 否 | `false` | `true` | 隐藏历史 | Web UI | `src/helpers/env.ts` | 页面行为需结合 `src/pages/history.tsx`。 |
| `HTTP_ALLOWED_FILE_SIZE` | 否 | 待确认 | `524288000` | 上传大小 | Web UI | `.env.example` | 目前未在 `src` env 搜索中确认读取。 |

## 引擎设置

| 变量 | 必填 | 默认值 | 示例 | 影响功能 | 适用服务 | 来源文件 | 注意事项 |
|---|---|---|---|---|---|---|---|
| `FFMPEG_ARGS` | 否 | 空 | `-hwaccel cuda` | FFmpeg 输入参数 | Web UI | `src/converters/ffmpeg.ts` | 参数以空白切分。 |
| `FFMPEG_OUTPUT_ARGS` | 否 | 空 | `-c:v h264_nvenc` | FFmpeg 输出参数 | Web UI | `src/converters/ffmpeg.ts` | 依赖宿主机与镜像支持。 |
| `IMAGEMAGICK_COMMAND` | 否 | `magick` | `convert` | ImageMagick 命令 | Web UI | `src/converters/imagemagick.ts` | 用于兼容不同安装方式。 |
| `OCR_LANG` | 否 | `eng+chi_tra+chi_sim+jpn` | `eng+chi_sim` | OCR 语言 | Web UI | `src/helpers/pdfOcr.ts` | 需要容器内有对应 Tesseract 语言包。 |
| `PDFMATHTRANSLATE_SERVICE` | 否 | 代码内默认服务 | `google` | PDFMathTranslate 服务 | Web UI | `src/converters/pdfmathtranslate.ts` | 可用服务需实测。 |
| `PDFMATHTRANSLATE_MODELS_PATH` | 否 | 待确认 | `/models` | PDF 翻译模型路径 | 待确认 | `.env.example` | 未在 env 搜索中确认读取。 |
| `MINERU_MODE` | 否 | `pipeline` | `vlm` | MinerU 模式 | Web UI | `src/helpers/env.ts` | `MINERU_BACKEND` 包含 `vlm` 时也会切到 VLM。 |
| `MINERU_BACKEND` | 否 | Dockerfile 中为 `pipeline` | `pipeline` | MinerU backend | Web UI / Docker | `src/helpers/env.ts`、`src/converters/mineru.ts`、`Dockerfile` | VLM 支持需按镜像确认。 |
| `MINERU_VLM_URL` | 否 | helper 默认 | URL | VLM server 地址 | Web UI | `src/converters/mineru.ts` | 待确认外部服务要求。 |
| `MINERU_CONFIG` | 否 | Dockerfile 设置 | `/root/mineru.json` | MinerU 配置 | Docker / MinerU | `Dockerfile` | 实际由外部工具读取。 |
| `MINERU_MODELS_DIR` | 否 | Dockerfile 设置 | `/opt/convertx/models/mineru` | MinerU 模型目录 | Docker / MinerU | `Dockerfile` | 模型是否完整需验证。 |
| `BABELDOC_ENGINE` | 否 | `siliconflow` | `openai` | BabelDOC 翻译引擎 | Web UI | `src/helpers/env.ts`、`src/converters/babeldoc.ts` | 代码当前支持情况需以 converter 为准。 |
| `BABELDOC_CACHE_PATH` | 否 | `/root/.cache/babeldoc` | `/cache/babeldoc` | BabelDOC cache | Web UI / Docker | `src/converters/babeldoc.ts`、`pdfmathtranslate.ts`、`Dockerfile` | 影响模型、字体、缓存。 |
| `OPENAI_API_KEY` | 否 | 空 | `sk-...` | OpenAI 翻译 | Web UI | `src/helpers/env.ts`、`src/helpers/apiKeys.ts` | 仅在相应引擎模式下需要。 |
| `DEEPSEEK_API_KEY` | 否 | 空 | `sk-...` | DeepSeek 翻译 | Web UI | `src/helpers/env.ts`、`src/helpers/apiKeys.ts` | 仅在相应引擎模式下需要。 |
| `OTHER_LLM_API_KEY` | 否 | 空 | `token` | Custom LLM | Web UI | `src/helpers/env.ts`、`src/helpers/apiKeys.ts` | 与 `CUSTOM_LLM_BASE_URL` 配合。 |
| `CUSTOM_LLM_BASE_URL` | 否 | 空 | `https://api.example.com/v1` | Custom LLM endpoint | Web UI | `src/helpers/env.ts` | 与 `OTHER_LLM_API_KEY` 配合。 |
| `RESVG_DISABLED` | 否 | 未禁用 | `1` | 禁用 resvg | Web UI | `src/converters/resvg.ts` | arm64 构建失败也会通过 disabled-engines 文件禁用。 |
| `PDF_SIGN_P12_PATH` | 否 | `/app/certs/default.p12` | `/app/certs/sign.p12` | PDF Packager 签名 | Web UI | `src/converters/pdfpackager.ts` | 证书不存在时非 test 环境可能失败。 |
| `PDF_SIGN_SCRIPT_PATH` | 否 | `/app/scripts/pdf_sign.py` | `/app/scripts/pdf_sign.py` | PDF 签名脚本 | Web UI | `src/converters/pdfpackager.ts` | 依赖 Python 签名脚本。 |

## API Server 设置

| 变量 | 必填 | 默认值 | 示例 | 影响功能 | 适用服务 | 来源文件 | 注意事项 |
|---|---|---|---|---|---|---|---|
| `RAS_API_PORT` | 否 | `7890` | `7890` | API Server 端口 | API Server / Web UI status | `api-server/src/config.rs`、`src/helpers/startupStatus.ts` | API Server 实际读取此变量。 |
| `RAS_API_HOST` | 否 | `0.0.0.0` 示例 | `0.0.0.0` | API host | Web UI status / compose | `src/helpers/startupStatus.ts`、`compose.yaml` | API Server 当前 bind hardcoded 为 `0.0.0.0`，待确认。 |
| `CONVERTX_BACKEND_URL` | 否 | `http://convertx:3000` | `http://convertx:3000` | Web UI backend | API Server | `api-server/src/config.rs` | API Server 用它调用 `/api/health` 和 `/api/convert`。 |
| `UPLOAD_DIR` | 否 | `./data/uploads` | `/app/data/api-uploads` | API 上传目录 | API Server | `api-server/src/config.rs` | API Server 独立使用。 |
| `OUTPUT_DIR` | 否 | `./data/output` | `/app/data/api-output` | API 输出目录 | API Server | `api-server/src/config.rs` | API Server 独立使用。 |
| `MAX_FILE_SIZE` | 否 | `524288000` | `104857600` | API 上传大小限制 | API Server | `api-server/src/config.rs` | bytes。 |
| `RUST_LOG` | 否 | 运行时默认 | `convertx_api=info,tower_http=info` | Rust 日志 | API Server | `.env.api.example` | 具体模块名需确认。 |
| `API_JWT_SECRET` | 否 | 无 | secret | compose 映射来源 | Docker Compose | `compose.yaml`、`api-server/.env.api.example` | Rust 代码不直接读取，compose 映射为 `JWT_SECRET`。 |

## Docker 设置差异

- `Dockerfile` 设置 MinerU、BabelDOC、模型路径、禁止 pip 安装等运行环境。
- `Dockerfile.lite` 安装较少工具，部分引擎不可用或待确认。
- `Dockerfile.full` 当前多处扩展依赖为注释，实际 Full 发布能力需复核。

## 待确认或可能已废弃

| 变量 | 状态 | 原因 |
|---|---|---|
| `DATA_DIR` | 待确认 | 示例中出现，但 `src/db/db.ts` 当前使用 `./data/mydb.sqlite`。 |
| `HTTP_ALLOWED_FILE_SIZE` | 待确认 | 示例中出现，未在 env 搜索中确认读取。 |
| `PDFMATHTRANSLATE_MODELS_PATH` | 待确认 | 示例中出现，未确认代码读取。 |
| `ENABLE_SWAGGER` | 可能已废弃 | API env example 中出现，但当前未看到 Swagger route。 |
| `JWT_EXPIRATION_SECS` | 可能已废弃 | API Server 当前只验证外部 JWT，不签发 token。 |
| `ENABLE_RAS_API` | 待确认 | Web UI status helper 会读取，但 compose 使用 profile 控制 API Server。 |
