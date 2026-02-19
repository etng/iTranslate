import JSZip from "jszip";
import { preprocessInput } from "./preprocess";

const EPUB_SOURCE_SEPARATOR = " ⟫ ";

export interface ImportedEpubChapter {
  fileName: string;
  html: string;
  markdown: string;
  title: string;
  order: number;
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

export function buildEpubSourceLabel(epubFileNameBase: string, htmlFileName: string): string {
  return `${sanitizeTitlePart(epubFileNameBase)}${EPUB_SOURCE_SEPARATOR}${sanitizeTitlePart(htmlFileName)}`;
}

export function resolveTargetLanguageFileSuffix(targetLanguage: string): string {
  const normalized = targetLanguage.trim().toLowerCase();
  if (!normalized) return "unknown";
  if (["japanese", "ja", "ja-jp", "日语", "日本語"].includes(normalized)) return "Japanese";
  if (["english", "en", "英语"].includes(normalized)) return "English";
  if (["simplified chinese", "zh-cn", "简体中文"].includes(normalized)) return "SimplifiedChinese";
  if (["traditional chinese", "zh-tw", "繁体中文"].includes(normalized)) return "TraditionalChinese";
  if (["korean", "ko", "韩语"].includes(normalized)) return "Korean";
  if (["french", "fr", "法语"].includes(normalized)) return "French";
  if (["german", "de", "德语"].includes(normalized)) return "German";
  if (["spanish", "es", "西班牙语"].includes(normalized)) return "Spanish";
  if (["russian", "ru", "俄语"].includes(normalized)) return "Russian";
  return sanitizeTitlePart(targetLanguage).replace(/\s+/g, "");
}

export function buildTranslatedEpubFileName(epubFileNameBase: string, targetLanguage: string): string {
  return `${sanitizeTitlePart(epubFileNameBase)}_已翻译_${resolveTargetLanguageFileSuffix(targetLanguage)}.epub`;
}

function extractChapterTitle(markdown: string, fallbackFileName: string): string {
  const lines = markdown
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    const headingMatch = line.match(/^#{1,6}\s+(.+)$/);
    if (headingMatch?.[1]) {
      return headingMatch[1].trim();
    }
  }

  const plainLine = lines.find((line) => line.length > 0);
  if (plainLine) {
    return plainLine.length > 80 ? `${plainLine.slice(0, 80)}...` : plainLine;
  }

  return sanitizeTitlePart(stripExtension(fallbackFileName));
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
    const fileName = basename(path);
    chapters.push({
      fileName,
      html,
      markdown,
      title: extractChapterTitle(markdown, fileName),
      order: chapters.length + 1,
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
