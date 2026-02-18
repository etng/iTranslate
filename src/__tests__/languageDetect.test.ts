import { describe, expect, it } from "vitest";
import { detectSourceLanguage } from "../services/languageDetect";

describe("detectSourceLanguage", () => {
  it("识别英文文本", () => {
    const text = "This is a simple test paragraph in English with enough words to detect language.";
    expect(detectSourceLanguage(text)).toBe("English");
  });

  it("识别简体中文文本", () => {
    const text = "这是一个用于测试语言自动识别的中文段落，应该被判断为简体中文。";
    expect(detectSourceLanguage(text)).toBe("Simplified Chinese");
  });

  it("识别日文文本", () => {
    const text = "これは言語自動検出を確認するための日本語テキストです。";
    expect(detectSourceLanguage(text)).toBe("Japanese");
  });

  it("过短文本返回空", () => {
    expect(detectSourceLanguage("hi")).toBeNull();
  });
});
