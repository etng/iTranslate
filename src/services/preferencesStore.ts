import type { UserPreferences } from "../types";

const PREFERENCES_KEY = "itranslate.preferences.v1";

const DEFAULT_PREFERENCES: UserPreferences = {
  epubDefaultAuthor: "iTranslate",
  epubDefaultExportDir: null,
};

export function loadPreferences(): UserPreferences {
  try {
    const raw = localStorage.getItem(PREFERENCES_KEY);
    if (!raw) {
      return DEFAULT_PREFERENCES;
    }
    const parsed = JSON.parse(raw) as Partial<UserPreferences>;
    return {
      epubDefaultAuthor: parsed.epubDefaultAuthor?.trim() || DEFAULT_PREFERENCES.epubDefaultAuthor,
      epubDefaultExportDir: parsed.epubDefaultExportDir ?? DEFAULT_PREFERENCES.epubDefaultExportDir,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function savePreferences(next: UserPreferences): void {
  localStorage.setItem(PREFERENCES_KEY, JSON.stringify(next));
}
