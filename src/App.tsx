import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { History, Languages, Play } from "lucide-react";
import {
  LANGUAGE_OPTIONS,
  DEFAULT_MODEL_CONFIG,
  DEFAULT_SOURCE_LANGUAGE,
  DEFAULT_TARGET_LANGUAGE,
  HISTORY_PAGE_SIZE,
} from "./constants/languages";
import type { TranslationHistoryItem, TranslatorModelConfig } from "./types";
import { preprocessInput } from "./services/preprocess";
import { translateWithModel } from "./services/translation";
import {
  createAutoTitle,
  loadHistory,
  renameHistoryTitle,
  upsertHistory,
} from "./services/historyStore";
import { HistoryList } from "./components/HistoryList";
import { HistoryDetail } from "./components/HistoryDetail";
import { ResultViewer } from "./components/ResultViewer";
import { SetupWizard } from "./components/SetupWizard";
import { checkForUpdatesByMenu } from "./services/updateService";
import { isTauriRuntime } from "./utils/runtime";
import "./App.css";

const SETUP_KEY = "itranslate.setup.done";
const AUTO_TRANSLATE_DEBOUNCE_MS = 650;

type TranslateTrigger = "manual" | "paste";

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

  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const autoTranslateTimerRef = useRef<number | null>(null);
  const translatingRef = useRef(false);
  const shortcutPasteRef = useRef(false);

  useEffect(() => {
    translatingRef.current = translating;
  }, [translating]);

  useEffect(() => {
    return () => {
      if (autoTranslateTimerRef.current) {
        window.clearTimeout(autoTranslateTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isTauriRuntime()) {
      return;
    }

    const unlisteners: UnlistenFn[] = [];
    let mounted = true;

    const bindMenuListeners = async () => {
      const unlistenAbout = await listen("menu://about", () => {
        window.alert(
          "iTranslate\n本地翻译工具\n核心功能：Markdown 保格式翻译、历史记录、更新检测\n版本：0.1.0.1",
        );
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

  const executeTranslate = useCallback(
    async (rawInput: string, trigger: TranslateTrigger) => {
      if (!rawInput.trim()) {
        setStatusText("请输入待翻译文本");
        return;
      }

      if (translatingRef.current) {
        return;
      }

      setTranslating(true);
      setStatusText(trigger === "paste" ? "检测到粘贴，自动翻译中..." : "处理中...");

      try {
        const preprocessed = preprocessInput(rawInput);
        const result = await translateWithModel({
          sourceLanguage,
          targetLanguage,
          inputRaw: rawInput,
          inputMarkdown: preprocessed.markdown,
          modelConfig,
        });

        setOutputMarkdown(result.outputMarkdown);

        const historyItem = createHistoryItem({
          sourceLanguage,
          targetLanguage,
          inputRaw: rawInput,
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
    },
    [modelConfig, sourceLanguage, targetLanguage],
  );

  const scheduleTranslateByDebounce = useCallback(
    (text: string) => {
      if (autoTranslateTimerRef.current) {
        window.clearTimeout(autoTranslateTimerRef.current);
      }

      autoTranslateTimerRef.current = window.setTimeout(() => {
        void executeTranslate(text, "paste");
      }, AUTO_TRANSLATE_DEBOUNCE_MS);
    },
    [executeTranslate],
  );

  const handleTranslateClick = () => {
    void executeTranslate(inputText, "manual");
  };

  const handleRenameHistory = (id: string, title: string) => {
    setHistory(renameHistoryTitle(id, title));
  };

  const handleEnterApp = (config: TranslatorModelConfig) => {
    setModelConfig(config);
    setSetupDone(true);
    localStorage.setItem(SETUP_KEY, "1");
  };

  const handlePaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const textarea = event.currentTarget;
    const plainText = event.clipboardData.getData("text/plain");
    const htmlText = event.clipboardData.getData("text/html");
    const fromShortcut = shortcutPasteRef.current;
    shortcutPasteRef.current = false;

    if (!plainText && !htmlText) {
      return;
    }

    event.preventDefault();

    const insertText = fromShortcut && htmlText.trim().length > 0
      ? preprocessInput(htmlText).markdown
      : plainText;

    const selectionStart = textarea.selectionStart ?? 0;
    const selectionEnd = textarea.selectionEnd ?? selectionStart;
    const nextValue = `${inputText.slice(0, selectionStart)}${insertText}${inputText.slice(selectionEnd)}`;

    setInputText(nextValue);
    setStatusText(
      fromShortcut && htmlText.trim().length > 0
        ? "已将 HTML 转换为 Markdown 后粘贴，稍后自动翻译"
        : "已按纯文本粘贴，稍后自动翻译",
    );

    requestAnimationFrame(() => {
      const cursor = selectionStart + insertText.length;
      inputRef.current?.setSelectionRange(cursor, cursor);
    });

    scheduleTranslateByDebounce(nextValue);
  };

  const handleInputKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    shortcutPasteRef.current = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "v";
  };

  if (!setupDone) {
    return <SetupWizard modelConfig={modelConfig} onComplete={handleEnterApp} />;
  }

  if (screen === "history") {
    return (
      <main className="app-shell full-screen">
        <header className="top-nav">
          <div className="brand">iTranslate</div>
          <div className="nav-buttons">
            <button type="button" className="icon-btn" onClick={() => setScreen("translator")}>
              <Languages size={16} />
              <span>翻译</span>
            </button>
            <button type="button" className="icon-btn active">
              <History size={16} />
              <span>历史记录</span>
            </button>
          </div>
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
      <main className="app-shell full-screen">
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
    <main className="app-shell full-screen">
      <header className="top-nav">
        <div className="brand">iTranslate</div>
        <div className="nav-buttons">
          <button type="button" className="icon-btn active">
            <Languages size={16} />
            <span>翻译</span>
          </button>
          <button type="button" className="icon-btn" onClick={() => setScreen("history")}>
            <History size={16} />
            <span>历史记录</span>
          </button>
        </div>
      </header>

      <section className="lang-row compact-row">
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

      <section className="panels fill-panels">
        <section className="input-panel fill-panel">
          <div className="panel-header">
            <h3>待翻译内容</h3>
            <button type="button" className="icon-btn primary" disabled={translating} onClick={handleTranslateClick}>
              <Play size={16} />
              <span>{translating ? "翻译中..." : "马上翻译"}</span>
            </button>
          </div>
          <textarea
            ref={inputRef}
            placeholder="支持粘贴普通文本或 HTML。快捷键粘贴会自动识别 HTML 并转 Markdown"
            value={inputText}
            onChange={(event) => setInputText(event.target.value)}
            onKeyDown={handleInputKeyDown}
            onPaste={handlePaste}
          />
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
