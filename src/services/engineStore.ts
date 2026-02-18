import { DEFAULT_MODEL_CONFIG } from "../constants/languages";
import type { EngineStoreState, TranslatorModelConfig } from "../types";

const ENGINE_KEY = "itranslate.engines.v1";
const DEFAULT_ENGINE_KEY = "itranslate.default-engine.v1";

export function loadEngineState(): EngineStoreState {
  const engines = loadEngines();
  const defaultEngineId = localStorage.getItem(DEFAULT_ENGINE_KEY);

  if (engines.length === 0) {
    return { engines: [], defaultEngineId: null };
  }

  if (!defaultEngineId) {
    return { engines, defaultEngineId: engines[0].id };
  }

  return { engines, defaultEngineId };
}

export function loadEngines(): TranslatorModelConfig[] {
  try {
    const raw = localStorage.getItem(ENGINE_KEY);
    if (!raw) {
      return [DEFAULT_MODEL_CONFIG];
    }

    const parsed = JSON.parse(raw) as TranslatorModelConfig[];
    return parsed;
  } catch {
    return [DEFAULT_MODEL_CONFIG];
  }
}

export function saveEngineState(state: EngineStoreState): void {
  localStorage.setItem(ENGINE_KEY, JSON.stringify(state.engines));
  if (state.defaultEngineId) {
    localStorage.setItem(DEFAULT_ENGINE_KEY, state.defaultEngineId);
  } else {
    localStorage.removeItem(DEFAULT_ENGINE_KEY);
  }
}

export function createNewEngineTemplate(): TranslatorModelConfig {
  return {
    id: crypto.randomUUID(),
    provider: "custom",
    label: "自定义引擎",
    name: "未命名引擎",
    endpoint: "",
    model: "",
    apiToken: "",
    username: "",
    password: "",
    enabled: true,
    deletedAt: null,
  };
}

export function markEngineDeleted(
  state: EngineStoreState,
  engineId: string,
): EngineStoreState {
  const engines = state.engines.map((engine) =>
    engine.id === engineId ? { ...engine, enabled: false, deletedAt: new Date().toISOString() } : engine,
  );

  const defaultEngineId = state.defaultEngineId === engineId ? null : state.defaultEngineId;
  const next = { engines, defaultEngineId };
  saveEngineState(next);
  return next;
}

export function upsertEngine(
  state: EngineStoreState,
  engine: TranslatorModelConfig,
): EngineStoreState {
  const exists = state.engines.some((entry) => entry.id === engine.id);
  const engines = exists
    ? state.engines.map((entry) => (entry.id === engine.id ? engine : entry))
    : [engine, ...state.engines];

  const defaultEngineId = state.defaultEngineId ?? engine.id;
  const next = { engines, defaultEngineId };
  saveEngineState(next);
  return next;
}

export function setDefaultEngine(
  state: EngineStoreState,
  engineId: string,
): EngineStoreState {
  const next = { ...state, defaultEngineId: engineId };
  saveEngineState(next);
  return next;
}

export function getAvailableEngines(engines: TranslatorModelConfig[]): TranslatorModelConfig[] {
  return engines.filter((engine) => engine.enabled && !engine.deletedAt);
}
