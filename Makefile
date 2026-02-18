SHELL := /bin/zsh
SIGNER_KEY_PATH ?= $(HOME)/.tauri/keys/itranslate.key
SIGNER_PASSWORD ?= mksakmc

.PHONY: help install init-data init seed-history bump-version release setup-e2e run-web run-desktop up-web up-desktop lint test test-e2e build check clean signer-generate signer-copy-private signer-copy-public signer-copy-password signer-sync-pubkey

help:
	@echo "可用命令："
	@echo "  make init        - 初始化依赖与本地配置数据(.env.local)"
	@echo "  make run-web     - 启动 Web 开发服务"
	@echo "  make run-desktop - 启动桌面开发入口(Tauri)"
	@echo "  make up-web      - 一键初始化并启动 Web"
	@echo "  make up-desktop  - 一键初始化并启动桌面程序"
	@echo "  make seed-history- 生成分页演示 seed 并在下次启动自动注入"
	@echo "  make bump-version PART=patch|minor|major - 升级版本并打 tag"
	@echo "  make release PART=patch|minor|major      - 一键升级版本并推送 tag 发布"
	@echo "  make signer-generate      - 生成 Tauri updater 密钥对"
	@echo "  make signer-copy-private  - 复制私钥内容到剪贴板"
	@echo "  make signer-copy-public   - 复制公钥内容到剪贴板"
	@echo "  make signer-copy-password - 复制私钥密码到剪贴板"
	@echo "  make signer-sync-pubkey   - 将公钥写入 tauri.conf.json"
	@echo "  make setup-e2e   - 安装 Playwright Chromium"
	@echo "  make check       - 运行 lint + 单测 + Rust 检查"

install:
	@if [ ! -d node_modules ]; then \
		npm install; \
	else \
		echo "node_modules 已存在，跳过 npm install"; \
	fi

init-data:
	@node scripts/init-data.mjs

init: install init-data

seed-history:
	@node scripts/seed-history.mjs

bump-version:
	@if [ -z "$(PART)" ]; then \
		echo "请指定 PART=patch|minor|major"; \
		exit 1; \
	fi
	@node scripts/bump-version.mjs $(PART)

release:
	@if [ -z "$(PART)" ]; then \
		echo "请指定 PART=patch|minor|major"; \
		exit 1; \
	fi
	@$(MAKE) bump-version PART=$(PART)
	@git push origin main --tags

setup-e2e: install
	@npx playwright install chromium

run-web:
	@npm run dev -- --host 0.0.0.0 --port 5173

run-desktop:
	@npm run tauri:dev

up-web: init run-web

up-desktop: init run-desktop

lint:
	@npm run lint

test:
	@npm run test

test-e2e:
	@npm run test:e2e

build:
	@npm run build

check: lint test
	@cargo check --manifest-path src-tauri/Cargo.toml

clean:
	@rm -rf dist test-results playwright-report

signer-generate:
	@mkdir -p "$(dir $(SIGNER_KEY_PATH))"
	@npm run tauri signer generate -- -w "$(SIGNER_KEY_PATH)" -p "$(SIGNER_PASSWORD)" --ci

signer-copy-private:
	@cat "$(SIGNER_KEY_PATH)" | pbcopy
	@echo "已复制私钥到剪贴板：$(SIGNER_KEY_PATH)"

signer-copy-public:
	@cat "$(SIGNER_KEY_PATH).pub" | pbcopy
	@echo "已复制公钥到剪贴板：$(SIGNER_KEY_PATH).pub"

signer-copy-password:
	@printf "%s" "$(SIGNER_PASSWORD)" | pbcopy
	@echo "已复制私钥密码到剪贴板"

signer-sync-pubkey:
	@PUBKEY=$$(cat "$(SIGNER_KEY_PATH).pub"); \
	node -e 'const fs=require("fs");const path="src-tauri/tauri.conf.json";const pubkey=process.env.PUBKEY;const conf=JSON.parse(fs.readFileSync(path,"utf8"));conf.plugins=conf.plugins||{};conf.plugins.updater=conf.plugins.updater||{};conf.plugins.updater.pubkey=pubkey;fs.writeFileSync(path,JSON.stringify(conf,null,2)+"\n");'
	@echo "已写入 pubkey 到 src-tauri/tauri.conf.json"
