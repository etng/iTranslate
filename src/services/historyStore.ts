import type { TranslationHistoryItem } from "../types";

const HISTORY_KEY = "itranslate.history.v1";

export function loadHistory(): TranslationHistoryItem[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as TranslationHistoryItem[];
    return [...parsed].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return [];
  }
}

export function saveHistory(items: TranslationHistoryItem[]): void {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(items));
}

export function upsertHistory(item: TranslationHistoryItem): TranslationHistoryItem[] {
  const existing = loadHistory();
  const next = [item, ...existing.filter((entry) => entry.id !== item.id)];
  saveHistory(next);
  return next;
}

export function renameHistoryTitle(id: string, title: string): TranslationHistoryItem[] {
  const next = loadHistory().map((item) => (item.id === id ? { ...item, title } : item));
  saveHistory(next);
  return next;
}

export function createAutoTitle(text: string): string {
  const firstLine = text.split("\n").find((line) => line.trim().length > 0) ?? "未命名翻译";
  const clean = firstLine.replace(/^#+\s*/, "").trim();
  return clean.length > 24 ? `${clean.slice(0, 24)}...` : clean;
}
