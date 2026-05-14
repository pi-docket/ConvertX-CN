# ConvertX-CN Documentation

> 文件目的：作为 ConvertX-CN 文档语言入口，指向当前主维护版本和未来英文版本。
> 适合读者：所有阅读项目文档的人。
> 最后更新依据：当前文档重整目标、`docs/zh-CN/` 主文档结构、`docs/en/` 占位结构。
> 相关文件：[简体中文](./zh-CN/README.md)、[English](./en/README.md)

## 目录

- [语言入口](#语言入口)
- [共享素材](#共享素材)
- [维护规则](#维护规则)

## 语言入口

| Language | Status | Entry |
|---|---|---|
| 简体中文 | 当前主要维护版本 | [./zh-CN/README.md](./zh-CN/README.md) |
| English | Planned / placeholder | [./en/README.md](./en/README.md) |

## 共享素材

跨语言共用素材放在 `_shared/`：

- `_shared/diagrams/`：架构图、流程图、Mermaid 源文件。
- `_shared/api/`：API schema 或接口共享资料。
- `_shared/format-matrix/`：格式矩阵资料。
- `_shared/assets/`：截图、图片与其他素材。

## 维护规则

- `docs/zh-CN/` 是当前主版本。
- `docs/en/` 先保留占位，后续从 zh-CN 翻译。
- API route、环境变量、Engine ID、命令、文件路径和 JSON key 不翻译。
- 无法从当前代码或配置确认的内容必须标注「待确认」。
