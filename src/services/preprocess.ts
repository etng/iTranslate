import TurndownService from "turndown";
import { normalizeMarkdownText } from "./markdown";

const turndownService = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
  emDelimiter: "_",
});

turndownService.keep(["table", "thead", "tbody", "tr", "th", "td"]);

export interface PreprocessResult {
  markdown: string;
  detectedHtml: boolean;
}

export function looksLikeHtml(input: string): boolean {
  const trimmed = input.trim();
  return /<([a-z][^\s/>]*)(.*?)>/i.test(trimmed) && /<\/[a-z][^>]*>/i.test(trimmed);
}

export function preprocessInput(rawInput: string): PreprocessResult {
  const detectedHtml = looksLikeHtml(rawInput);
  const markdown = detectedHtml
    ? turndownService.turndown(rawInput)
    : rawInput;

  return {
    markdown: normalizeMarkdownText(markdown),
    detectedHtml,
  };
}
