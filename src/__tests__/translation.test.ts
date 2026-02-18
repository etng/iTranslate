import { describe, expect, it } from "vitest";
import { buildTranslategemmaPrompt } from "../services/translation";

describe("buildTranslategemmaPrompt", () => {
  it("包含 translategemma 指定 prompt format 前缀", () => {
    const prompt = buildTranslategemmaPrompt("English", "Simplified Chinese", "Hello");
    expect(prompt.startsWith("Translate from English to Simplified Chinese.\nSource: English: Hello\nTranslation: Simplified Chinese:")).toBe(true);
    expect(prompt).toContain("请严格保留 Markdown 结构与层级");
  });
});
