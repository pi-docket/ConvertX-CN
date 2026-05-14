# Changelog 维护指南

> 文件目的：规范 ConvertX-CN 的变更记录、版本说明和文档同步。
> 适合读者：维护者、发布者、贡献者。
> 最后更新依据：`CHANGELOG.md`、`package.json`、Dockerfile 与 docs 重整计划。
> 相关文件：[开发指南](development.md)、[Roadmap](roadmap.md)

## 目录

- [原则](#原则)
- [分类](#分类)
- [必须记录的变更](#必须记录的变更)
- [文档同步](#文档同步)

## 原则

- 用户可见行为变化必须记录。
- API、环境变量、Docker variant、格式支持变化必须记录。
- 不确定或实验性功能不能写成稳定承诺。

## 分类

建议使用：

- Added
- Changed
- Fixed
- Deprecated
- Removed
- Security
- Docs

## 必须记录的变更

- 新增或移除 converter。
- 修改格式支持。
- 修改 API route、request 或 response。
- 新增、废弃或改变 env 默认值。
- Docker 镜像依赖变化。
- 安全相关修复。

## 文档同步

发布前检查：

- `README.md`
- `docs/zh-CN/configuration.md`
- `docs/zh-CN/engines.md`
- `docs/zh-CN/format-matrix.md`
- `docs/zh-CN/api-reference.md`
- `docs/zh-CN/roadmap.md`
