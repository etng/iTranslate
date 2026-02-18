# iTranslate

基于 `Tauri + React` 的桌面翻译工具，默认使用本地 `Ollama + translategemma`，面向长文场景提供格式保留翻译、历史追溯、引擎管理与 EPUB 导出能力。

## 当前能力（0.2.x）

- 启动向导：首次启动检测 Ollama 服务与模型可用性。
- 翻译流程：默认 `英语 -> 简体中文`，支持语言切换与手动翻译。
- 输入处理：
  - `Cmd/Ctrl + V` 粘贴时可识别 HTML 并转换为 Markdown。
  - 手动键入默认不自动翻译，需点击“马上翻译”。
- 结果展示：Markdown（带行号）/ HTML 预览双视图。
- 双栏阅读：按段落块联动定位，减少左右阅读错位。
- 历史记录：分页、编辑标题、删除、回看、继续编辑重译。
- 新建翻译：历史详情可一键退出覆盖模式，开启全新翻译。
- 翻译引擎：新增/编辑/启停/软删除/默认引擎切换。
- 用户偏好：默认 EPUB 作者、默认导出目录。
- EPUB 导出：历史多选导出，向导参数配置，兼容 iBooks。
- 菜单：关于、检查更新（GitHub `releases/latest`）。
- 自动发版：`v*` tag 触发 GitHub Actions 构建并发布 Release。

## 技术栈

- 前端：React + TypeScript + Vite
- 桌面：Tauri v2
- 翻译调用：Rust `reqwest` -> Ollama `/api/generate`
- 模型探测：Rust `reqwest` -> Ollama `/api/tags`
- Markdown：`marked + DOMPurify`
- HTML 转 Markdown：`turndown`
- 编辑器：`@uiw/react-codemirror`
- 测试：Vitest + Playwright

## 开发命令

一键初始化并启动桌面端：

```bash
make up-desktop
```

仅前端：

```bash
make up-web
```

常用命令：

```bash
make init                       # 初始化依赖与本地配置(.env.local)
make run-web                    # 启动 Web 开发服务
make run-desktop                # 启动桌面开发入口
make check                      # lint + 单测 + cargo check
make setup-e2e                  # 安装 Playwright Chromium
make seed-history               # 注入分页演示 seed（下次启动生效一次）
make bump-version PART=patch    # 仅升级版本并打 tag
make release PART=patch         # 升级版本并推送当前分支 + tags
```

签名辅助：

```bash
make signer-generate
make signer-copy-private
make signer-copy-public
make signer-copy-password
make signer-sync-pubkey
```

## 测试命令

```bash
npm run lint
npm run test
npm run test:e2e
cargo check --manifest-path src-tauri/Cargo.toml
```

## 自动发版（GitHub Actions）

工作流：`.github/workflows/release.yml`

- 触发：推送 `v*` tag，或手动 `workflow_dispatch`
- 输出：多平台安装包 + Release 资产 + Updater `latest.json`

必需 Secrets（仓库 `Settings -> Secrets and variables -> Actions`）：

- `TAURI_SIGNING_PRIVATE_KEY`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`

推荐流程：

1. `make release PART=patch`（或 `minor` / `major`）
2. 打开 GitHub Actions 查看 `发布桌面应用`
3. 打开 Releases 确认产物

详细步骤见：`docs/signing-and-release.md`

## 更新检查说明

- 客户端读取 `https://api.github.com/repos/etng/iTranslate/releases/latest`
- 若发现新版本则提示下载更新
- Tauri updater 使用 `src-tauri/tauri.conf.json` 中 endpoint + pubkey

## 空间占用说明

Tauri/Rust 开发阶段会在 `src-tauri/target` 产生较大构建缓存（数 GB 属正常）。

清理命令：

```bash
cargo clean --manifest-path src-tauri/Cargo.toml
```

## 文档索引

- `docs/PRD.md`：产品需求文档
- `docs/task-pool.md`：任务池（勾选进度）
- `docs/task-progress.md`：阶段进展
- `docs/signing-and-release.md`：签名与自动发版手册
