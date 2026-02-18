import { describe, expect, it } from "vitest";
import { preprocessInput } from "../services/preprocess";

describe("preprocessInput", () => {
  it("HTML 输入会转换为 Markdown", () => {
    const result = preprocessInput("<h1>标题</h1><p>正文</p>");
    expect(result.detectedHtml).toBe(true);
    expect(result.markdown).toContain("# 标题");
    expect(result.markdown).toContain("正文");
  });

  it("普通文本保持不变", () => {
    const result = preprocessInput("hello\nworld");
    expect(result.detectedHtml).toBe(false);
    expect(result.markdown).toBe("hello\nworld");
  });
});
