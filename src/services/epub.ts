import JSZip from "jszip";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { renderMarkdownToHtml } from "./markdown";
import type { TranslationHistoryItem } from "../types";
import { isTauriRuntime } from "../utils/runtime";

interface EpubChapter {
  id: string;
  title: string;
  sourceMarkdown: string;
  targetMarkdown: string;
}

export interface EpubOptions {
  title: string;
  author: string;
  language: string;
  identifier: string;
}

function xmlEscape(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function normalizeXhtmlEntities(html: string): string {
  const reserved = new Set(["amp", "lt", "gt", "quot", "apos"]);
  return html.replace(/&([a-zA-Z][a-zA-Z0-9]+);/g, (full, name: string) => {
    if (reserved.has(name)) {
      return full;
    }

    if (typeof document !== "undefined") {
      const textarea = document.createElement("textarea");
      textarea.innerHTML = full;
      const decoded = textarea.value;
      if (decoded && decoded !== full) {
        return decoded;
      }
    }

    if (name === "nbsp") {
      return "&#160;";
    }
    return full;
  });
}

function createChapterXhtml(chapter: EpubChapter): string {
  const sourceHtml = normalizeXhtmlEntities(renderMarkdownToHtml(chapter.sourceMarkdown));
  const targetHtml = normalizeXhtmlEntities(renderMarkdownToHtml(chapter.targetMarkdown));

  return `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="zh-CN">
  <head>
    <meta charset="utf-8"/>
    <title>${xmlEscape(chapter.title)}</title>
    <link rel="stylesheet" type="text/css" href="styles.css"/>
  </head>
  <body>
    <h1>${xmlEscape(chapter.title)}</h1>
    <section>
      <h2>原文</h2>
      ${sourceHtml}
    </section>
    <section>
      <h2>译文</h2>
      ${targetHtml}
    </section>
  </body>
</html>`;
}

export async function buildBilingualEpubBlob(
  historyItems: TranslationHistoryItem[],
  options: EpubOptions,
): Promise<Blob> {
  const chapters: EpubChapter[] = historyItems.map((item, index) => ({
    id: `chap-${index + 1}`,
    title: item.title || `章节 ${index + 1}`,
    sourceMarkdown: item.inputMarkdown,
    targetMarkdown: item.outputMarkdown,
  }));

  const zip = new JSZip();
  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });

  const metaInf = zip.folder("META-INF");
  metaInf?.file(
    "container.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`,
  );

  const oebps = zip.folder("OEBPS");
  oebps?.file(
    "styles.css",
    "body{font-family:serif;line-height:1.6;}h1,h2{page-break-after:avoid;}section{margin-bottom:1.5em;}",
  );

  chapters.forEach((chapter, index) => {
    oebps?.file(`chapter-${index + 1}.xhtml`, createChapterXhtml(chapter));
  });

  const manifestItems = chapters
    .map((_, index) => `<item id="c${index + 1}" href="chapter-${index + 1}.xhtml" media-type="application/xhtml+xml"/>`)
    .join("\n    ");
  const spineItems = chapters.map((_, index) => `<itemref idref="c${index + 1}"/>`).join("\n    ");
  const navPoints = chapters
    .map((chapter, index) => `    <navPoint id="n${index + 1}" playOrder="${index + 1}">
      <navLabel><text>${xmlEscape(chapter.title)}</text></navLabel>
      <content src="chapter-${index + 1}.xhtml"/>
    </navPoint>`)
    .join("\n");
  const navList = chapters
    .map((chapter, index) => `<li><a href="chapter-${index + 1}.xhtml">${xmlEscape(chapter.title)}</a></li>`)
    .join("");

  oebps?.file(
    "toc.ncx",
    `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head><meta name="dtb:uid" content="${xmlEscape(options.identifier)}"/></head>
  <docTitle><text>${xmlEscape(options.title)}</text></docTitle>
  <navMap>
${navPoints}
  </navMap>
</ncx>`,
  );

  oebps?.file(
    "nav.xhtml",
    `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="zh-CN">
  <head><meta charset="utf-8"/><title>目录</title></head>
  <body>
    <nav epub:type="toc" xmlns:epub="http://www.idpf.org/2007/ops">
      <h1>目录</h1>
      <ol>${navList}</ol>
    </nav>
  </body>
</html>`,
  );

  oebps?.file(
    "content.opf",
    `<?xml version="1.0" encoding="UTF-8"?>
<package version="3.0" unique-identifier="bookid" xmlns="http://www.idpf.org/2007/opf">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">${xmlEscape(options.identifier)}</dc:identifier>
    <dc:title>${xmlEscape(options.title)}</dc:title>
    <dc:language>${xmlEscape(options.language)}</dc:language>
    <dc:creator>${xmlEscape(options.author)}</dc:creator>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" properties="nav" media-type="application/xhtml+xml"/>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="css" href="styles.css" media-type="text/css"/>
    ${manifestItems}
  </manifest>
  <spine toc="ncx">
    ${spineItems}
  </spine>
</package>`,
  );

  return zip.generateAsync({ type: "blob" });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function saveEpubByPicker(
  blob: Blob,
  filename: string,
  defaultDir?: string | null,
): Promise<string | null> {
  if (!isTauriRuntime()) {
    downloadBlob(blob, filename);
    return null;
  }

  const defaultPath = defaultDir ? `${defaultDir}/${filename}` : filename;
  const selected = await save({
    defaultPath,
    filters: [{ name: "EPUB", extensions: ["epub"] }],
  });

  if (!selected || typeof selected !== "string") {
    return null;
  }

  const bytes = Array.from(new Uint8Array(await blob.arrayBuffer()));
  await invoke("save_binary_file", { payload: { path: selected, bytes } });
  return selected;
}
