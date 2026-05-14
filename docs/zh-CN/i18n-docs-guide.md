# 文档多语言维护指南

> 文件目的：规范 ConvertX-CN 文档的多语言目录、翻译顺序和链接规则。
> 适合读者：文档维护者、翻译者。
> 最后更新依据：新的 `docs/` 目录规划、`src/i18n/index.ts`、`src/locales/`。
> 相关文件：[文档中心](README.md)、[开发指南](development.md)

## 目录

- [主版本](#主版本)
- [目录对应](#目录对应)
- [链接规则](#链接规则)
- [共享素材](#共享素材)
- [不可翻译内容](#不可翻译内容)
- [占位文件](#占位文件)

## 主版本

简体中文 `docs/zh-CN/` 是当前主维护版本。英文版后续从 zh-CN 翻译。

## 目录对应

每份 zh-CN 文件都应有对应 en 文件位置：

```text
docs/zh-CN/configuration.md
docs/en/configuration.md
```

## 链接规则

- 尽量使用相对链接。
- 同语言内链接直接指向文件名。
- 跨语言链接使用 `../en/...` 或 `../zh-CN/...`。

## 共享素材

跨语言共用内容放在：

```text
docs/_shared/
```

包括：

- 架构图
- Mermaid 源文件
- API schema
- 格式矩阵数据
- 截图与资产

## 不可翻译内容

以下内容保持原文：

- API route
- 环境变量
- Engine ID
- 文件路径
- 命令
- JSON key
- 配置 key

## 占位文件

未翻译英文文件顶部写：

```text
English version coming soon. The source of truth is ../zh-CN/<file>.md.
```
