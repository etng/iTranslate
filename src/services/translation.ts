import { invoke } from "@tauri-apps/api/core";
import type { OllamaHealthStatus, TranslateRequest, TranslateResult } from "../types";
import { isTauriRuntime } from "../utils/runtime";

interface TranslateCommandPayload {
  endpoint: string;
  model: string;
  prompt: string;
  apiToken?: string;
  username?: string;
  password?: string;
}

interface TranslateCommandResult {
  text: string;
}

interface OllamaHealthPayload {
  endpoint: string;
  model: string;
}

const LANGUAGE_CODE_MAP: Record<string, string> = {
  English: "en",
  "Simplified Chinese": "zh-CN",
  "Traditional Chinese": "zh-TW",
  Japanese: "ja",
  Korean: "ko",
  French: "fr",
  German: "de",
  Spanish: "es",
  Russian: "ru",
};

function resolveLanguageCode(languageName: string): string {
  return LANGUAGE_CODE_MAP[languageName] ?? languageName.toLowerCase().replace(/\s+/g, "-");
}

export function buildTranslategemmaPrompt(
  sourceLanguage: string,
  targetLanguage: string,
  sourceText: string,
): string {
  const sourceCode = resolveLanguageCode(sourceLanguage);
  const targetCode = resolveLanguageCode(targetLanguage);

  return `You are a professional ${sourceLanguage} (${sourceCode}) to ${targetLanguage} (${targetCode}) translator. Your goal is to accurately convey the meaning and nuances of the original ${sourceLanguage} text while adhering to ${targetLanguage} grammar, vocabulary, and cultural sensitivities.
Produce only the ${targetLanguage} translation, without any additional explanations or commentary. Please translate the following ${sourceLanguage} text into ${targetLanguage}:


${sourceText}`;
}

export async function checkOllamaHealth(
  endpoint: string,
  model: string,
): Promise<OllamaHealthStatus> {
  if (!isTauriRuntime()) {
    return {
      reachable: true,
      modelInstalled: true,
      models: [model],
      message: "浏览器调试模式：跳过 Ollama 校验",
    };
  }

  return invoke<OllamaHealthStatus>("check_ollama_health", {
    payload: { endpoint, model } satisfies OllamaHealthPayload,
  });
}

export async function translateWithModel(request: TranslateRequest): Promise<TranslateResult> {
  const prompt = buildTranslategemmaPrompt(
    request.sourceLanguage,
    request.targetLanguage,
    request.inputMarkdown,
  );

  if (!isTauriRuntime()) {
    return {
      outputMarkdown: request.inputMarkdown,
      usedPrompt: prompt,
    };
  }

  const result = await invoke<TranslateCommandResult>("translate_text", {
    payload: {
      endpoint: request.modelConfig.endpoint,
      model: request.modelConfig.model,
      prompt,
      apiToken: request.modelConfig.apiToken,
      username: request.modelConfig.username,
      password: request.modelConfig.password,
    } satisfies TranslateCommandPayload,
  });

  return {
    outputMarkdown: result.text.trim(),
    usedPrompt: prompt,
  };
}
