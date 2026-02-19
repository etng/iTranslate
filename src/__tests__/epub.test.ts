import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { buildBilingualEpubBlob } from "../services/epub";
import type { TranslationHistoryItem } from "../types";

function createHistoryItem(id: string, source: string, target: string): TranslationHistoryItem {
  return {
    id,
    title: "章节测试",
    sourceLanguage: "英语",
    targetLanguage: "简体中文",
    createdAt: new Date().toISOString(),
    inputRaw: source,
    inputMarkdown: source,
    outputMarkdown: target,
    provider: "ollama",
    model: "translategemma",
    engineId: "engine-1",
    engineName: "测试引擎",
    engineDeleted: false,
  };
}

describe("epub 导出 XHTML 兼容性", () => {
  it("应将 Markdown 图片转换为合法 XHTML", async () => {
    const chapter = createHistoryItem(
      "img-case",
      "![cover](https://example.com/cover.jpg)\n\n正文段落",
      "![封面](https://example.com/cover-cn.jpg)\n\n译文段落",
    );
    const blob = await buildBilingualEpubBlob([chapter], {
      title: "测试书",
      author: "作者",
      language: "zh-CN",
      identifier: "test-book-id",
    });

    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const xhtml = await zip.file("OEBPS/chapter-1.xhtml")?.async("string");

    expect(xhtml).toBeTruthy();
    expect(xhtml).toContain("<img ");
    expect(xhtml).toContain(" />");

    const parser = new DOMParser();
    const doc = parser.parseFromString(xhtml!, "application/xml");
    expect(doc.querySelector("parsererror")).toBeNull();
  });
});
