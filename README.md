# iTranslate

本地优先的桌面翻译工具，默认基于 `Ollama + translategemma`，适合长文、技术文档和双语阅读场景。

## 你可以用它做什么

- 把英文文档快速翻译为中文（默认英语 -> 简体中文）
- 粘贴 HTML 后自动转为 Markdown 再翻译，减少格式错乱
- 在 Markdown 与 HTML 预览间切换查看结果
- 按历史记录回看、重译、改标题、删除
- 选择不同翻译引擎（支持默认引擎、启停、软删除）
- 批量导出历史为双语 EPUB（支持作者、导出目录偏好）

## 使用方式

1. 启动程序后先完成初始化向导（检测 Ollama 与模型）
2. 选择源语言、目标语言、翻译引擎
3. 粘贴或输入原文，点击“马上翻译”
4. 在右侧切换 Markdown / HTML 预览
5. 需要时在“历史记录”中回看、重译或导出 EPUB

## 主要特性

- 双栏阅读与段落块联动定位
- 历史分页与编辑
- 底部状态栏/日志面板（可折叠）
- 菜单“关于 / 检查更新”
- 支持 GitHub Release 更新检测

## 文档索引

- `docs/PRD.md`：产品需求文档
- `docs/task-pool.md`：任务池（勾选进度）
- `docs/task-progress.md`：阶段进展
- `docs/signing-and-release.md`：签名与自动发版手册
- `docs/development.md`：开发与贡献指南
