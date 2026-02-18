import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

interface ChapterSection {
  title: string;
  markdown: string;
}

interface SeedEntry {
  id: string;
  title: string;
  createdAt: string;
  sourceLanguage: string;
  targetLanguage: string;
  inputRaw: string;
  inputMarkdown: string;
  outputMarkdown: string;
  provider: "ollama";
  model: string;
}

function splitByChapter(markdown: string): ChapterSection[] {
  const lines = markdown.split(/\r?\n/);
  const sections: ChapterSection[] = [];

  let currentTitle = "";
  let currentLines: string[] = [];

  const pushSection = () => {
    if (!currentTitle || currentLines.join("\n").trim().length === 0) {
      return;
    }
    sections.push({
      title: currentTitle,
      markdown: currentLines.join("\n").trim(),
    });
  };

  for (const line of lines) {
    const chapterMatch = line.match(/^##\s+(.+)$/);
    if (chapterMatch) {
      pushSection();
      currentTitle = chapterMatch[1].trim();
      currentLines = [line];
      continue;
    }

    if (currentTitle) {
      currentLines.push(line);
    }
  }

  pushSection();
  return sections;
}

function buildSeedEntries(markdown: string, size = 18): SeedEntry[] {
  const chapters = splitByChapter(markdown)
    .filter((entry) => entry.markdown.length > 120)
    .slice(0, size);

  return chapters.map((entry, index) => ({
    id: `seed-${index + 1}`,
    title: entry.title,
    createdAt: new Date(Date.now() - (size - index) * 60_000).toISOString(),
    sourceLanguage: "English",
    targetLanguage: "Simplified Chinese",
    inputRaw: entry.markdown,
    inputMarkdown: entry.markdown,
    outputMarkdown: `# ${entry.title}（示例翻译）\n\n${entry.markdown}`,
    provider: "ollama",
    model: "translategemma",
    engineId: "seed-engine-ollama",
    engineName: "分页演示引擎",
    engineDeleted: false,
  }));
}

test("按章节翻译并覆盖历史标题与分页场景", async ({ page }) => {
  const fixturePath = resolve(process.cwd(), "src/__tests__/fixtures/jane_tyre.md");
  const fixtureMarkdown = readFileSync(fixturePath, "utf8");
  const chapters = splitByChapter(fixtureMarkdown)
    .filter((chapter) => chapter.markdown.length > 80)
    .slice(0, 10);

  expect(chapters.length).toBeGreaterThan(8);

  await page.goto("/");
  await expect(page.getByText("iTranslate 初始化向导")).toBeVisible();
  await page.getByRole("button", { name: "验证并进入" }).click();
  await expect(page.getByRole("button", { name: "马上翻译" })).toBeVisible();

  for (const chapter of chapters) {
    await page
      .getByPlaceholder("支持粘贴普通文本或 HTML。快捷键粘贴会自动识别 HTML 并转 Markdown")
      .fill(chapter.markdown);
    await page.getByRole("button", { name: "马上翻译" }).click();
    await expect(page.locator(".status-bar")).toContainText("翻译完成");
  }

  await page.getByRole("button", { name: "历史记录" }).click();
  await expect(page.getByRole("heading", { name: "历史记录" })).toBeVisible();

  const latestTitle = chapters[chapters.length - 1].title;
  await expect(page.locator(`input[value="${latestTitle}"]`)).toBeVisible();

  const pagination = page.locator(".pagination");
  await expect(pagination.getByRole("button", { name: "2" })).toBeVisible();
  await pagination.getByRole("button", { name: "2" }).click();
  await expect(page.locator(".pagination .active")).toHaveText("2");

  await page.getByRole("button", { name: "查看" }).first().click();
  await expect(page.getByRole("button", { name: "返回历史列表" })).toBeVisible();
  await expect(page.getByLabel("源语言")).toBeDisabled();
  await expect(page.getByLabel("目标语言")).toBeDisabled();

  await page.getByRole("button", { name: "返回历史列表" }).click();
  await expect(page.locator(".pagination .active")).toHaveText("2");
});

test("布局稳定且 Cmd/Ctrl+V 粘贴触发 HTML 转 Markdown 自动翻译", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "验证并进入" }).click();
  await expect(page.getByRole("button", { name: "马上翻译" })).toBeVisible();

  const sourceLanguageSelect = page.locator('label:has-text("源语言") select');
  const inputArea = page.locator(".input-panel textarea");

  await inputArea.fill("これは自動言語検出のための日本語テキストです。判定してください。");
  await expect(sourceLanguageSelect).toHaveValue("Japanese");

  await inputArea.click();
  await inputArea.type("manual typing only");
  await page.waitForTimeout(900);
  await expect(page.getByRole("button", { name: "马上翻译" })).toBeEnabled();

  await page.getByRole("button", { name: "马上翻译" }).click();
  await expect(page.locator(".status-bar")).toContainText("翻译完成");

  await inputArea.click();
  await page.evaluate(() => {
    const longHtml = Array.from({ length: 140 }, (_, index) => {
      return `<p>Paste paragraph ${index + 1} with enough content for scroll sync check.</p>`;
    }).join("");
    const el = document.querySelector("textarea");
    if (!el) {
      throw new Error("textarea not found");
    }

    el.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "v",
        ctrlKey: true,
        bubbles: true,
      }),
    );

    const data = new DataTransfer();
    data.setData("text/plain", "plain");
    data.setData("text/html", `<h2>PasteTitle</h2>${longHtml}`);
    el.dispatchEvent(
      new ClipboardEvent("paste", {
        clipboardData: data,
        bubbles: true,
      }),
    );
  });

  await expect(inputArea).toHaveValue(/## PasteTitle/);
  await expect(page.getByText("已将 HTML 转换为 Markdown 后粘贴，稍后自动翻译")).toBeVisible();
  await expect(page.locator(".status-bar")).toContainText("翻译完成");
  await expect(page.locator(".status-bar .status-cell")).toHaveCount(3);
  await expect(page.getByRole("heading", { name: "执行日志" })).toBeVisible();
  await expect(page.locator(".input-panel .line-gutter")).toBeVisible();
  await expect(page.locator(".result-panel .cm-lineNumbers")).toBeVisible();

  await page.locator(".result-panel .cm-line").nth(12).click();
  const highlightedCount = await page.locator(".input-panel .line-gutter-line.active").count();
  expect(highlightedCount).toBeGreaterThan(0);

  const widthData = await page.evaluate(() => {
    const panels = document.querySelector(".panels");
    const inputPanel = document.querySelector(".input-panel");
    const resultPanel = document.querySelector(".result-panel");
    if (!panels || !inputPanel || !resultPanel) {
      return { horizontalOverflow: 1, widthDiff: 999 };
    }

    const panelRect = panels.getBoundingClientRect();
    const inputRect = inputPanel.getBoundingClientRect();
    const resultRect = resultPanel.getBoundingClientRect();

    const horizontalOverflow = Math.max(
      document.documentElement.scrollWidth - document.documentElement.clientWidth,
      document.body.scrollWidth - document.body.clientWidth,
    );
    const verticalOverflow = Math.max(
      document.documentElement.scrollHeight - document.documentElement.clientHeight,
      document.body.scrollHeight - document.body.clientHeight,
    );

    return {
      horizontalOverflow,
      verticalOverflow,
      widthDiff: Math.abs(inputRect.width - resultRect.width),
      panelWidth: panelRect.width,
    };
  });

  expect(widthData.horizontalOverflow).toBeLessThanOrEqual(1);
  expect(widthData.verticalOverflow).toBeLessThanOrEqual(1);
  expect(widthData.widthDiff).toBeLessThan(6);

  await page.getByRole("button", { name: "HTML 预览" }).click();

  const syncData = await page.evaluate(() => {
    const right = document.querySelector(".result-panel .html-preview") as HTMLElement | null;
    const left = document.querySelector(".input-panel textarea") as HTMLTextAreaElement | null;
    if (!right || !left) {
      return { ok: false, before: 0, after: 0, rightMax: 0, leftMax: 0 };
    }
    const rightMax = right.scrollHeight - right.clientHeight;
    const leftMax = left.scrollHeight - left.clientHeight;
    const before = left.scrollTop;
    right.scrollTop = Math.max(240, right.scrollHeight);
    right.dispatchEvent(new Event("scroll", { bubbles: true }));
    return { ok: true, before, after: left.scrollTop, rightMax, leftMax };
  });

  expect(syncData.ok).toBe(true);
  expect(syncData.rightMax).toBeGreaterThan(0);
  expect(syncData.leftMax).toBeGreaterThan(0);
  expect(syncData.after).toBeGreaterThan(syncData.before);
});

test("seed 注入后历史表格分页可用", async ({ page }) => {
  const fixturePath = resolve(process.cwd(), "src/__tests__/fixtures/jane_tyre.md");
  const seedEntries = buildSeedEntries(readFileSync(fixturePath, "utf8"), 18);

  await page.addInitScript((entries) => {
    window.localStorage.setItem("itranslate.setup.done", "1");
    window.localStorage.setItem("itranslate.history.v1", JSON.stringify(entries));
  }, seedEntries);

  await page.goto("/");
  await page.getByRole("button", { name: "历史记录" }).click();
  await expect(page.getByRole("heading", { name: "历史记录" })).toBeVisible();
  await expect(page.locator(".history-table tbody tr")).toHaveCount(8);
  await expect(page.getByRole("button", { name: "2" })).toBeVisible();
});

test("历史记录支持关键字与条件筛选", async ({ page }) => {
  await page.addInitScript(() => {
    const entries = [
      {
        id: "h-1",
        title: "Alpha Chapter",
        createdAt: new Date().toISOString(),
        sourceLanguage: "English",
        targetLanguage: "Simplified Chinese",
        inputRaw: "alpha input",
        inputMarkdown: "alpha input",
        outputMarkdown: "alpha output",
        provider: "ollama",
        model: "translategemma",
        engineId: "eng-1",
        engineName: "引擎A",
        engineDeleted: false,
      },
      {
        id: "h-2",
        title: "Beta Section",
        createdAt: new Date().toISOString(),
        sourceLanguage: "Japanese",
        targetLanguage: "Simplified Chinese",
        inputRaw: "beta input",
        inputMarkdown: "beta input",
        outputMarkdown: "beta output",
        provider: "custom",
        model: "qwen",
        engineId: "eng-2",
        engineName: "引擎B",
        engineDeleted: false,
      },
      {
        id: "h-3",
        title: "Gamma Note",
        createdAt: new Date().toISOString(),
        sourceLanguage: "English",
        targetLanguage: "Japanese",
        inputRaw: "gamma input",
        inputMarkdown: "gamma input",
        outputMarkdown: "gamma output",
        provider: "ollama",
        model: "llama",
        engineId: "eng-3",
        engineName: "引擎C",
        engineDeleted: false,
      },
    ];
    window.localStorage.setItem("itranslate.setup.done", "1");
    window.localStorage.setItem("itranslate.history.v1", JSON.stringify(entries));
  });

  await page.goto("/");
  await page.getByRole("button", { name: "历史记录" }).click();
  await expect(page.locator(".history-table tbody tr")).toHaveCount(3);

  await page.getByLabel("历史搜索").fill("Beta");
  await expect(page.locator(".history-table tbody tr")).toHaveCount(1);
  await expect(page.locator('input[aria-label="历史标题"]')).toHaveValue("Beta Section");

  await page.getByLabel("历史搜索").fill("");
  await page.getByLabel("筛选源语言").selectOption("Japanese");
  await expect(page.locator(".history-table tbody tr")).toHaveCount(1);
  await expect(page.locator('input[aria-label="历史标题"]')).toHaveValue("Beta Section");

  await page.getByLabel("筛选源语言").selectOption("");
  await page.getByLabel("筛选引擎").selectOption("引擎C");
  await expect(page.locator(".history-table tbody tr")).toHaveCount(1);
  await expect(page.locator('input[aria-label="历史标题"]')).toHaveValue("Gamma Note");
});

test("翻译引擎保存前做必填校验", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("itranslate.setup.done", "1");
  });

  await page.goto("/");
  await page.getByRole("button", { name: "翻译引擎" }).click();
  await page.getByRole("button", { name: "新增引擎" }).click();

  const row = page.locator(".history-table tbody tr").first();
  await row.getByRole("button", { name: "保存" }).click();
  await expect(row.locator(".field-error")).toContainText("接口地址");
  await expect(row.locator(".field-error")).toContainText("模型");

  await row.locator("td:nth-child(4) input").fill("translategemma");
  await row.locator("td:nth-child(3) input").fill("not-a-url");
  await row.getByRole("button", { name: "保存" }).click();
  await expect(row.locator(".field-error")).toContainText("有效 URL");

  await row.locator("td:nth-child(3) input").fill("http://127.0.0.1:11434");
  await row.getByRole("button", { name: "保存" }).click();
  await expect(row.locator(".field-error")).toHaveCount(0);
});

test("翻译引擎支持列表筛选", async ({ page }) => {
  await page.addInitScript(() => {
    const engines = [
      {
        id: "e-1",
        provider: "ollama",
        label: "A",
        name: "本地引擎",
        endpoint: "http://127.0.0.1:11434",
        model: "translategemma",
        enabled: true,
        deletedAt: null,
      },
      {
        id: "e-2",
        provider: "custom",
        label: "B",
        name: "远端引擎",
        endpoint: "https://api.example.com",
        model: "qwen",
        enabled: true,
        deletedAt: null,
      },
      {
        id: "e-3",
        provider: "custom",
        label: "C",
        name: "已删除引擎",
        endpoint: "https://old.example.com",
        model: "old-model",
        enabled: false,
        deletedAt: new Date().toISOString(),
      },
    ];
    window.localStorage.setItem("itranslate.setup.done", "1");
    window.localStorage.setItem("itranslate.engines.v1", JSON.stringify(engines));
    window.localStorage.setItem("itranslate.default-engine.v1", "e-1");
  });

  await page.goto("/");
  await page.getByRole("button", { name: "翻译引擎" }).click();
  await expect(page.locator(".history-table tbody tr")).toHaveCount(3);

  await page.getByLabel("引擎搜索").fill("远端");
  await expect(page.locator(".history-table tbody tr")).toHaveCount(1);

  await page.getByLabel("引擎搜索").fill("");
  await page.getByLabel("筛选提供方").selectOption("custom");
  await expect(page.locator(".history-table tbody tr")).toHaveCount(2);

  await page.getByLabel("筛选提供方").selectOption("");
  await page.getByLabel("筛选引擎状态").selectOption("deleted");
  await expect(page.locator(".history-table tbody tr")).toHaveCount(1);
});
