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
  requestId?: string;
  chunkIndex?: number;
  totalChunks?: number;
}

interface TranslateCommandResult {
  text: string;
}

interface OllamaHealthPayload {
  endpoint: string;
  model: string;
}

const TRANSLATION_CHUNK_CHAR_LIMIT = 3200;

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

export function shouldSkipTranslation(sourceLanguage: string, targetLanguage: string): boolean {
  return sourceLanguage.trim().toLowerCase() === targetLanguage.trim().toLowerCase();
}

export function buildTranslategemmaPrompt(
  sourceLanguage: string,
  targetLanguage: string,
  sourceText: string,
): string {
  const sourceCode = resolveLanguageCode(sourceLanguage);
  const targetCode = resolveLanguageCode(targetLanguage);

  return `You are a professional ${sourceLanguage} (${sourceCode}) to ${targetLanguage} (${targetCode}) translator. Your goal is to accurately convey the meaning and nuances of the original ${sourceLanguage} text while adhering to ${targetLanguage} grammar, vocabulary, and cultural sensitivities.
Produce only the ${targetLanguage} translation, without any additional explanations or commentary. Do not summarize, do not rewrite, and do not omit content. Preserve the original Markdown structure (headings, lists, blockquotes, links, emphasis, and paragraph boundaries) as much as possible. Please translate the following ${sourceLanguage} text into ${targetLanguage}:


${sourceText}`;
}

export function splitMarkdownIntoTranslationChunks(
  markdown: string,
  chunkCharLimit = TRANSLATION_CHUNK_CHAR_LIMIT,
): string[] {
  const normalized = markdown.replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return [];
  }
  if (normalized.length <= chunkCharLimit) {
    return [normalized];
  }

  const blocks = normalized.split(/\n{2,}/);
  const chunks: string[] = [];
  let current = "";

  const pushCurrent = () => {
    if (current.trim().length > 0) {
      chunks.push(current.trim());
      current = "";
    }
  };

  for (const block of blocks) {
    const candidate = current.length > 0 ? `${current}\n\n${block}` : block;
    if (candidate.length <= chunkCharLimit) {
      current = candidate;
      continue;
    }

    pushCurrent();
    if (block.length <= chunkCharLimit) {
      current = block;
      continue;
    }

    // 超长单段按行进一步拆分，避免整段触发模型摘要行为。
    const lines = block.split("\n");
    let lineBucket = "";
    for (const line of lines) {
      const lineCandidate = lineBucket.length > 0 ? `${lineBucket}\n${line}` : line;
      if (lineCandidate.length <= chunkCharLimit) {
        lineBucket = lineCandidate;
      } else {
        if (lineBucket.trim().length > 0) {
          chunks.push(lineBucket.trim());
        }
        lineBucket = line;
      }
    }
    if (lineBucket.trim().length > 0) {
      chunks.push(lineBucket.trim());
    }
  }

  pushCurrent();
  return chunks.length > 0 ? chunks : [normalized];
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
  const chunks = splitMarkdownIntoTranslationChunks(request.inputMarkdown);
  const prompts = chunks.map((chunk) => buildTranslategemmaPrompt(
    request.sourceLanguage,
    request.targetLanguage,
    chunk,
  ));
  const prompt = prompts.join("\n\n");

  if (!isTauriRuntime()) {
    return {
      outputMarkdown: request.inputMarkdown,
      usedPrompt: prompt,
    };
  }

  const translatedChunks: string[] = [];
  for (let index = 0; index < prompts.length; index += 1) {
    const chunkPrompt = prompts[index];
    const startedAt = performance.now();
    request.onChunkProgress?.({ current: index + 1, total: prompts.length, phase: "start" });
    const result = await invoke<TranslateCommandResult>("translate_text", {
      payload: {
        endpoint: request.modelConfig.endpoint,
        model: request.modelConfig.model,
        prompt: chunkPrompt,
        apiToken: request.modelConfig.apiToken,
        username: request.modelConfig.username,
        password: request.modelConfig.password,
        requestId: request.requestId,
        chunkIndex: index + 1,
        totalChunks: prompts.length,
      } satisfies TranslateCommandPayload,
    });
    request.onChunkProgress?.({
      current: index + 1,
      total: prompts.length,
      phase: "done",
      elapsedMs: Math.round(performance.now() - startedAt),
    });
    translatedChunks.push(result.text.trim());
  }

  return {
    outputMarkdown: translatedChunks.join("\n\n").trim(),
    usedPrompt: prompt,
  };
}
