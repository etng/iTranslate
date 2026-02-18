import { useEffect, useMemo, useState } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { LANGUAGE_OPTIONS, DEFAULT_MODEL_CONFIG, DEFAULT_SOURCE_LANGUAGE, DEFAULT_TARGET_LANGUAGE, HISTORY_PAGE_SIZE } from "./constants/languages";
import type { TranslationHistoryItem, TranslatorModelConfig } from "./types";
import { preprocessInput } from "./services/preprocess";
import { translateWithModel } from "./services/translation";
import { createAutoTitle, loadHistory, renameHistoryTitle, upsertHistory } from "./services/historyStore";
import { HistoryList } from "./components/HistoryList";
import { HistoryDetail } from "./components/HistoryDetail";
import { ResultViewer } from "./components/ResultViewer";
import { SetupWizard } from "./components/SetupWizard";
import { checkForUpdatesByMenu } from "./services/updateService";
import { isTauriRuntime } from "./utils/runtime";
import "./App.css";

const SETUP_KEY = "itranslate.setup.done";

function createHistoryItem(args: {
  sourceLanguage: string;
  targetLanguage: string;
  inputRaw: string;
  inputMarkdown: string;
  outputMarkdown: string;
  config: TranslatorModelConfig;
}): TranslationHistoryItem {
  return {
    id: crypto.randomUUID(),
    title: createAutoTitle(args.inputMarkdown),
    createdAt: new Date().toISOString(),
    sourceLanguage: args.sourceLanguage,
    targetLanguage: args.targetLanguage,
    inputRaw: args.inputRaw,
    inputMarkdown: args.inputMarkdown,
    outputMarkdown: args.outputMarkdown,
    provider: args.config.provider,
    model: args.config.model,
  };
}

function App() {
  const [setupDone, setSetupDone] = useState(localStorage.getItem(SETUP_KEY) === "1");
  const [modelConfig, setModelConfig] = useState<TranslatorModelConfig>(DEFAULT_MODEL_CONFIG);

  const [sourceLanguage, setSourceLanguage] = useState(DEFAULT_SOURCE_LANGUAGE);
  const [targetLanguage, setTargetLanguage] = useState(DEFAULT_TARGET_LANGUAGE);
  const [inputText, setInputText] = useState("");
  const [outputMarkdown, setOutputMarkdown] = useState("");
  const [resultViewMode, setResultViewMode] = useState<"markdown" | "html">("markdown");
  const [translating, setTranslating] = useState(false);
  const [statusText, setStatusText] = useState("等待翻译");

  const [history, setHistory] = useState<TranslationHistoryItem[]>(() => loadHistory());
  const [historyPage, setHistoryPage] = useState(1);
  const [screen, setScreen] = useState<"translator" | "history" | "historyDetail">("translator");
  const [selectedHistory, setSelectedHistory] = useState<TranslationHistoryItem | null>(null);

  useEffect(() => {
    if (!isTauriRuntime()) {
      return;
    }

    const unlisteners: UnlistenFn[] = [];
    let mounted = true;

    const bindMenuListeners = async () => {
      const unlistenAbout = await listen("menu://about", () => {
        window.alert("iTranslate\n本地翻译工具\n核心功能：Markdown 保格式翻译、历史记录、更新检测\n版本：0.1.0.1");
      });
      const unlistenUpdate = await listen("menu://check-update", async () => {
        await checkForUpdatesByMenu();
      });

      if (!mounted) {
        unlistenAbout();
        unlistenUpdate();
        return;
      }

      unlisteners.push(unlistenAbout, unlistenUpdate);
    };

    void bindMenuListeners();

    return () => {
      mounted = false;
      unlisteners.forEach((dispose) => dispose());
    };
  }, []);

  const pagedHistory = useMemo(() => {
    const start = (historyPage - 1) * HISTORY_PAGE_SIZE;
    return history.slice(start, start + HISTORY_PAGE_SIZE);
  }, [history, historyPage]);

  useEffect(() => {
    if (history.length === 0) {
      setHistoryPage(1);
      return;
    }
    const totalPages = Math.ceil(history.length / HISTORY_PAGE_SIZE);
    if (historyPage > totalPages) {
      setHistoryPage(totalPages);
    }
  }, [history, historyPage]);

  const handleTranslate = async () => {
    if (!inputText.trim()) {
      setStatusText("请输入待翻译文本");
      return;
    }

    setTranslating(true);
    setStatusText("处理中...");

    try {
      const preprocessed = preprocessInput(inputText);
      const result = await translateWithModel({
        sourceLanguage,
        targetLanguage,
        inputRaw: inputText,
        inputMarkdown: preprocessed.markdown,
        modelConfig,
      });

      setOutputMarkdown(result.outputMarkdown);

      const historyItem = createHistoryItem({
        sourceLanguage,
        targetLanguage,
        inputRaw: inputText,
        inputMarkdown: preprocessed.markdown,
        outputMarkdown: result.outputMarkdown,
        config: modelConfig,
      });

      const next = upsertHistory(historyItem);
      setHistory(next);
      setStatusText(preprocessed.detectedHtml ? "翻译完成（输入已先转换为 Markdown）" : "翻译完成");
    } catch (error) {
      const message = error instanceof Error ? error.message : "未知错误";
      setStatusText(`翻译失败：${message}`);
    } finally {
      setTranslating(false);
    }
  };

  const handleRenameHistory = (id: string, title: string) => {
    setHistory(renameHistoryTitle(id, title));
  };

  const handleEnterApp = (config: TranslatorModelConfig) => {
    setModelConfig(config);
    setSetupDone(true);
    localStorage.setItem(SETUP_KEY, "1");
  };

  if (!setupDone) {
    return <SetupWizard modelConfig={modelConfig} onComplete={handleEnterApp} />;
  }

  if (screen === "history") {
    return (
      <main className="app-shell">
        <header className="top-nav">
          <button type="button" onClick={() => setScreen("translator")}>翻译</button>
          <button type="button" className="active">历史记录</button>
        </header>

        <HistoryList
          items={history}
          currentPage={historyPage}
          pageSize={HISTORY_PAGE_SIZE}
          onChangePage={setHistoryPage}
          onOpenDetail={(item) => {
            setSelectedHistory(item);
            setScreen("historyDetail");
          }}
          onRenameTitle={handleRenameHistory}
        />
      </main>
    );
  }

  if (screen === "historyDetail" && selectedHistory) {
    return (
      <main className="app-shell">
        <HistoryDetail
          item={selectedHistory}
          languages={LANGUAGE_OPTIONS}
          viewMode={resultViewMode}
          onChangeViewMode={setResultViewMode}
          onBack={() => setScreen("history")}
        />
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="top-nav">
        <button type="button" className="active">翻译</button>
        <button type="button" onClick={() => setScreen("history")}>历史记录</button>
      </header>

      <section className="lang-row">
        <label>
          源语言
          <select value={sourceLanguage} onChange={(event) => setSourceLanguage(event.target.value)}>
            {LANGUAGE_OPTIONS.map((language) => (
              <option key={language.code} value={language.code}>
                {language.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          目标语言
          <select value={targetLanguage} onChange={(event) => setTargetLanguage(event.target.value)}>
            {LANGUAGE_OPTIONS.map((language) => (
              <option key={language.code} value={language.code}>
                {language.label}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="panels">
        <section className="input-panel">
          <h3>待翻译内容</h3>
          <textarea
            placeholder="支持粘贴普通文本或 HTML，HTML 会先转换为 Markdown 再翻译"
            value={inputText}
            onChange={(event) => setInputText(event.target.value)}
          />
          <button type="button" disabled={translating} onClick={handleTranslate}>
            {translating ? "翻译中..." : "开始翻译"}
          </button>
          <p className="status-text">{statusText}</p>
        </section>

        <ResultViewer
          markdownText={outputMarkdown}
          viewMode={resultViewMode}
          onChangeViewMode={setResultViewMode}
        />
      </section>

      {pagedHistory.length > 0 ? (
        <footer className="latest-footer">
          最近记录：{pagedHistory[0].title}（{pagedHistory[0].sourceLanguage} → {pagedHistory[0].targetLanguage}）
        </footer>
      ) : null}
    </main>
  );
}

export default App;
