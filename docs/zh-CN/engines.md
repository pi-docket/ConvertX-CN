# 引擎说明

> 文件目的：说明当前 ConvertX-CN 转换引擎、用途、依赖、限制、测试位置与待确认项。
> 适合读者：使用者、部署者、开发者。
> 最后更新依据：`src/converters/main.ts`、`src/converters/*.ts`、`tests/converters/`、`Dockerfile*`、`api-server/src/engine.rs`。
> 相关文件：[格式矩阵](format-matrix.md)、[安装方式](installation.md)、[测试指南](testing.md)

## 目录

- [来源与规则](#来源与规则)
- [引擎分类](#引擎分类)
- [引擎总览](#引擎总览)
- [版本与架构支持](#版本与架构支持)
- [常见失败原因](#常见失败原因)
- [待确认](#待确认)

## 来源与规则

Web UI 的实际 converter 清单以 `src/converters/main.ts` 为准。输入和输出格式以各 converter 的 `properties.from` 与 `properties.to` 为准。API Server 另有 `api-server/src/engine.rs` 内建 registry，若两者不一致，应在文档中标注差异。

## 引擎分类

| 分类 | 引擎 |
|---|---|
| 影音 | FFmpeg |
| 图片 | ImageMagick、GraphicsMagick、libvips、libheif、libjxl |
| 文档 | LibreOffice、Pandoc、MarkItDown |
| 电子书 | Calibre、Pandoc、LibreOffice |
| PDF 处理 | PDF Packager、PDFMathTranslate、BabelDOC、OCRmyPDF、LibreOffice、Pandoc |
| OCR | OCRmyPDF、MinerU、PDFMathTranslate/BabelDOC 前处理 OCR |
| 向量图 | Inkscape、resvg、Potrace、VTracer、dvisvgm、XeLaTeX |
| 3D 模型 | Assimp |
| 数据格式 | Dasel、VCF to CSV |
| 压缩/解包/特殊格式 | deark、PDF Packager、TRA multi-output packaging |

## 引擎总览

| Engine ID | Display Name | 用途 | 主要依赖 | Source File | Test File | 状态 |
|---|---|---|---|---|---|---|
| `ffmpeg` | FFmpeg | 影音与动态图转换 | `ffmpeg`、`ffprobe` | `src/converters/ffmpeg.ts` | `tests/converters/ffmpeg.test.ts` | 已在 Web UI 注册 |
| `imagemagick` | ImageMagick | 图片格式转换 | `magick` | `src/converters/imagemagick.ts` | `tests/converters/imagemagick.test.ts` | 已注册 |
| `graphicsmagick` | GraphicsMagick | 图片格式转换 | `gm` | `src/converters/graphicsmagick.ts` | `tests/converters/graphicsmagick.test.ts` | 已注册 |
| `vips` | libvips | 高性能图片转换 | `vips` | `src/converters/vips.ts` | `tests/converters/vips.test.ts` | 已注册，Lite 支持待确认 |
| `libheif` | libheif | HEIF/HEIC 相关转换 | libheif 工具 | `src/converters/libheif.ts` | `tests/converters/libheif.test.ts` | 已注册 |
| `libjxl` | libjxl | JPEG XL 相关转换 | libjxl 工具 | `src/converters/libjxl.ts` | `tests/converters/libjxl.test.ts` | 已注册 |
| `libreoffice` | LibreOffice | Office 文档转换 | `libreoffice` | `src/converters/libreoffice.ts` | `tests/converters/libreoffice.test.ts` | 已注册 |
| `pandoc` | Pandoc | 文档与标记语言转换 | `pandoc`、部分 PDF 输出依赖 XeLaTeX | `src/converters/pandoc.ts` | `tests/converters/pandoc.test.ts` | 已注册 |
| `calibre` | Calibre | 电子书转换 | Calibre CLI | `src/converters/calibre.ts` | `tests/converters/calibre.test.ts` | 已注册 |
| `inkscape` | Inkscape | SVG/EMF/矢量相关转换 | `inkscape`、可能需要 headless 支持 | `src/converters/inkscape.ts` | `tests/converters/inkscape.test.ts` | 已注册 |
| `resvg` | resvg | SVG 渲染 | `resvg` | `src/converters/resvg.ts` | `tests/converters/resvg.test.ts` | arm64 可能被禁用 |
| `assimp` | Assimp | 3D 模型转换 | `assimp` | `src/converters/assimp.ts` | `tests/converters/assimp.test.ts` | 已注册 |
| `potrace` | Potrace | 位图转矢量 | `potrace` | `src/converters/potrace.ts` | `tests/converters/potrace.test.ts` | 已注册 |
| `vtracer` | VTracer | 图片转 SVG | `vtracer` | `src/converters/vtracer.ts` | `tests/converters/vtracer.test.ts` | 已注册 |
| `dasel` | Dasel | JSON/YAML/TOML/XML 等数据转换 | `dasel` | `src/converters/dasel.ts` | `tests/converters/dasel.test.ts` | 已注册 |
| `xelatex` | XeLaTeX | TeX/LaTeX 到 PDF | `xelatex` | `src/converters/xelatex.ts` | `tests/converters/xelatex.test.ts` | 已注册 |
| `dvisvgm` | dvisvgm | DVI/XDV/PDF/EPS 到 SVG | `dvisvgm` | `src/converters/dvisvgm.ts` | `tests/converters/dvisvgm.test.ts` | 已注册 |
| `msgconvert` | msgconvert | Outlook MSG 到 EML | `msgconvert` | `src/converters/msgconvert.ts` | `tests/converters/msgconvert.test.ts` | 已注册 |
| `vcf` | VCF to CSV | 联系人格式转换 | 内置逻辑 | `src/converters/vcf.ts` | `tests/converters/vcf.test.ts` | 已注册 |
| `markitDown` | MarkItDown | 多格式到 Markdown | `markitdown` | `src/converters/markitdown.ts` | `tests/converters/markitdown.test.ts` | 已注册 |
| `MinerU` | MinerU | PDF 到 Markdown / 结构化输出 | `mineru`、模型、可能需要 VLM | `src/converters/mineru.ts` | `tests/converters/mineru.test.ts` | 已注册，模型状态需验证 |
| `PDFMathTranslate` | PDFMathTranslate | PDF 翻译 | `pdf2zh_next`、BabelDOC cache | `src/converters/pdfmathtranslate.ts` | `tests/converters/pdfmathtranslate.test.ts` | 已注册 |
| `BabelDOC` | BabelDOC | PDF 翻译 / 文档处理 | `babeldoc`、LLM key 可选 | `src/converters/babeldoc.ts` | `tests/converters/babeldoc.test.ts` | 已注册 |
| `OCRmyPDF` | OCRmyPDF | PDF OCR | `ocrmypdf`、Tesseract | `src/converters/ocrmypdf.ts` | `tests/converters/ocrmypdf.test.ts` | 已注册 |
| `PDF Packager` | PDF Packager | PDF 图片化、PDF/A、加密、签名、打包 | poppler、qpdf、ghostscript、img2pdf、python sign script | `src/converters/pdfpackager.ts` | `tests/converters/pdfpackager.test.ts` | 已注册 |
| `deark` | deark | 特殊/旧格式解包 | `deark`、`tar` | `src/converters/deark.ts` | `tests/converters/deark.test.ts` | 已注册 |

## 版本与架构支持

| 引擎 | Lite | Standard | Full | amd64 | arm64 | 备注 |
|---|---|---|---|---|---|---|
| FFmpeg | 支持 | 支持 | 支持 | 支持 | 待确认 | Lite 使用 apt，Standard 使用静态包下载逻辑。 |
| ImageMagick | 待确认 | 支持 | 支持 | 支持 | 待确认 | 以实际镜像验证为准。 |
| GraphicsMagick | 支持 | 支持 | 支持 | 支持 | 支持 | Dockerfile.lite 与 Standard 均安装。 |
| LibreOffice | 支持 | 支持 | 支持 | 支持 | 待确认 | 大文件和字体支持需验证。 |
| Pandoc | 支持 | 支持 | 支持 | 支持 | 待确认 | PDF 输出可能依赖 TeX。 |
| resvg | amd64 支持 | 支持 | 支持 | 支持 | 可能禁用 | 代码会检查 `RESVG_DISABLED` 和 disabled-engines 文件。 |
| MinerU | 待确认 | 支持 | 支持 | 待确认 | 待确认 | 模型、PyTorch、VLM 支持需验证。 |
| PDFMathTranslate / BabelDOC | 待确认 | 支持 | 支持 | 待确认 | 待确认 | 依赖 Python 包、cache、可能外部 API。 |
| OCRmyPDF | 待确认 | 支持 | 支持 | 待确认 | 待确认 | 语言包支持与镜像差异相关。 |

## 常见失败原因

- 容器版本缺少 required binary。
- 输入格式在 `properties.from` 中存在，但底层工具实际不支持该文件变体。
- 输出格式需要额外字体、语言包、模型或 API key。
- arm64 下某些官方 binary 不存在或构建失败。
- PDF/OCR/翻译任务超时、内存不足或模型缺失。
- 反向代理或上传大小限制导致文件没有完整传到后端。

## 待确认

- 每个引擎完整输入/输出格式表应从 `properties` 自动抽取到 `_shared/format-matrix/`。
- API Server `engine.rs` 与 Web UI converter 清单是否完全同步。
- Lite / Standard / Full 在发布镜像中的实际 binary 差异。
- 每个引擎在 arm64 的实际通过测试情况。
