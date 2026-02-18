import { marked } from "marked";
import DOMPurify from "dompurify";

marked.setOptions({
  gfm: true,
  breaks: true,
});

export function renderMarkdownToHtml(markdown: string): string {
  const raw = marked.parse(markdown) as string;
  return DOMPurify.sanitize(raw);
}

export function normalizeMarkdownText(markdown: string): string {
  return markdown.replace(/\r\n/g, "\n").trim();
}
