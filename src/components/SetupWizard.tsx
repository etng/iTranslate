import { useState } from "react";
import type { TranslatorModelConfig } from "../types";
import { checkOllamaHealth } from "../services/translation";

interface SetupWizardProps {
  modelConfig: TranslatorModelConfig;
  onComplete: (config: TranslatorModelConfig) => void;
}

export function SetupWizard({ modelConfig, onComplete }: SetupWizardProps) {
  const [config, setConfig] = useState(modelConfig);
  const [checking, setChecking] = useState(false);
  const [statusText, setStatusText] = useState("请先检查 Ollama 服务与模型");

  const handleCheck = async () => {
    setChecking(true);
    try {
      const status = await checkOllamaHealth(config.endpoint, config.model);
      setStatusText(status.message);
      if (status.reachable && status.modelInstalled) {
        onComplete(config);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "未知错误";
      setStatusText(`检查失败：${message}`);
    } finally {
      setChecking(false);
    }
  };

  return (
    <main className="setup-wizard">
      <h1>iTranslate 初始化向导</h1>
      <p>首次运行需要确认本机 Ollama 服务可用，并且已安装 translategemma 模型。</p>

      <label>
        Ollama 地址
        <input
          value={config.endpoint}
          onChange={(event) => setConfig((prev) => ({ ...prev, endpoint: event.target.value }))}
        />
      </label>

      <label>
        默认模型
        <input
          value={config.model}
          onChange={(event) => setConfig((prev) => ({ ...prev, model: event.target.value }))}
        />
      </label>

      <button type="button" disabled={checking} onClick={handleCheck}>
        {checking ? "检查中..." : "验证并进入"}
      </button>
      <p className="setup-status">{statusText}</p>
    </main>
  );
}
