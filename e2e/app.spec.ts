import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

interface ChapterSection {
  title: string;
  markdown: string;
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
  await expect(page.getByRole("button", { name: "开始翻译" })).toBeVisible();

  for (const chapter of chapters) {
    await page
      .getByPlaceholder("支持粘贴普通文本或 HTML，HTML 会先转换为 Markdown 再翻译")
      .fill(chapter.markdown);
    await page.getByRole("button", { name: "开始翻译" }).click();
    await expect(page.getByText("翻译完成")).toBeVisible();
  }

  await page.getByRole("button", { name: "历史记录" }).click();
  await expect(page.getByRole("heading", { name: "历史记录" })).toBeVisible();

  const latestTitle = chapters[chapters.length - 1].title;
  await expect(page.locator(`input[value="${latestTitle}"]`)).toBeVisible();

  await expect(page.getByRole("button", { name: "2" })).toBeVisible();
  await page.getByRole("button", { name: "2" }).click();
  await expect(page.locator(".pagination .active")).toHaveText("2");

  await page.getByRole("button", { name: "查看" }).first().click();
  await expect(page.getByRole("button", { name: "返回历史列表" })).toBeVisible();
  await expect(page.getByLabel("源语言")).toBeDisabled();
  await expect(page.getByLabel("目标语言")).toBeDisabled();

  await page.getByRole("button", { name: "返回历史列表" }).click();
  await expect(page.locator(".pagination .active")).toHaveText("2");
});
