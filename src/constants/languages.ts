import type { LanguageOption, TranslatorModelConfig } from "../types";

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: "English", label: "英语 (English)" },
  { code: "Simplified Chinese", label: "简体中文" },
  { code: "Traditional Chinese", label: "繁体中文" },
  { code: "Japanese", label: "日语" },
  { code: "Korean", label: "韩语" },
  { code: "French", label: "法语" },
  { code: "German", label: "德语" },
  { code: "Spanish", label: "西班牙语" },
  { code: "Russian", label: "俄语" },
];

export const DEFAULT_SOURCE_LANGUAGE = "English";
export const DEFAULT_TARGET_LANGUAGE = "Simplified Chinese";

export const DEFAULT_MODEL_CONFIG: TranslatorModelConfig = {
  id: "ollama-translategemma",
  provider: "ollama",
  label: "Ollama / translategemma",
  endpoint: import.meta.env.VITE_OLLAMA_ENDPOINT ?? "http://127.0.0.1:11434",
  model: import.meta.env.VITE_OLLAMA_MODEL ?? "translategemma",
  enabled: true,
};

export const APP_NAME = "iTranslate";
export const UPDATE_METADATA_URL =
  "https://github.com/your-org/itranslate/releases/latest/download/latest.json";
export const APP_BUILD_NUMBER = 1;
export const HISTORY_PAGE_SIZE = 8;
