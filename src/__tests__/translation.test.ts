import { describe, expect, it } from "vitest";
import {
  buildTranslategemmaPrompt,
  shouldSkipTranslation,
  splitMarkdownIntoTranslationChunks,
} from "../services/translation";

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

describe("shouldSkipTranslation", () => {
  it("源语言与目标语言一致时返回 true", () => {
    expect(shouldSkipTranslation("Japanese", "Japanese")).toBe(true);
    expect(shouldSkipTranslation(" japanese ", "JAPANESE")).toBe(true);
  });

  it("源语言与目标语言不一致时返回 false", () => {
    expect(shouldSkipTranslation("English", "Japanese")).toBe(false);
  });
});

describe("splitMarkdownIntoTranslationChunks", () => {
  it("短文本保持单块", () => {
    const chunks = splitMarkdownIntoTranslationChunks("## Title\n\nHello world", 3200);
    expect(chunks).toHaveLength(1);
  });

  it("长文本按段落拆分为多块", () => {
    const source = [
      "## A",
      "",
      "x".repeat(1800),
      "",
      "## B",
      "",
      "y".repeat(1800),
      "",
      "## C",
      "",
      "z".repeat(1800),
    ].join("\n");
    const chunks = splitMarkdownIntoTranslationChunks(source, 2200);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join("\n\n")).toContain("## A");
    expect(chunks.join("\n\n")).toContain("## C");
  });
});
