import { expect, test } from "@playwright/test";

test("初始化向导与翻译主流程", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("iTranslate 初始化向导")).toBeVisible();
  await page.getByRole("button", { name: "验证并进入" }).click();

  await expect(page.getByRole("button", { name: "开始翻译" })).toBeVisible();
  await page.getByPlaceholder("支持粘贴普通文本或 HTML，HTML 会先转换为 Markdown 再翻译").fill("<h1>Hello</h1>");
  await page.getByRole("button", { name: "开始翻译" }).click();

  await expect(page.getByText("翻译完成（输入已先转换为 Markdown）")).toBeVisible();
  await expect(page.getByText("[浏览器调试模式]")).toBeVisible();

  await page.getByRole("button", { name: "历史记录" }).click();
  await expect(page.getByRole("heading", { name: "历史记录" })).toBeVisible();
});
