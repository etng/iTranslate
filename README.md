# iTranslate

基于 `Tauri + React` 的桌面翻译工具，默认使用本地 `Ollama + translategemma`，并预留多模型接入接口。

## 核心功能

- 初始化向导：首次启动校验 Ollama 服务与模型是否可用。
- 双语翻译：默认 `英语 -> 简体中文`，可切换语言。
- HTML 预处理：输入为 HTML 时先转换为更稳定的 Markdown 再翻译。
- 保格式翻译：调用时自动拼接 translategemma prompt format，并附加 Markdown 保真约束。
- 结果双视图：支持 Markdown（带行号编辑器）和 HTML 预览切换。
- 历史记录：保存输入、输出、语言、模型、时间、标题；支持标题编辑、分页、详情只读回看。
- 原生菜单：关于、检查更新。

## 技术架构

- 前端：React + TypeScript + Vite
- 桌面容器：Tauri v2
- 翻译调用：Rust `reqwest` -> Ollama `/api/generate`
- 模型探测：Rust `reqwest` -> Ollama `/api/tags`
- Markdown 渲染：`marked + DOMPurify`
- HTML 转 Markdown：`turndown`
- Markdown 编辑器：`@uiw/react-codemirror`
- 测试：Vitest + Playwright

## 开发运行

```bash
npm install
npm run tauri:dev
```

仅前端调试：

```bash
npm run dev
```

## 测试命令

```bash
npm run lint
npm run test
npm run test:e2e
cargo check --manifest-path src-tauri/Cargo.toml
```

## 更新配置说明

当前更新检查分两层：

1. 前端读取 GitHub Release 的 `latest.json` 做版本比较（支持 `1.2.3.1234` 四段版本）。
2. 若有更新，再调用 Tauri Updater 下载并安装。

你需要替换以下占位配置：

- `src/constants/languages.ts` 的 `UPDATE_METADATA_URL`
- `src-tauri/tauri.conf.json` 的 `plugins.updater.endpoints`
- `src-tauri/tauri.conf.json` 的 `plugins.updater.pubkey`

## translategemma Prompt 说明

调用时会在原文前拼接官方格式前缀：

```text
Translate from {source_lang} to {target_lang}.
Source: {source_lang}: {source_text}
Translation: {target_lang}:
```

并附加 Markdown 保格式规则（仅用于请求，不会存储到历史正文）。

## 文档目录

- `docs/PRD.md`：产品需求文档
- `docs/任务进展.md`：阶段进展记录
- `docs/任务池.md`：任务拆分与勾选进度
