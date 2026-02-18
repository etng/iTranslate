export type TranslateProvider = "ollama" | "custom";

export interface LanguageOption {
  code: string;
  label: string;
}

export interface TranslatorModelConfig {
  id: string;
  provider: TranslateProvider;
  label: string;
  name: string;
  endpoint: string;
  model: string;
  apiToken?: string;
  username?: string;
  password?: string;
  enabled: boolean;
  deletedAt?: string | null;
}

export interface TranslateRequest {
  sourceLanguage: string;
  targetLanguage: string;
  inputRaw: string;
  inputMarkdown: string;
  modelConfig: TranslatorModelConfig;
}

export interface TranslateResult {
  outputMarkdown: string;
  usedPrompt: string;
}

export interface TranslationHistoryItem {
  id: string;
  title: string;
  createdAt: string;
  sourceLanguage: string;
  targetLanguage: string;
  inputRaw: string;
  inputMarkdown: string;
  outputMarkdown: string;
  provider: TranslateProvider;
  model: string;
  engineId: string;
  engineName: string;
  engineDeleted: boolean;
}

export interface OllamaHealthStatus {
  reachable: boolean;
  modelInstalled: boolean;
  models: string[];
  message: string;
}

export interface UpdateMetadata {
  version: string;
  buildNumber: number;
  notes?: string;
  downloadUrl?: string;
}

export interface EngineStoreState {
  engines: TranslatorModelConfig[];
  defaultEngineId: string | null;
}

export interface UserPreferences {
  epubDefaultAuthor: string;
  epubDefaultExportDir: string | null;
}
