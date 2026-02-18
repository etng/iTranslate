import { existsSync, readFileSync, writeFileSync } from "node:fs";

const envPath = ".env.local";
const defaults = {
  VITE_OLLAMA_ENDPOINT: "http://127.0.0.1:11434",
  VITE_OLLAMA_MODEL: "translategemma",
};

function parseEnv(content) {
  const map = new Map();
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    map.set(trimmed.slice(0, idx), trimmed.slice(idx + 1));
  }
  return map;
}

let existing = new Map();
if (existsSync(envPath)) {
  existing = parseEnv(readFileSync(envPath, "utf8"));
}

const merged = new Map(existing);
for (const [key, value] of Object.entries(defaults)) {
  if (!merged.has(key) || !merged.get(key)?.trim()) {
    merged.set(key, value);
  }
}

const output = [
  "# iTranslate 本地初始化配置",
  "# 可按需修改，下次执行初始化不会覆盖已有值",
  ...Array.from(merged.entries()).map(([k, v]) => `${k}=${v}`),
  "",
].join("\n");

writeFileSync(envPath, output, "utf8");
console.log("已初始化 .env.local");
