# 签名与自动发版操作手册

## 1. 生成 Tauri Updater 密钥对

推荐使用 Makefile：

```bash
make signer-generate
```

等价命令（默认密码：`mksakmc`）：

```bash
mkdir -p ~/.tauri/keys
npm run tauri signer generate -- -w ~/.tauri/keys/itranslate.key -p "mksakmc" --ci
```

## 2. 复制密钥内容到剪贴板（用于 GitHub Secrets）

复制私钥（填入 `TAURI_SIGNING_PRIVATE_KEY`）：

```bash
cat ~/.tauri/keys/itranslate.key | pbcopy
```

复制公钥（用于校验或同步配置）：

```bash
cat ~/.tauri/keys/itranslate.key.pub | pbcopy
```

复制密码（填入 `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`）：

```bash
printf "%s" "mksakmc" | pbcopy
```

对应 Makefile 快捷命令：

```bash
make signer-copy-private
make signer-copy-public
make signer-copy-password
```

## 3. 同步公钥到应用配置

快捷命令：

```bash
make signer-sync-pubkey
```

执行后会更新 `src-tauri/tauri.conf.json` 的 `plugins.updater.pubkey`。

## 4. 配置 GitHub Secrets

仓库路径：`Settings -> Secrets and variables -> Actions`

新增：

- `TAURI_SIGNING_PRIVATE_KEY`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`

## 5. 触发自动发版

当前工作流：`.github/workflows/release.yml`

- 触发条件：推送 `v*` tag
- 当前默认平台：`macos-latest`、`ubuntu-22.04`、`windows-latest`
- 产物：安装包 + `latest.json` + 签名

示例：

```bash
make release PART=patch
```

说明：`make release` 会自动提交版本文件、创建 tag 并推送当前分支与 tags。

## 6. 常见问题

1. 本地磁盘占用过大

`src-tauri/target` 体积大属于正常构建缓存，可清理：

```bash
cargo clean --manifest-path src-tauri/Cargo.toml
```
