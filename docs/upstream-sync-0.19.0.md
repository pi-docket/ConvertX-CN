# 上游 0.19.0 选择性同步记录

上游：C4illin/ConvertX，main，最新发布 v0.19.0。
审查范围：`0d201261c82508a78beb09bc1be913ce19a7b739` → `49d1db8dd06134f4423d5c1a447cce9c920156bc`，共 50 个提交。
应用 package.json 与 Docker 标签版本对齐 0.19.0。机器可读记录位于根目录 `upstream-sync.json`。

这是按功能移植后的最新审查快照，不是逐字相同的上游镜像，也不伪造 Git merge ancestry。保留中文、多语言、Lite、Rust API、持久化 JWT、CSRF、schema v5、job/artifact 隔离和 TRA 输出治理。

此次分支同时包含 PR #89 的 E2E 修复；这些修复与 upstream ImageMagick 改动一起保留。

## 判断依据

- 采纳能增加功能、修复错误或关闭安全缺口的改动，例如自定义品牌、EXIF 方向、recipe 禁用和生产依赖安全更新。
- 上游同类修复已移植时保留本地等效实现；不重复覆盖本地安全边界。
- 旧 schema／调度器或多输出目录扫描不直接覆盖现有架构。
- Bun 1.4.2、ESLint 10、Tailwind 4.3 等工具大版本及发布 Action 升级暂缓；这是兼容性范围选择，不代表这些上游版本质量差。
- 自动改写 PR 的服务与可变 main 引用的标签 Action 不引入。运行时继续固定 Bun 1.3.6，CI 读取同一版本文件并使用 frozen lockfile。
- 未来同步以 reviewedCommit 为审查起点，不能用 Git merge-base 推断这些选择性移植是否已完成。

## 逐项审查

| 上游提交  | 更新                                                                                                | 决定           | 原因                                                                                       |
| --------- | --------------------------------------------------------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------ |
| `49d1db8` | chore: allow bun in renovate again (#662)                                                           | 跳过／暂缓     | 暂缓解除 Bun 自动更新限制；运行时继续固定并经单独验证后升级                                |
| `8d4899c` | chore(deps): lock file maintenance (#661)                                                           | 选择性更新     | 生产依赖按上游最新清单更新并重建本地锁定文件；开发工具大版本保留                           |
| `710bc7c` | chore: prepare for release                                                                          | 本次合入       | 应用版本对齐 0.19.0                                                                        |
| `163b1b5` | fix: markitdown filestypes and version printing (#657)                                              | 已有／本地适配 | MarkItDown 类型与版本检测已移植                                                            |
| `d5f3887` | chore: bump packages (#658)                                                                         | 选择性更新     | 生产依赖按上游最新清单更新并重建本地锁定文件；开发工具大版本保留                           |
| `4f0aa1b` | fix: allow PUID and PGID to be unset (#656)                                                         | 已有／本地适配 | 本地空 PUID/PGID 使用非 root 默认，行为已覆盖测试                                          |
| `cc3d256` | docs: clear warning for only allowing users you trust                                               | 已有／本地适配 | 加入可信用户/关闭公开注册说明；保留本地密钥持久化文档                                      |
| `4750fdf` | feature: support PUID/PGID to change user (#655)                                                    | 已有／本地适配 | 已有 non-root UID 10001、PUID/PGID 验证及数据卷初始化，不替换为可回退 root 的上游入口      |
| `aac8dd6` | fix(imagemagick): handle multi-page PDF outputs and improve rasterization quality (#593)            | 已有／本地适配 | PDF 300 DPI 已有；保留本地 TRA/任务隔离多输出治理，不采用共享目录扫描；含 E2E 首页参数修复 |
| `6fdd24c` | fix(deps): update dependency elysia to v1.4.30 (#651)                                               | 选择性更新     | 生产依赖按上游最新清单更新并重建本地锁定文件；开发工具大版本保留                           |
| `75feea0` | feat: add custom branding (#575)                                                                    | 本次合入       | BRANDING 安全转义并保留中文默认名称                                                        |
| `0ca17da` | Merge commit from fork                                                                              | 本次合入       | 禁止 recipe／downloaded_recipe 文件与类型                                                  |
| `3b37849` | chore(deps): lock file maintenance (#649)                                                           | 选择性更新     | 生产依赖按上游最新清单更新并重建本地锁定文件；开发工具大版本保留                           |
| `8f72f08` | fix(deps): update dependency elysia to v1.4.27 [security] (#648)                                    | 选择性更新     | 生产依赖按上游最新清单更新并重建本地锁定文件；开发工具大版本保留                           |
| `34358e1` | chore: update to bun 1.4.2 (#645)                                                                   | 跳过／暂缓     | 暂缓 Bun 1.4.2 大版本迁移；保留已验证的 1.3.6，并统一 CI 版本来源                          |
| `d34c139` | ci: add autofix.ci (#644)                                                                           | 跳过／暂缓     | 不引入自动改写 PR 的格式化服务；避免吞掉 ESLint 错误与未经审阅的写入                       |
| `9d1c093` | fix(auth): redirect unauthorized page requests (#628)                                               | 已有／本地适配 | 本地已实现 HTML 登录跳转/API 401；保留持久 JWT 和 CSRF                                     |
| `b9ee1f6` | feat(pdftops): added pdftops converter (#611)                                                       | 已有等效实现   | 此前已移植；本次保留本地实现并运行对应回归                                                 |
| `2ea8e00` | fix(graphicsmagick): apply EXIF auto-orient so portrait images don't convert sideways (#590) (#637) | 已有等效实现   | 此前已移植；本次保留本地实现并运行对应回归                                                 |
| `edb21f8` | chore(deps): update docker/metadata-action action to v6 (#641)                                      | 跳过／暂缓     | 暂缓发布 Action 大版本升级；保留中文分支 Docker 发布权限、标签与构建设置                   |
| `0dea046` | chore(deps): update docker/setup-buildx-action action to v4 (#642)                                  | 跳过／暂缓     | 暂缓发布 Action 大版本升级；保留中文分支 Docker 发布权限、标签与构建设置                   |
| `878876c` | chore(deps): update docker/build-push-action action to v7 (#640)                                    | 跳过／暂缓     | 暂缓发布 Action 大版本升级；保留中文分支 Docker 发布权限、标签与构建设置                   |
| `57ebd7f` | chore(deps): update actions/checkout action to v7 (#639)                                            | 跳过／暂缓     | 暂缓发布 Action 大版本升级；保留中文分支 Docker 发布权限、标签与构建设置                   |
| `5c96086` | feat(ffmpeg): added m2ts, ts, vob, wmv input types, and mka output (#636)                           | 已有等效实现   | 此前已移植；本次保留本地实现并运行对应回归                                                 |
| `e94d037` | fix(results): hide actions for failed conversions (#625)                                            | 已有等效实现   | 此前已移植；本次保留本地实现并运行对应回归                                                 |
| `ce86373` | fix(ffmpeg): raise execFile maxBuffer so long conversions don't overflow stderr (#629)              | 已有等效实现   | 此前已移植；本次保留本地实现并运行对应回归                                                 |
| `acee10f` | feat(auth): autofocus login email field (#627)                                                      | 本次合入       | 登录邮箱 autofocus                                                                         |
| `f444d84` | ci: add xss scan (#614)                                                                             | 跳过／暂缓     | 暂缓新增全仓库 xss-scan gate；本次品牌字符串加入实际转义回归，保留既有安全检查             |
| `126fd43` | feat(calibre): add azw3 to supported input formats (#610)                                           | 已有等效实现   | 此前已移植；本次保留本地实现并运行对应回归                                                 |
| `3f91d51` | feat(soffice): add support for Excel and Calc spreadsheet conversions (#609)                        | 已有等效实现   | 此前已移植；本次保留本地实现并运行对应回归                                                 |
| `a7722c1` | chore: add missing PORT environment variable to README (#576)                                       | 已有／本地适配 | PORT 已在配置文档说明，保留本地部署文档                                                    |
| `ddd782d` | fix: version printing (#606)                                                                        | 已有／本地适配 | 版本检测已移植且有超时；保留 Dasel --version 相容性                                        |
| `c8551d9` | chore: update deps (#605)                                                                           | 选择性更新     | 生产依赖按上游最新清单更新并重建本地锁定文件；开发工具大版本保留                           |
| `85355c6` | ci: change autolabeler to a custom built (#603)                                                     | 跳过／暂缓     | 不采用 c4illin/autolabel@main；可变引用在 pull_request_target 下持写权限                   |
| `84e9549` | test: add unit tests for main and db and improve coverage (#596)                                    | 跳过／暂缓     | 上游测试绑定旧 schema/handleConvert，保留并执行本地 schema v5 与安全测试                   |
| `5cf7703` | fix: better 404 message in logs (#599)                                                              | 本次合入       | 404 日志仅输出请求方法与路径                                                               |
| `3602f12` | fix(dasel): update converter for v3 CLI (#591)                                                      | 已有／本地适配 | 保留已修复的 Dasel v2/v3 双兼容，不只采用 v3 CLI                                           |
| `15e4046` | fix(results): encode download filenames (#587)                                                      | 已有等效实现   | 此前已移植；本次保留本地实现并运行对应回归                                                 |
| `7157d23` | Apply EXIF orientation when converting images with ImageMagick (#577)                               | 本次合入       | ImageMagick EXIF auto-orient                                                               |
| `dc61643` | fix(libreoffice): don't force MS Word 97 infilter on .wps (#585)                                    | 已有等效实现   | 此前已移植；本次保留本地实现并运行对应回归                                                 |
| `393441f` | chore: fix release config                                                                           | 本次合入       | 修正 release 分类 YAML 层级                                                                |
| `cc4de76` | chore: refresh lockfile                                                                             | 选择性更新     | 生产依赖按上游最新清单更新并重建本地锁定文件；开发工具大版本保留                           |
| `174877c` | ci: remove bump version action                                                                      | 跳过／暂缓     | 保留中文分支独立发布流程，不照搬上游删除版本工作流程                                       |
| `eceb29c` | chore: prepare for 0.18.0                                                                           | 跳过／暂缓     | 0.18.0 发布记录已被此次 0.19.0 对齐取代                                                    |
| `4bdb643` | chore(deps): bump deps                                                                              | 选择性更新     | 生产依赖按上游最新清单更新并重建本地锁定文件；开发工具大版本保留                           |
| `e125326` | Merge commit from fork                                                                              | 已有／本地适配 | 本地已实现 POST 删除与 CSRF；保留本地 DOM 文件名转义                                       |
| `0965928` | security: fix path traversal vulnerability in conversion API (#532)                                 | 已有等效实现   | 此前已移植；本次保留本地实现并运行对应回归                                                 |
| `1ba82cf` | fix(assimp): pass -f<format> so non-extension targets work (#557)                                   | 已有等效实现   | 此前已移植；本次保留本地实现并运行对应回归                                                 |
| `70fcc84` | chore: downgrade elysia to 1.4.22 (#551)                                                            | 跳过／暂缓     | 不回退 Elysia 1.4.22，使用上游后续安全升级 1.4.30                                          |
| `bee3f63` | chore(deps): update docker/login-action action to v4 (#545)                                         | 跳过／暂缓     | 暂缓发布 Action 大版本升级；保留中文分支 Docker 发布权限、标签与构建设置                   |

## 本次验证

- 主要回归与基础转换 E2E：524 通过、10 个既有占位测试跳过、0 失败。
- frozen lockfile 安装、JavaScript/CSS 构建、TypeScript、ESLint、Knip 与变更文件格式检查通过。
- 新增品牌转义／长度、EXIF 参数顺序及四种 recipe 类型／扩展名绕过的回归测试。
- 用新生产依赖和编译产物替换此前已验证的 Lite 镜像应用层，实际注册登录、上传、转换、下载与 archive 均通过；覆盖 Pandoc、Dasel YAML/TOML、LibreOffice、FFmpeg、GraphicsMagick。
- 重启后登录会话、JWT／签章密钥、转换历史与输出保留，未认证下载被拒绝；HTTP 响应确认品牌安全转义、应用 0.19.0 与 recipe 未列入输入格式，运行时 Elysia 确认为 1.4.30。
- 本次没有重新执行完整 Standard／Full 工具与模型安装，也没有发布 GitHub Release 或 Docker 镜像；GitHub CI 以此次提交重新运行。

## CI FFmpeg 下载失败修复

此次同步的 Docker E2E 曾在映像建置阶段失败：AMD64 静态 FFmpeg 的唯一来源连续连接逾时。现在两种架构均可回退到 Debian 签名软件源，日志明确说明版本可能较旧，并执行 ffmpeg／ffprobe 版本指令验证。备用安装失败或执行档损坏仍会中止建置。

新增 AMD64／ARM64 下载逾时、备用安装失败与执行档损坏四个回归测试；同时修正旧 LibreOffice shell 测试的 mock 函数名，使其确实验证下载失败退出码。实际容器模拟静态下载失败，重新安装 Debian FFmpeg 5.1.9 并完成 WAV→FLAC；不会宣称备用版本具备静态版所有新功能。
