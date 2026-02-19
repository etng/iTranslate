import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { buildBilingualEpubBlob } from "../services/epub";
import type { TranslationHistoryItem } from "../types";

function createHistoryItem(id: string, source: string, target: string, title = "章节测试"): TranslationHistoryItem {
  return {
    id,
    title,
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

  it("日文竖排模式应输出 rtl 翻页与纵向排版样式", async () => {
    const chapter = createHistoryItem(
      "ja-case",
      "## Chapter I\n\nThere was no possibility of taking a walk that day.",
      "## 第1章\n\nその日は散歩に出ることはできなかった。",
      "Chapter I",
    );
    const blob = await buildBilingualEpubBlob([chapter], {
      title: "日本語テスト本",
      author: "著者",
      language: "ja",
      identifier: "ja-book-id",
      layoutMode: "ja-vertical",
      contentMode: "translated-only",
    });

    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const opf = await zip.file("OEBPS/content.opf")?.async("string");
    const styles = await zip.file("OEBPS/styles.css")?.async("string");
    const chapterXhtml = await zip.file("OEBPS/chapter-1.xhtml")?.async("string");

    expect(opf).toContain('page-progression-direction="rtl"');
    expect(styles).toContain("html{writing-mode:vertical-rl");
    expect(styles).toContain("body{display:block");
    expect(styles).toContain("writing-mode:inherit");
    expect(styles).toContain("writing-mode:vertical-rl");
    expect(styles).not.toContain("direction:rtl");
    expect(chapterXhtml).toContain('xml:lang="ja"');
    expect(chapterXhtml).not.toContain("<h2>原文</h2>");
    expect(chapterXhtml).toContain("<h1>第1章</h1>");
  });
});
