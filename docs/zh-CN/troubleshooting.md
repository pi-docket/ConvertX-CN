# 错误排查

> 文件目的：整理常见问题、现象、原因与解决方式。
> 适合读者：所有使用者、部署者、维护者。
> 最后更新依据：`.env.example`、`compose.yaml`、`src/helpers/env.ts`、`src/pages/user.tsx`、`src/converters/`、`api-server/src/`。
> 相关文件：[部署指南](deployment.md)、[环境变量](configuration.md)、[安全说明](security.md)

## 目录

- [登录后跳回登录页](#登录后跳回登录页)
- [重启后全部登出](#重启后全部登出)
- [data 数据消失](#data-数据消失)
- [转换失败](#转换失败)
- [某个 engine 不存在](#某个-engine-不存在)
- [Lite 版缺少功能](#lite-版缺少功能)
- [API Server 无法启动](#api-server-无法启动)
- [JWT token 验证失败](#jwt-token-验证失败)
- [上传文件过大](#上传文件过大)
- [FFmpeg 硬件加速失败](#ffmpeg-硬件加速失败)
- [MinerU / VLM 失败](#mineru--vlm-失败)
- [OCR 语言包不足](#ocr-语言包不足)
- [ARM64 差异](#arm64-差异)
- [Windows volume 问题](#windows-volume-问题)
- [反向代理 HTTPS 问题](#反向代理-https-问题)

## 登录后跳回登录页

现象：登录成功后又回到登录页。

可能原因：HTTPS / Cookie 判断错误；反向代理未转发 `X-Forwarded-Proto`；`HTTP_ALLOWED` 或 `TRUST_PROXY` 设置不匹配。

解决方式：反向代理 HTTPS 部署时设置 `TRUST_PROXY=true`，生产环境保持 `HTTP_ALLOWED=false`；本地 HTTP 测试可设置 `HTTP_ALLOWED=true`。

相关环境变量：`HTTP_ALLOWED`、`TRUST_PROXY`、`WEBROOT`。

相关文件：[部署指南](deployment.md)、[环境变量](configuration.md)。

## 重启后全部登出

现象：容器重启后所有用户需要重新登录。

可能原因：未固定 `JWT_SECRET`，Web UI 使用随机 secret。

解决方式：在 `.env` 中设置固定 `JWT_SECRET`。

相关环境变量：`JWT_SECRET`。

## data 数据消失

现象：容器重建后历史记录、上传和输出消失。

可能原因：没有挂载 `./data:/app/data`。

解决方式：使用 bind mount 或 Docker volume 持久化 `/app/data`。

相关环境变量：无；相关路径：`data/`。

## 转换失败

现象：任务显示失败或输出为空。

可能原因：底层 binary 缺失、格式不兼容、输入文件损坏、内存不足、模型/API key 缺失。

解决方式：查看容器日志；确认使用的 Docker variant 支持该 engine；运行对应 converter 测试。

相关文件：[引擎说明](engines.md)、[测试指南](testing.md)。

## 某个 engine 不存在

现象：UI 或 API 找不到指定引擎。

可能原因：engine 未在 `src/converters/main.ts` 注册；API Server registry 与 Web UI 不同步；resvg 在 arm64 被禁用。

解决方式：检查 Web UI converter 清单和 API Server `engine.rs`；对 resvg 检查 `RESVG_DISABLED` 与 disabled-engines 文件。

## Lite 版缺少功能

现象：OCR、PDF 翻译、MinerU 或部分图片引擎不可用。

可能原因：Lite 镜像为了体积省略部分依赖。

解决方式：改用 Standard 或 Full；或自行构建包含所需依赖的镜像。

## API Server 无法启动

现象：`convertx-api` 容器退出。

可能原因：API Server 未获得 `JWT_SECRET`；`.env.api` 中只设置了 `API_JWT_SECRET` 但未通过 compose 映射。

解决方式：使用 `compose.yaml` 的 profile 启动，并确保 `JWT_SECRET` 最终传给 API Server。

相关环境变量：`JWT_SECRET`、`API_JWT_SECRET`、`RAS_API_PORT`。

## JWT token 验证失败

现象：API 返回 `INVALID_TOKEN`、`TOKEN_EXPIRED` 或 `MISSING_AUTH_HEADER`。

可能原因：缺少 `Authorization: Bearer`、secret 不一致、token 过期、签名算法不匹配。

解决方式：使用 HS256、正确 secret、包含 `exp` 的 token。

## 上传文件过大

现象：API 返回 `FILE_TOO_LARGE` 或上传失败。

可能原因：API Server `MAX_FILE_SIZE` 限制；反向代理限制；Web UI 上传限制待确认。

解决方式：调整 API Server `MAX_FILE_SIZE` 和反向代理 body size。

## FFmpeg 硬件加速失败

现象：FFmpeg 转换失败或提示硬件设备不可用。

可能原因：宿主机没有 GPU runtime、容器未挂载设备、参数不匹配。

解决方式：先去掉 `FFMPEG_ARGS` 和 `FFMPEG_OUTPUT_ARGS` 验证软件转换，再逐步加入硬件参数。

## MinerU / VLM 失败

现象：PDF 到 Markdown 失败、VLM server 连接失败或模型不存在。

可能原因：模型缺失、`MINERU_BACKEND` 设置不当、`MINERU_VLM_URL` 不可达、架构不支持。

解决方式：先使用 `pipeline`，确认模型目录和 `mineru.json`，再启用 VLM。

## OCR 语言包不足

现象：OCR 结果缺字或提示语言包不存在。

可能原因：Tesseract 未安装目标语言包。

解决方式：使用包含对应语言包的镜像或自行扩展镜像。

相关环境变量：`OCR_LANG`。

## ARM64 差异

现象：某些 binary 不存在或引擎被禁用。

可能原因：上游未提供 arm64 预编译包或构建失败。

解决方式：查看 Docker 构建日志和 disabled-engines；对 resvg 特别检查。

## Windows volume 问题

现象：路径挂载失败或权限异常。

可能原因：Windows 路径格式、共享目录权限、Docker Desktop 文件共享配置。

解决方式：使用绝对路径或 WSL 路径，确认 Docker 有访问权限。

## 反向代理 HTTPS 问题

现象：资源路径错误、登录异常、下载链接错误。

可能原因：`WEBROOT`、proxy path rewrite、`TRUST_PROXY` 不一致。

解决方式：同步配置 `WEBROOT` 与代理规则，并转发 `X-Forwarded-*`。
