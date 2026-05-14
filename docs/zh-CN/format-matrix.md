# 格式矩阵

> 文件目的：记录 ConvertX-CN 格式支持矩阵的当前事实来源、已验证 engine 清单与后续维护方式。
> 适合读者：使用者、开发者、维护者。
> 最后更新依据：`src/converters/main.ts`、`src/converters/*.ts`、`api-server/src/engine.rs`、`tests/converters/`、`Dockerfile`、`Dockerfile.lite`、`Dockerfile.full`。
> 相关文件：[引擎说明](engines.md)、[测试指南](testing.md)、[开发指南](development.md)

## 目录

- [来源与边界](#来源与边界)
- [已验证 Web UI Engine 清单](#已验证-web-ui-engine-清单)
- [矩阵字段](#矩阵字段)
- [当前矩阵摘要](#当前矩阵摘要)
- [API Server 差异](#api-server-差异)
- [待确认项](#待确认项)

## 来源与边界

当前 Web UI 的 engine 清单已从 `src/converters/main.ts` 验证。每个 engine 的输入/输出格式不从旧 README 或旧 docs 继承，而以对应 `src/converters/<engine>.ts` 中的 `properties.from` 与 `properties.to` 为准。

本文件不把旧文档中的「1000+ 格式」直接当作事实。格式数量、每个 Docker variant 的可用性、每个架构的可用性，都需要从 converter metadata、Dockerfile 依赖和测试结果交叉确认。无法确认时标注「待确认」。

## 已验证 Web UI Engine 清单

以下 26 个 engine 已从 `src/converters/main.ts` 的 `properties` registry 确认，并且每个对应 converter 文件都存在 `export const properties`。

| Engine ID / Display Name | 类型 | Source File | Test File | 格式来源 | 备注 |
|---|---|---|---|---|---|
| `ffmpeg` | 影音 | `src/converters/ffmpeg.ts` | `tests/converters/ffmpeg.test.ts` | `properties.from/to` | 支持范围很大，硬件加速需另行验证。 |
| `imagemagick` | 图片 | `src/converters/imagemagick.ts` | `tests/converters/imagemagick.test.ts` | `properties.from/to` | `IMAGEMAGICK_COMMAND` 可改变执行命令。 |
| `graphicsmagick` | 图片 | `src/converters/graphicsmagick.ts` | `tests/converters/graphicsmagick.test.ts` | `properties.from/to` | Dockerfile.lite 与 Standard 都出现安装线索。 |
| `vips` | 图片 | `src/converters/vips.ts` | `tests/converters/vips.test.ts` | `properties.from/to` | Lite 支持状态待确认。 |
| `libheif` | 图片 | `src/converters/libheif.ts` | `tests/converters/libheif.test.ts` | `properties.from/to` | HEIF/HEIC 相关。 |
| `libjxl` | 图片 | `src/converters/libjxl.ts` | `tests/converters/libjxl.test.ts` | `properties.from/to` | JPEG XL 相关。 |
| `libreoffice` | 文档 | `src/converters/libreoffice.ts` | `tests/converters/libreoffice.test.ts` | `properties.from/to` | 字体、headless 与 PDF import 行为需按镜像验证。 |
| `pandoc` | 文档 | `src/converters/pandoc.ts` | `tests/converters/pandoc.test.ts` | `properties.from/to` | PDF 输出依赖 TeX/XeLaTeX。 |
| `calibre` | 电子书 | `src/converters/calibre.ts` | `tests/converters/calibre.test.ts` | `properties.from/to` | 电子书转换。 |
| `inkscape` | 向量图 | `src/converters/inkscape.ts` | `tests/converters/inkscape.test.ts` | `properties.from/to` | EMF 等格式优先使用 Inkscape。 |
| `resvg` | 向量图 | `src/converters/resvg.ts` | `tests/converters/resvg.test.ts` | `properties.from/to` | 可由 `RESVG_DISABLED=1` 或 disabled-engines 文件禁用；arm64 待确认。 |
| `assimp` | 3D 模型 | `src/converters/assimp.ts` | `tests/converters/assimp.test.ts` | `properties.from/to` | 3D 模型转换。 |
| `potrace` | 向量图 | `src/converters/potrace.ts` | `tests/converters/potrace.test.ts` | `properties.from/to` | 位图转矢量。 |
| `vtracer` | 向量图 | `src/converters/vtracer.ts` | `tests/converters/vtracer.test.ts` | `properties.from/to` | 图片转 SVG。 |
| `dasel` | 数据格式 | `src/converters/dasel.ts` | `tests/converters/dasel.test.ts` | `properties.from/to` | JSON/YAML/TOML/XML 等结构化数据。 |
| `xelatex` | 文档/PDF | `src/converters/xelatex.ts` | `tests/converters/xelatex.test.ts` | `properties.from/to` | TeX/LaTeX 到 PDF。 |
| `dvisvgm` | 向量图 | `src/converters/dvisvgm.ts` | `tests/converters/dvisvgm.test.ts` | `properties.from/to` | DVI/XDV/PDF/EPS 到 SVG/SVGZ。 |
| `msgconvert` | 邮件 | `src/converters/msgconvert.ts` | `tests/converters/msgconvert.test.ts` | `properties.from/to` | MSG 到 EML。 |
| `vcf` | 数据格式 | `src/converters/vcf.ts` | `tests/converters/vcf.test.ts` | `properties.from/to` | VCF 到 CSV。 |
| `markitDown` | 文档 | `src/converters/markitdown.ts` | `tests/converters/markitdown.test.ts` | `properties.from/to` | 多格式转 Markdown。 |
| `MinerU` | PDF/OCR | `src/converters/mineru.ts` | `tests/converters/mineru.test.ts` | `properties.from/to` | 模型、backend、VLM 支持需按镜像验证。 |
| `PDFMathTranslate` | PDF 翻译 | `src/converters/pdfmathtranslate.ts` | `tests/converters/pdfmathtranslate.test.ts` | `properties.from/to` | 输出格式由语言列表生成。 |
| `BabelDOC` | PDF 翻译 | `src/converters/babeldoc.ts` | `tests/converters/babeldoc.test.ts` | `generateLanguageMappings()` | 输出格式由代码生成，不能只看静态表。 |
| `OCRmyPDF` | OCR | `src/converters/ocrmypdf.ts` | `tests/converters/ocrmypdf.test.ts` | `properties.from/to` | 依赖 Tesseract 与语言包。 |
| `PDF Packager` | PDF 处理 | `src/converters/pdfpackager.ts` | `tests/converters/pdfpackager.test.ts` | `ALL_CHIPS` / `properties.to` | 输出 chip 由代码生成，包含图片化、PDF/A、签名/保护等组合。 |
| `deark` | 特殊格式/解包 | `src/converters/deark.ts` | `tests/converters/deark.test.ts` | `properties.from/to` | 输出为归档类结果。 |

## 矩阵字段

完整矩阵维护时使用以下字段：

| 类型 | 引擎 | 输入格式 | 输出格式 | Lite | Standard | Full | amd64 | arm64 | 备注 |
|---|---|---|---|---|---|---|---|---|---|
| 来自分类 | 来自 registry | 来自 `properties.from` | 来自 `properties.to` | Dockerfile.lite | Dockerfile | Dockerfile.full | 构建/测试 | 构建/测试 | 无法确认写「待确认」 |

细表字段：

| Engine ID | Display Name | Purpose | Input Formats | Output Formats | Required Binary | Required Env | Docker Variant | ARM64 | Source File | Test File | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|

## 当前矩阵摘要

| 类型 | 引擎 | 输入格式来源 | 输出格式来源 | Lite | Standard | Full | amd64 | arm64 | 备注 |
|---|---|---|---|---|---|---|---|---|---|
| 影音 | FFmpeg | `ffmpeg.ts` | `ffmpeg.ts` | 支持 | 支持 | 支持 | 支持 | 待确认 | Standard 使用静态包下载逻辑；硬件加速另行验证。 |
| 图片 | ImageMagick / GraphicsMagick / vips / libheif / libjxl | 各 converter | 各 converter | 部分待确认 | 支持 | 支持 | 支持 | 待确认 | Lite 对 vips 等支持需按镜像验证。 |
| 文档 | LibreOffice / Pandoc / MarkItDown | 各 converter | 各 converter | 部分支持 | 支持 | 支持 | 支持 | 待确认 | PDF 输出和字体依赖需验证。 |
| 电子书 | Calibre / Pandoc / LibreOffice | 各 converter | 各 converter | 待确认 | 支持 | 支持 | 支持 | 待确认 | Calibre 在各镜像的安装状态需确认。 |
| PDF / OCR | PDF Packager / PDFMathTranslate / BabelDOC / OCRmyPDF / MinerU | 各 converter / 代码生成 | 各 converter / 代码生成 | 多数待确认 | 支持 | 支持 | 待确认 | 待确认 | 依赖模型、语言包、Python 工具或外部 API。 |
| 向量图 | Inkscape / resvg / Potrace / VTracer / dvisvgm / XeLaTeX | 各 converter | 各 converter | 部分支持 | 支持 | 支持 | 支持 | 待确认 | resvg 在 arm64 有禁用逻辑。 |
| 3D 模型 | Assimp | `assimp.ts` | `assimp.ts` | 待确认 | 支持 | 支持 | 支持 | 待确认 | 需按 `assimp-utils` 安装状态验证。 |
| 数据格式 | Dasel / VCF | 各 converter | 各 converter | 支持/待确认 | 支持 | 支持 | 支持 | 支持/待确认 | VCF 为内置逻辑；Dasel 依赖 binary。 |
| 特殊格式 | deark | `deark.ts` | `deark.ts` | 待确认 | 支持 | 支持 | 支持 | 待确认 | Standard 从源码编译 deark。 |

## API Server 差异

`api-server/src/engine.rs` 也维护了一份 engine registry，但它是 API Server 当前实现的一部分，不应自动视为 Web UI 的唯一事实来源。文档维护时必须比较：

- Web UI：`src/converters/main.ts` 与各 converter `properties`。
- API Server：`api-server/src/engine.rs`。

若 API Server registry 缺少 Web UI engine、格式列表不同或描述不同，应在 [API Server](api-server.md) 标注「目前实作」与「未来重构」。

## 待确认项

- 完整输入/输出格式列表是否要生成到 `docs/_shared/format-matrix/engines.json`。
- 每个格式是否只有 metadata 支持，还是已有测试覆盖。
- Lite / Standard / Full 每个 engine 的实际 binary 可用性。
- 每个 engine 在 amd64 / arm64 的测试通过情况。
- 代码生成格式，例如 BabelDOC、PDFMathTranslate、PDF Packager 的输出 chip/语言列表，需要由代码生成而不是手写。
