import { describe, expect, it } from "vitest";
import { buildTranslategemmaPrompt } from "../services/translation";

describe("buildTranslategemmaPrompt", () => {
  it("包含 translategemma 指定 prompt format 前缀", () => {
    const prompt = buildTranslategemmaPrompt("English", "Simplified Chinese", "Hello");
    expect(
      prompt.startsWith(
        "You are a professional English (en) to Simplified Chinese (zh-CN) translator.",
      ),
    ).toBe(true);
    expect(prompt.endsWith("\n\n\nHello")).toBe(true);
  });
});
