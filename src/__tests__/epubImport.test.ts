import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import {
  buildEpubHistoryTitle,
  buildTranslatedEpubFileName,
  parseEpubFile,
} from "../services/epubImport";

function createFileFromBlob(blob: Blob, name: string): File {
  return new File([blob], name, { type: "application/epub+zip" });
}

describe("epubImport", () => {
  it("可解析 epub 章节与元信息", async () => {
    const zip = new JSZip();
    zip.file("META-INF/container.xml", "<root/>");
    zip.file(
      "OEBPS/content.opf",
      `<?xml version="1.0"?>
      <package xmlns:dc="http://purl.org/dc/elements/1.1/">
        <metadata>
          <dc:title>Book A</dc:title>
          <dc:creator>Author A</dc:creator>
          <dc:language>en</dc:language>
        </metadata>
      </package>`,
    );
    zip.file("OEBPS/chapter-1.xhtml", "<h1>A</h1><p>Hello</p>");
    zip.file("OEBPS/nav.xhtml", "<nav>TOC</nav>");

    const file = createFileFromBlob(await zip.generateAsync({ type: "blob" }), "Sample.epub");
    const parsed = await parseEpubFile(file);

    expect(parsed.fileNameBase).toBe("Sample");
    expect(parsed.metaTitle).toBe("Book A");
    expect(parsed.metaAuthor).toBe("Author A");
    expect(parsed.metaLanguage).toBe("en");
    expect(parsed.chapters).toHaveLength(1);
    expect(parsed.chapters[0].fileName).toBe("chapter-1.xhtml");
    expect(parsed.chapters[0].markdown).toContain("Hello");
  });

  it("可生成历史标题与导出文件名", () => {
    const title = buildEpubHistoryTitle("MyBook", "chapter-1.xhtml");
    expect(title).toContain("MyBook");
    expect(title).toContain("chapter-1.xhtml");

    const outputName = buildTranslatedEpubFileName("MyBook");
    expect(outputName).toBe("MyBook_已翻译.epub");
  });
});
