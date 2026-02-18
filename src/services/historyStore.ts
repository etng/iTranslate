import { invoke } from "@tauri-apps/api/core";
import type { TranslationHistoryItem } from "../types";
import { isTauriRuntime } from "../utils/runtime";

const HISTORY_KEY = "itranslate.history.v1";
const HISTORY_MIGRATED_KEY = "itranslate.history.migrated.sqlite.v1";

function loadHistoryFromLocalStorage(): TranslationHistoryItem[] {
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

function saveHistoryToLocalStorage(items: TranslationHistoryItem[]): void {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(items));
}

async function listFromSqlite(): Promise<TranslationHistoryItem[]> {
  return invoke<TranslationHistoryItem[]>("history_list");
}

export async function loadHistory(): Promise<TranslationHistoryItem[]> {
  if (!isTauriRuntime()) {
    return loadHistoryFromLocalStorage();
  }
  return listFromSqlite();
}

export async function saveHistory(items: TranslationHistoryItem[]): Promise<TranslationHistoryItem[]> {
  if (!isTauriRuntime()) {
    saveHistoryToLocalStorage(items);
    return loadHistoryFromLocalStorage();
  }
  return invoke<TranslationHistoryItem[]>("history_replace_all", { payload: items });
}

export async function upsertHistory(item: TranslationHistoryItem): Promise<TranslationHistoryItem[]> {
  if (!isTauriRuntime()) {
    const existing = loadHistoryFromLocalStorage();
    const next = [item, ...existing.filter((entry) => entry.id !== item.id)];
    saveHistoryToLocalStorage(next);
    return next;
  }
  return invoke<TranslationHistoryItem[]>("history_upsert", { payload: item });
}

export async function deleteHistoryById(id: string): Promise<TranslationHistoryItem[]> {
  if (!isTauriRuntime()) {
    const next = loadHistoryFromLocalStorage().filter((item) => item.id !== id);
    saveHistoryToLocalStorage(next);
    return next;
  }
  return invoke<TranslationHistoryItem[]>("history_delete", { id });
}

export async function replaceHistory(item: TranslationHistoryItem): Promise<TranslationHistoryItem[]> {
  return upsertHistory(item);
}

export async function renameHistoryTitle(id: string, title: string): Promise<TranslationHistoryItem[]> {
  if (!isTauriRuntime()) {
    const next = loadHistoryFromLocalStorage().map((item) => (item.id === id ? { ...item, title } : item));
    saveHistoryToLocalStorage(next);
    return next;
  }
  return invoke<TranslationHistoryItem[]>("history_rename", { payload: { id, title } });
}

export async function ensureHistoryMigratedFromLocalStorage(): Promise<void> {
  if (!isTauriRuntime()) {
    return;
  }
  if (localStorage.getItem(HISTORY_MIGRATED_KEY) === "1") {
    return;
  }

  const legacyItems = loadHistoryFromLocalStorage();
  if (legacyItems.length > 0) {
    await saveHistory(legacyItems);
  }
  localStorage.setItem(HISTORY_MIGRATED_KEY, "1");
}

export function createAutoTitle(text: string): string {
  const firstLine = text.split("\n").find((line) => line.trim().length > 0) ?? "未命名翻译";
  const clean = firstLine.replace(/^#+\s*/, "").trim();
  return clean.length > 24 ? `${clean.slice(0, 24)}...` : clean;
}
