# 任务池

> 说明：使用复选框跟踪任务进度，完成一项即打勾。

## 本轮待办

- [ ] （暂无，等待新任务）

## 已完成

- [x] 顶部名言点击可直接新建翻译任务（源文本为该名言）
- [x] 名言任务历史标题固定为“名言警句翻译+年月日时分秒”
- [x] 恢复发布矩阵到 macOS/Linux/Windows，验证后发 minor release
- [x] GitHub Actions 发布提速：Rust 缓存 + 缩减默认平台 + 减少重复前端构建开销
- [x] 修复发版脚本残留版本改动：bump 后自动提交再打 tag
- [x] README 用户化重构：开发说明迁移到 `docs/`，README 聚焦功能与使用
- [x] README 全量同步更新：按当前 0.2.x 实现刷新功能、命令、发布与排障说明
- [x] 修复 CI 发版阻塞：tauri-action 参数更正 + bundle identifier 改为唯一值
- [x] 修复 `make release` 写死 `main` 分支导致 push 失败的问题（改为自动识别当前分支）
- [x] docs 目录文件名英文化（`task-pool.md` / `task-progress.md` / `signing-and-release.md`）
- [x] 新增一键发版命令 `make release PART=...`（bump + push tag）
- [x] 阶段性提交治理：按功能/CI/构建/文档分批提交，清空未提交积压
- [x] 新增签名与发布操作文档（保留到 `docs/`，`cat` 命令统一 `| pbcopy`）
- [x] 新增 Makefile 签名辅助命令（生成密钥、复制到剪贴板、同步 pubkey）
- [x] README 补充签名与自动发版的快捷命令说明
- [x] 配置 GitHub Actions 自动发版：`v*` tag 触发构建、创建 release、上传安装包与 updater 元数据
- [x] 新增“新建翻译”入口：支持从历史详情一键退出覆盖模式并清空开始新任务
- [x] 修复顶栏常驻后的布局副作用：恢复顶部与文本框之间控制区可见（翻译页/历史详情页）
- [x] 修复页面级滚动导致顶部工具栏消失：顶部工具栏全页面常驻 + 滚动边界隔离
- [x] 修复双栏滚动互相干扰：按段落块进行左右联动对齐，避免双向抢滚动
- [x] 顶部工具栏左侧增加英文名言轮播（句子/作者/出处，60s 切换）
- [x] 底部图标 tab 点击时若处于折叠态，自动展开并展示对应内容
- [x] 文档三件套同步：对齐 `docs/PRD.md`、`docs/task-pool.md`、`docs/task-progress.md` 的当前范围与状态
- [x] PRD 同步更新：按当前实现刷新 `docs/PRD.md`（引擎管理、历史/EPUB、偏好、布局与日志等）
- [x] 修复 HTML 预览模式下双栏高度异常，避免遮挡底部区域
- [x] 底部状态/日志改为图标 Tab + 折叠面板，默认折叠
- [x] 历史记录“总计信息”并入分页区域，压缩头部高度
- [x] 历史记录增加多选并支持 EPUB 导出向导（章节排序可调，默认标题升序）
- [x] 修复 EPUB 在 iBooks 的实体兼容问题（`&nbsp;`）
- [x] EPUB 导出前弹出保存位置选择，并支持“设为默认导出目录”
- [x] 新增用户偏好页（默认 EPUB 作者、默认导出目录）
- [x] EPUB 导出优先使用用户偏好（默认作者/默认目录）
- [x] 底部状态与日志按钮改为图标 hover 文案，日志保留表格无标题
- [x] 清理任务池结构：完成项统一归档到“已完成”
- [x] 历史/引擎表格操作按钮图标化并提供 hover 文案
- [x] 偏好页“选择目录/清空默认目录”按钮图标化并提供 hover 文案
- [x] EPUB 导出成功后增加 toast 成功提示
- [x] 翻译页采用“顶部固定 + 底部固定 + 中间自适应”布局，修复 Markdown/HTML 切换高度漂移
- [x] 底部 dock 增加可拖拽分隔线并支持调节展开高度
- [x] 翻译链路日志增强（发起/结束/耗时/失败细节），便于定位卡住问题
- [x] 初始化 `Tauri + React + TypeScript` 工程
- [x] 接入 Ollama `translategemma` 翻译能力
- [x] 按官方 prompt format 组装请求前缀
- [x] 支持 HTML 输入并预处理为 Markdown
- [x] 结果区支持 Markdown/HTML 双视图
- [x] 实现历史记录存储与标题编辑
- [x] 实现历史记录分页与多页码跳转
- [x] 历史详情只读回看且不重复创建记录
- [x] 首次启动向导：检测 Ollama 服务与模型
- [x] 原生菜单：关于 / 检查更新
- [x] 单元测试（Vitest）
- [x] 端到端测试（Playwright）
- [x] 文档中文化（README/PRD/进展）
- [x] 使用 Makefile 统一脚本命令入口
- [x] 提供一键初始化并启动（Web/桌面）
- [x] 基于章节分段的翻译测试覆盖历史分页场景
- [x] 定制应用图标并修复粘贴链路（Cmd+V/纯文本/防抖翻译）

## 长期 Backlog（滚动评审）

- [x] 替换 GitHub Release `latest.json` 真实地址（已废弃：当前已切换 `releases/latest`）
- [x] 增加多模型管理 UI（新增/编辑/启停）
- [x] 配置 Tauri Updater 公钥
- [x] 增加历史检索与筛选
- [x] 优化前端分包，降低主包体积
- [x] 翻译引擎管理增强（已完成：批量操作、列表筛选、字段格式校验）
说明：
- 分包结果：主包 `index` 从约 `1070.38 kB` 降至约 `182.19 kB`，其余拆分到 `vendor/editor/markdown/tauri`。
- `Updater` 已配置：`src-tauri/tauri.conf.json` 已写入 `pubkey` 与 `latest.json` 地址；私钥文件仅本地保存并已通过 `.gitignore` 排除，应在 CI 中注入 `TAURI_SIGNING_PRIVATE_KEY*` 环境变量。
