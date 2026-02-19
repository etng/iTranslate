/// <reference types="node" />

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { parseEpubFile } from "../services/epubImport";
import { preprocessInput } from "../services/preprocess";
import { splitMarkdownIntoTranslationChunks } from "../services/translation";

const FIXTURE_EPUB_PATH = path.join(
  process.cwd(),
  "src/__tests__/fixtures/New Ideas from Dead Economists -- The Introduction to Modern economic thought -  Todd G_ Buchholz .epub",
);

describe("epub fixture 回归", () => {
  it("可解析真实 EPUB 并覆盖长章节分块场景", async () => {
    if (!existsSync(FIXTURE_EPUB_PATH)) {
      // 本地未放置该大文件时跳过（CI 环境通常不会存在）
      expect(true).toBe(true);
      return;
    }

    const buffer = readFileSync(FIXTURE_EPUB_PATH);
    const zip = await JSZip.loadAsync(buffer);
    const entryKeys = Object.keys(zip.files);
    expect(entryKeys.length).toBeGreaterThan(10);

    const targetEntry = entryKeys.find((key) => key.endsWith("07_Preface_to_the_Revise.xhtml"));
    expect(targetEntry).toBeTruthy();

    const html = await zip.files[targetEntry!].async("string");
    const markdown = preprocessInput(html).markdown;
    expect(markdown.length).toBeGreaterThan(10000);

    const chunks = splitMarkdownIntoTranslationChunks(markdown, 3200);
    expect(chunks.length).toBeGreaterThan(2);
    expect(chunks.every((chunk) => chunk.length <= 3200)).toBe(true);

    const file = new File([buffer], "fixture.epub", { type: "application/epub+zip" });
    const parsed = await parseEpubFile(file);
    expect(parsed.chapters.length).toBeGreaterThan(20);
    expect(parsed.chapters.some((chapter) => chapter.fileName.includes("07_Preface_to_the_Revise"))).toBe(true);
  });
});
