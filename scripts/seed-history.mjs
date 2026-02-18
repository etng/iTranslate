import { readFileSync, writeFileSync, existsSync } from "node:fs";

const fixturePath = "src/__tests__/fixtures/jane_tyre.md";
const outputPath = "src/seeds/historySeed.ts";
const envPath = ".env.local";

function splitByChapter(markdown) {
  const lines = markdown.split(/\r?\n/);
  const sections = [];
  let title = "";
  let current = [];

  const push = () => {
    const body = current.join("\n").trim();
    if (!title || !body) return;
    sections.push({ title, markdown: body });
  };

  for (const line of lines) {
    const match = line.match(/^##\s+(.+)$/);
    if (match) {
      push();
      title = match[1].trim();
      current = [line];
      continue;
    }

    if (title) {
      current.push(line);
    }
  }

  push();
  return sections;
}

function patchEnv(content) {
  const lines = content.length > 0 ? content.split(/\r?\n/) : [];
  const keys = new Map();

  lines.forEach((line, idx) => {
    const i = line.indexOf("=");
    if (i > 0) {
      keys.set(line.slice(0, i), idx);
    }
  });

  if (keys.has("VITE_ENABLE_HISTORY_SEED")) {
    lines[keys.get("VITE_ENABLE_HISTORY_SEED")] = "VITE_ENABLE_HISTORY_SEED=1";
  } else {
    lines.push("VITE_ENABLE_HISTORY_SEED=1");
  }

  return `${lines.filter(Boolean).join("\n")}\n`;
}

const fixture = readFileSync(fixturePath, "utf8");
const chapters = splitByChapter(fixture).filter((entry) => entry.markdown.length > 120).slice(0, 18);

const now = Date.now();
const items = chapters.map((entry, index) => {
  const createdAt = new Date(now - (chapters.length - index) * 60_000).toISOString();
  const trimmed = entry.markdown.split("\n").slice(0, 14).join("\n");
  return {
    id: `seed-${index + 1}`,
    title: entry.title,
    createdAt,
    sourceLanguage: "English",
    targetLanguage: "Simplified Chinese",
    inputRaw: trimmed,
    inputMarkdown: trimmed,
    outputMarkdown: `# ${entry.title}（示例翻译）\n\n${trimmed}`,
    provider: "ollama",
    model: "translategemma",
    engineId: "seed-engine-ollama",
    engineName: "分页演示引擎",
    engineDeleted: false,
  };
});

const ts = `import type { TranslationHistoryItem } from "../types";\n\nexport const historySeedEntries: TranslationHistoryItem[] = ${JSON.stringify(items, null, 2)};\n`;
writeFileSync(outputPath, ts, "utf8");

const env = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
writeFileSync(envPath, patchEnv(env), "utf8");

console.log(`已生成历史 seed：${items.length} 条`);
console.log("已设置 VITE_ENABLE_HISTORY_SEED=1，重启应用后会自动注入一次");
