import JSZip from "jszip";
import { preprocessInput } from "./preprocess";

const EPUB_TITLE_SEPARATOR = " ⟫ ";

export interface ImportedEpubChapter {
  fileName: string;
  html: string;
  markdown: string;
}

export interface ImportedEpubBook {
  fileNameBase: string;
  metaTitle: string;
  metaAuthor: string;
  metaLanguage: string;
  chapters: ImportedEpubChapter[];
}

function decodeXmlEntities(input: string): string {
  return input
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'");
}

function sanitizeTitlePart(input: string): string {
  const clean = input
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .trim();
  return clean || "未命名";
}

function stripExtension(fileName: string): string {
  return fileName.replace(/\.[^./\\]+$/, "");
}

function basename(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");
  return normalized.slice(normalized.lastIndexOf("/") + 1);
}

function parseMetaValue(opfText: string, tag: string): string {
  const pattern = new RegExp(`<dc:${tag}[^>]*>([\\s\\S]*?)</dc:${tag}>`, "i");
  const match = opfText.match(pattern);
  if (!match?.[1]) {
    return "";
  }
  return decodeXmlEntities(match[1].replace(/<[^>]*>/g, "").trim());
}

function shouldSkipHtml(path: string): boolean {
  const lower = path.toLowerCase();
  if (lower.startsWith("meta-inf/")) {
    return true;
  }
  const base = basename(lower);
  return base.includes("nav") || base.includes("toc") || base.includes("contents");
}

export function buildEpubHistoryTitle(epubFileNameBase: string, htmlFileName: string): string {
  return `${sanitizeTitlePart(epubFileNameBase)}${EPUB_TITLE_SEPARATOR}${sanitizeTitlePart(htmlFileName)}`;
}

export function buildTranslatedEpubFileName(epubFileNameBase: string): string {
  return `${sanitizeTitlePart(epubFileNameBase)}_已翻译.epub`;
}

export async function parseEpubFile(file: File): Promise<ImportedEpubBook> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const entries = Object.keys(zip.files);
  const htmlEntries = entries
    .filter((path) => !zip.files[path].dir)
    .filter((path) => /\.(xhtml|html|htm)$/i.test(path))
    .filter((path) => !shouldSkipHtml(path))
    .sort((a, b) => a.localeCompare(b, "en"));

  const chapters: ImportedEpubChapter[] = [];
  for (const path of htmlEntries) {
    const html = await zip.files[path].async("string");
    const markdown = preprocessInput(html).markdown;
    if (!markdown.trim()) {
      continue;
    }
    chapters.push({
      fileName: basename(path),
      html,
      markdown,
    });
  }

  const opfPath = entries.find((path) => path.toLowerCase().endsWith(".opf"));
  let metaTitle = "";
  let metaAuthor = "";
  let metaLanguage = "";
  if (opfPath) {
    const opfText = await zip.files[opfPath].async("string");
    metaTitle = parseMetaValue(opfText, "title");
    metaAuthor = parseMetaValue(opfText, "creator");
    metaLanguage = parseMetaValue(opfText, "language");
  }

  return {
    fileNameBase: stripExtension(file.name),
    metaTitle,
    metaAuthor,
    metaLanguage,
    chapters,
  };
}
