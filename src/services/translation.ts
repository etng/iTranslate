import { invoke } from "@tauri-apps/api/core";
import type { OllamaHealthStatus, TranslateRequest, TranslateResult } from "../types";
import { isTauriRuntime } from "../utils/runtime";

interface TranslateCommandPayload {
  endpoint: string;
  model: string;
  prompt: string;
}

interface TranslateCommandResult {
  text: string;
}

interface OllamaHealthPayload {
  endpoint: string;
  model: string;
}

const FORMAT_PRESERVE_RULES = `\n\n请严格保留 Markdown 结构与层级：\n1. 标题层级、列表层级、表格结构、引用块、代码块必须原样保留。\n2. 不要新增或删除段落与行。\n3. 代码块内内容不翻译。\n4. 链接 URL 不翻译，仅翻译可见文本。\n5. 仅输出翻译后的 Markdown，不要解释。`;

export function buildTranslategemmaPrompt(
  sourceLanguage: string,
  targetLanguage: string,
  sourceText: string,
): string {
  const promptPrefix = `Translate from ${sourceLanguage} to ${targetLanguage}.\nSource: ${sourceLanguage}: ${sourceText}\nTranslation: ${targetLanguage}:`;
  return `${promptPrefix}${FORMAT_PRESERVE_RULES}`;
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
      outputMarkdown: `[浏览器调试模式]\n\n${request.inputMarkdown}`,
      usedPrompt: prompt,
    };
  }

  const result = await invoke<TranslateCommandResult>("translate_text", {
    payload: {
      endpoint: request.modelConfig.endpoint,
      model: request.modelConfig.model,
      prompt,
    } satisfies TranslateCommandPayload,
  });

  return {
    outputMarkdown: result.text.trim(),
    usedPrompt: prompt,
  };
}
