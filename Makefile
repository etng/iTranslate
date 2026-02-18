SHELL := /bin/zsh

.PHONY: help install init-data init seed-history setup-e2e run-web run-desktop up-web up-desktop lint test test-e2e build check clean

help:
	@echo "可用命令："
	@echo "  make init        - 初始化依赖与本地配置数据(.env.local)"
	@echo "  make run-web     - 启动 Web 开发服务"
	@echo "  make run-desktop - 启动桌面开发入口(Tauri)"
	@echo "  make up-web      - 一键初始化并启动 Web"
	@echo "  make up-desktop  - 一键初始化并启动桌面程序"
	@echo "  make seed-history- 生成分页演示 seed 并在下次启动自动注入"
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
