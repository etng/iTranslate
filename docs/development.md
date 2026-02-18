# 开发与贡献指南

本页面向需要参与代码贡献的开发者。

## 技术栈

- 前端：React + TypeScript + Vite
- 桌面：Tauri v2
- 翻译调用：Rust `reqwest` -> Ollama `/api/generate`
- 测试：Vitest + Playwright

## 本地开发

```bash
make up-desktop
```

仅前端：

```bash
make up-web
```

常用命令：

```bash
make init
make run-web
make run-desktop
make check
make setup-e2e
make seed-history
```

## 测试

```bash
npm run lint
npm run test
npm run test:e2e
cargo check --manifest-path src-tauri/Cargo.toml
```

## 版本与发布

```bash
make bump-version PART=patch
make release PART=patch
```

`make release` 会：
- 升级版本号
- 创建 `v*` tag
- 推送当前分支与 tags

GitHub Actions 会基于 tag 自动构建并发布。

## 签名与 Updater

```bash
make signer-generate
make signer-copy-private
make signer-copy-public
make signer-copy-password
make signer-sync-pubkey
```

详细见：`docs/signing-and-release.md`

## 磁盘占用清理

Tauri/Rust 构建缓存较大，清理命令：

```bash
cargo clean --manifest-path src-tauri/Cargo.toml
```
