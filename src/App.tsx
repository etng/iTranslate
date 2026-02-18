import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { ChevronDown, ChevronUp, FileText, History, Info, Languages, Play, Server, Settings } from "lucide-react";
import {
  APP_BUILD_NUMBER,
  APP_SEMVER,
  LANGUAGE_OPTIONS,
  DEFAULT_MODEL_CONFIG,
  DEFAULT_SOURCE_LANGUAGE,
  DEFAULT_TARGET_LANGUAGE,
  HISTORY_PAGE_SIZE,
} from "./constants/languages";
import type {
  EngineStoreState,
  TranslationHistoryItem,
  TranslatorModelConfig,
  UserPreferences,
} from "./types";
import { preprocessInput } from "./services/preprocess";
import { translateWithModel } from "./services/translation";
import {
  createAutoTitle,
  deleteHistoryById,
  loadHistory,
  renameHistoryTitle,
  replaceHistory,
  saveHistory,
  upsertHistory,
} from "./services/historyStore";
import {
  getAvailableEngines,
  loadEngineState,
  saveEngineState,
} from "./services/engineStore";
import { HistoryList } from "./components/HistoryList";
import { HistoryDetail } from "./components/HistoryDetail";
import { ResultViewer } from "./components/ResultViewer";
import { SetupWizard } from "./components/SetupWizard";
import { LineNumberTextarea } from "./components/LineNumberTextarea";
import { checkForUpdatesByMenu } from "./services/updateService";
import { isTauriRuntime } from "./utils/runtime";
import { historySeedEntries } from "./seeds/historySeed";
import { EngineManager } from "./components/EngineManager";
import { detectSourceLanguage } from "./services/languageDetect";
import { loadPreferences, savePreferences } from "./services/preferencesStore";
import { PreferencesPanel } from "./components/PreferencesPanel";
import {
  getBlockIndexByLine,
  getBlockRangeByIndex,
  type MarkdownBlockRange,
} from "./services/markdownBlockMap";
import "./App.css";

const SETUP_KEY = "itranslate.setup.done";
const AUTO_TRANSLATE_DEBOUNCE_MS = 650;
const AUTO_DETECT_LANGUAGE_DEBOUNCE_MS = 280;
const HISTORY_SEED_APPLIED_KEY = "itranslate.history.seed.applied.v1";

type TranslateTrigger = "manual" | "paste";
type LogLevel = "INFO" | "WARN" | "ERROR";

interface RuntimeLog {
  id: string;
  time: string;
  level: LogLevel;
  message: string;
}

function createHistoryItem(args: {
  id?: string;
  sourceLanguage: string;
  targetLanguage: string;
  inputRaw: string;
  inputMarkdown: string;
  outputMarkdown: string;
  engine: TranslatorModelConfig;
}): TranslationHistoryItem {
  return {
    id: args.id ?? crypto.randomUUID(),
    title: createAutoTitle(args.inputMarkdown),
    createdAt: new Date().toISOString(),
    sourceLanguage: args.sourceLanguage,
    targetLanguage: args.targetLanguage,
    inputRaw: args.inputRaw,
    inputMarkdown: args.inputMarkdown,
    outputMarkdown: args.outputMarkdown,
    provider: args.engine.provider,
    model: args.engine.model,
    engineId: args.engine.id,
    engineName: args.engine.name,
    engineDeleted: Boolean(args.engine.deletedAt),
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
  const [screen, setScreen] = useState<"translator" | "history" | "historyDetail" | "engines" | "preferences">("translator");
  const [selectedHistory, setSelectedHistory] = useState<TranslationHistoryItem | null>(null);
  const [editingHistoryId, setEditingHistoryId] = useState<string | null>(null);

  const [engineState, setEngineState] = useState<EngineStoreState>(() => loadEngineState());
  const [selectedEngineId, setSelectedEngineId] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences>(() => loadPreferences());

  const [runtimeLogs, setRuntimeLogs] = useState<RuntimeLog[]>([]);
  const [linkedRange, setLinkedRange] = useState<MarkdownBlockRange | null>(null);
  const [bottomTab, setBottomTab] = useState<"status" | "log">("status");
  const [bottomCollapsed, setBottomCollapsed] = useState(true);
  const [bottomHeight, setBottomHeight] = useState(180);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const autoTranslateTimerRef = useRef<number | null>(null);
  const autoDetectTimerRef = useRef<number | null>(null);
  const translatingRef = useRef(false);
  const shortcutPasteRef = useRef(false);
  const applyLeftScrollRatioRef = useRef<(ratio: number) => void>(() => {});
  const applyRightScrollRatioRef = useRef<(ratio: number) => void>(() => {});
  const dockDragStateRef = useRef<{ startY: number; startHeight: number } | null>(null);

  const appendLog = useCallback((level: LogLevel, message: string) => {
    setRuntimeLogs((prev) => [
      {
        id: crypto.randomUUID(),
        time: new Date().toLocaleTimeString(),
        level,
        message,
      },
      ...prev,
    ].slice(0, 120));
  }, []);

  const clampDockHeight = useCallback((value: number) => {
    const max = Math.min(window.innerHeight * 0.5, 420);
    return Math.min(Math.max(value, 92), max);
  }, []);

  const handleDockResizeStart = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (bottomCollapsed) {
      return;
    }
    event.preventDefault();
    dockDragStateRef.current = {
      startY: event.clientY,
      startHeight: bottomHeight,
    };

    const onMouseMove = (moveEvent: MouseEvent) => {
      const state = dockDragStateRef.current;
      if (!state) {
        return;
      }
      const delta = state.startY - moveEvent.clientY;
      setBottomHeight(clampDockHeight(state.startHeight + delta));
    };

    const onMouseUp = () => {
      dockDragStateRef.current = null;
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  useEffect(() => {
    if (!toastMessage) {
      return;
    }
    const timer = window.setTimeout(() => {
      setToastMessage(null);
    }, 2800);
    return () => {
      window.clearTimeout(timer);
    };
  }, [toastMessage]);

  useEffect(() => {
    translatingRef.current = translating;
  }, [translating]);

  useEffect(() => {
    return () => {
      if (autoTranslateTimerRef.current) {
        window.clearTimeout(autoTranslateTimerRef.current);
      }
      if (autoDetectTimerRef.current) {
        window.clearTimeout(autoDetectTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    saveEngineState(engineState);
  }, [engineState]);

  useEffect(() => {
    savePreferences(preferences);
  }, [preferences]);

  useEffect(() => {
    if (!setupDone) {
      return;
    }

    if (import.meta.env.VITE_ENABLE_HISTORY_SEED !== "1") {
      return;
    }

    if (localStorage.getItem(HISTORY_SEED_APPLIED_KEY) === "1") {
      return;
    }

    if (historySeedEntries.length === 0) {
      return;
    }

    saveHistory(historySeedEntries);
    setHistory(loadHistory());
    localStorage.setItem(HISTORY_SEED_APPLIED_KEY, "1");
    setStatusText(`已注入分页 seed，共 ${historySeedEntries.length} 条记录`);
    appendLog("INFO", `已注入分页 seed：${historySeedEntries.length} 条`);
  }, [appendLog, setupDone]);

  useEffect(() => {
    if (!isTauriRuntime()) {
      return;
    }

    const unlisteners: UnlistenFn[] = [];
    let mounted = true;

    const bindMenuListeners = async () => {
      const unlistenAbout = await listen("menu://about", () => {
        window.alert(
          `iTranslate\n本地翻译工具\n核心功能：Markdown 保格式翻译、历史记录、更新检测\n版本：${APP_SEMVER}.${APP_BUILD_NUMBER}`,
        );
      });
      const unlistenUpdate = await listen("menu://check-update", async () => {
        appendLog("INFO", "开始检查更新");
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
  }, [appendLog]);

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

  const availableEngines = getAvailableEngines(engineState.engines);
  const defaultEngine = availableEngines.find((engine) => engine.id === engineState.defaultEngineId) ?? null;
  const selectedEngine = availableEngines.find((engine) => engine.id === selectedEngineId)
    ?? defaultEngine
    ?? availableEngines[0]
    ?? null;

  const executeTranslate = useCallback(
    async (rawInput: string, trigger: TranslateTrigger) => {
      if (!rawInput.trim()) {
        setStatusText("请输入待翻译文本");
        appendLog("WARN", "收到空输入，跳过翻译");
        return;
      }

      if (availableEngines.length === 0) {
        setStatusText("没有可用翻译引擎，请先新增引擎");
        appendLog("WARN", "翻译失败：无可用引擎");
        setScreen("engines");
        return;
      }

      if (!selectedEngine) {
        setStatusText("请先选择一个翻译引擎");
        appendLog("WARN", "翻译失败：未选择默认或当前引擎");
        return;
      }

      if (translatingRef.current) {
        appendLog("WARN", "翻译进行中，跳过重复请求");
        return;
      }

      setTranslating(true);
      setStatusText(trigger === "paste" ? "检测到粘贴，自动翻译中..." : "处理中...");
      const requestId = crypto.randomUUID().slice(0, 8);
      const startAt = performance.now();
      appendLog(
        "INFO",
        `[${requestId}] ${trigger === "paste" ? "触发粘贴防抖翻译" : "触发手动翻译"} 引擎=${selectedEngine.name} 模型=${selectedEngine.model} 地址=${selectedEngine.endpoint}`,
      );

      try {
        const preprocessed = preprocessInput(rawInput);
        const result = await translateWithModel({
          sourceLanguage,
          targetLanguage,
          inputRaw: rawInput,
          inputMarkdown: preprocessed.markdown,
          modelConfig: selectedEngine,
        });

        setOutputMarkdown(result.outputMarkdown);
        setLinkedRange(null);

        if (editingHistoryId) {
          const replacedItem = createHistoryItem({
            id: editingHistoryId,
            sourceLanguage,
            targetLanguage,
            inputRaw: rawInput,
            inputMarkdown: preprocessed.markdown,
            outputMarkdown: result.outputMarkdown,
            engine: selectedEngine,
          });
          const next = replaceHistory(replacedItem);
          setHistory(next);
          setStatusText("翻译完成，已更新当前历史记录");
          appendLog("INFO", `已更新历史记录：${replacedItem.title}`);
          appendLog("INFO", `[${requestId}] 请求完成，耗时 ${Math.round(performance.now() - startAt)}ms`);
        } else {
          const historyItem = createHistoryItem({
            sourceLanguage,
            targetLanguage,
            inputRaw: rawInput,
            inputMarkdown: preprocessed.markdown,
            outputMarkdown: result.outputMarkdown,
            engine: selectedEngine,
          });
          const next = upsertHistory(historyItem);
          setHistory(next);
          setStatusText(preprocessed.detectedHtml ? "翻译完成（输入已先转换为 Markdown）" : "翻译完成");
          appendLog("INFO", `翻译完成并写入历史：${historyItem.title}`);
          appendLog("INFO", `[${requestId}] 请求完成，耗时 ${Math.round(performance.now() - startAt)}ms`);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "未知错误";
        setStatusText(`翻译失败：${message}`);
        appendLog("ERROR", `翻译失败：${message}`);
        appendLog("ERROR", `[${requestId}] 请求失败，耗时 ${Math.round(performance.now() - startAt)}ms`);
      } finally {
        setTranslating(false);
      }
    },
    [appendLog, availableEngines, editingHistoryId, selectedEngine, sourceLanguage, targetLanguage],
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

  const scheduleDetectSourceLanguage = useCallback((text: string) => {
    if (autoDetectTimerRef.current) {
      window.clearTimeout(autoDetectTimerRef.current);
    }
    autoDetectTimerRef.current = window.setTimeout(() => {
      const detected = detectSourceLanguage(text);
      if (!detected || detected === sourceLanguage) {
        return;
      }
      setSourceLanguage(detected);
      setStatusText(`已自动识别源语言：${detected}`);
      appendLog("INFO", `自动识别源语言并切换：${detected}`);
    }, AUTO_DETECT_LANGUAGE_DEBOUNCE_MS);
  }, [appendLog, sourceLanguage]);

  const handleTranslateClick = () => {
    void executeTranslate(inputText, "manual");
  };

  const handleSelectResultLine = (line: number) => {
    const blockIndex = getBlockIndexByLine(outputMarkdown, line);
    if (blockIndex == null) {
      setLinkedRange(null);
      return;
    }
    setLinkedRange(getBlockRangeByIndex(inputText, blockIndex));
  };

  const handleInputChange = (value: string) => {
    setInputText(value);
    setLinkedRange(null);
    scheduleDetectSourceLanguage(value);
  };

  const handleEnterApp = (config: TranslatorModelConfig) => {
    setModelConfig(config);
    setSetupDone(true);
    localStorage.setItem(SETUP_KEY, "1");
    appendLog("INFO", "初始化向导完成，进入主界面");
    setEngineState((prev) => {
      const existed = prev.engines.find((engine) => engine.id === config.id);
      const engines = existed
        ? prev.engines.map((engine) => (engine.id === config.id ? { ...engine, ...config, deletedAt: null } : engine))
        : [{ ...config, deletedAt: null }, ...prev.engines];
      return {
        engines,
        defaultEngineId: config.id,
      };
    });
    setSelectedEngineId(config.id);
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
    setLinkedRange(null);
    scheduleDetectSourceLanguage(nextValue);
    setStatusText(
      fromShortcut && htmlText.trim().length > 0
        ? "已将 HTML 转换为 Markdown 后粘贴，稍后自动翻译"
        : "已按纯文本粘贴，稍后自动翻译",
    );
    appendLog(
      "INFO",
      fromShortcut && htmlText.trim().length > 0
        ? "快捷键粘贴 HTML，已转换为 Markdown"
        : "粘贴纯文本",
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

  const lastLog = runtimeLogs[0];
  const latestHistoryItem = history[0];

  if (!setupDone) {
    return <SetupWizard modelConfig={modelConfig} onComplete={handleEnterApp} />;
  }

  return (
    <main className="app-shell full-screen">
      {screen !== "historyDetail" ? (
        <header className="top-nav">
          <div className="nav-buttons">
            <button
              type="button"
              title="翻译"
              aria-label="翻译"
              className={`icon-btn icon-only ${screen === "translator" ? "active" : ""}`}
              onClick={() => setScreen("translator")}
            >
              <Languages size={16} />
            </button>
            <button
              type="button"
              title="历史记录"
              aria-label="历史记录"
              className={`icon-btn icon-only ${screen === "history" ? "active" : ""}`}
              onClick={() => setScreen("history")}
            >
              <History size={16} />
            </button>
            <button
              type="button"
              title="翻译引擎"
              aria-label="翻译引擎"
              className={`icon-btn icon-only ${screen === "engines" ? "active" : ""}`}
              onClick={() => setScreen("engines")}
            >
              <Server size={16} />
            </button>
            <button
              type="button"
              title="用户偏好"
              aria-label="用户偏好"
              className={`icon-btn icon-only ${screen === "preferences" ? "active" : ""}`}
              onClick={() => setScreen("preferences")}
            >
              <Settings size={16} />
            </button>
          </div>
        </header>
      ) : null}

      <section className="main-content">
        {screen === "translator" ? (
          <div className="translator-view">
          <section className="lang-row compact-row three-cols">
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

            <label>
              翻译引擎
              <select
                value={selectedEngine?.id ?? ""}
                onChange={(event) => setSelectedEngineId(event.target.value || null)}
              >
                <option value="">{defaultEngine ? `默认：${defaultEngine.name}` : "请选择引擎"}</option>
                {availableEngines.map((engine) => (
                  <option key={engine.id} value={engine.id}>
                    {engine.name}
                  </option>
                ))}
              </select>
            </label>
          </section>

          <section className="panels fill-panels">
            <section className="input-panel fill-panel">
              <div className="panel-header">
                <h3>{editingHistoryId ? "编辑并重译" : "待翻译内容"}</h3>
                <button
                  type="button"
                  className="icon-btn primary"
                  disabled={translating}
                  onClick={handleTranslateClick}
                >
                  <Play size={16} />
                  <span>{translating ? "翻译中..." : "马上翻译"}</span>
                </button>
              </div>
              <LineNumberTextarea
                textareaRef={inputRef}
                placeholder="支持粘贴普通文本或 HTML。快捷键粘贴会自动识别 HTML 并转 Markdown"
                value={inputText}
                onChange={handleInputChange}
                onKeyDown={handleInputKeyDown}
                onPaste={handlePaste}
                highlightedRange={linkedRange}
                onScrollRatioChange={(ratio) => applyRightScrollRatioRef.current(ratio)}
                registerApplyScrollRatio={(apply) => {
                  applyLeftScrollRatioRef.current = apply;
                }}
              />
            </section>

            <ResultViewer
              markdownText={outputMarkdown}
              viewMode={resultViewMode}
              onChangeViewMode={setResultViewMode}
              onScrollRatioChange={(ratio) => applyLeftScrollRatioRef.current(ratio)}
              registerApplyScrollRatio={(apply) => {
                applyRightScrollRatioRef.current = apply;
              }}
              onSelectLine={handleSelectResultLine}
            />
          </section>

          {availableEngines.length === 0 ? (
            <section className="hint-banner">当前没有可用引擎，请先到“翻译引擎”页面新增并检测。</section>
          ) : null}
          </div>
        ) : null}

        {screen === "history" ? (
          <HistoryList
            items={history}
            currentPage={historyPage}
            pageSize={HISTORY_PAGE_SIZE}
            onChangePage={setHistoryPage}
            onOpenDetail={(item) => {
              setSelectedHistory(item);
              setScreen("historyDetail");
              appendLog("INFO", `打开历史详情：${item.title}`);
            }}
            onRenameTitle={(id, title) => {
              setHistory(renameHistoryTitle(id, title));
              appendLog("INFO", `更新历史标题：${title}`);
            }}
            onDelete={(id) => {
              setHistory(deleteHistoryById(id));
              appendLog("WARN", `删除历史记录：${id}`);
            }}
            onToast={setToastMessage}
            defaultEpubAuthor={preferences.epubDefaultAuthor}
            defaultEpubDir={preferences.epubDefaultExportDir}
            onChangeDefaultEpubAuthor={(author) => setPreferences((prev) => ({ ...prev, epubDefaultAuthor: author }))}
            onChangeDefaultEpubDir={(dir) => setPreferences((prev) => ({ ...prev, epubDefaultExportDir: dir }))}
          />
        ) : null}

        {screen === "historyDetail" && selectedHistory ? (
          <HistoryDetail
            item={selectedHistory}
            languages={LANGUAGE_OPTIONS}
            viewMode={resultViewMode}
            onChangeViewMode={setResultViewMode}
            onBack={() => {
              setScreen("history");
              appendLog("INFO", "返回历史列表");
            }}
            onEdit={() => {
              setScreen("translator");
              setEditingHistoryId(selectedHistory.id);
              setInputText(selectedHistory.inputRaw);
              setOutputMarkdown(selectedHistory.outputMarkdown);
              setSourceLanguage(selectedHistory.sourceLanguage);
              setTargetLanguage(selectedHistory.targetLanguage);
              setSelectedEngineId(selectedHistory.engineDeleted ? null : selectedHistory.engineId);
              appendLog("INFO", `进入历史记录编辑模式：${selectedHistory.title}`);
            }}
          />
        ) : null}

        {screen === "engines" ? (
          <EngineManager
            state={engineState}
            onChange={setEngineState}
            onLog={appendLog}
          />
        ) : null}

        {screen === "preferences" ? (
          <PreferencesPanel
            value={preferences}
            onChange={setPreferences}
          />
        ) : null}
      </section>

      <section
        className={`bottom-dock ${bottomCollapsed ? "collapsed" : ""}`}
        style={!bottomCollapsed ? { height: `${bottomHeight}px` } : undefined}
      >
        {!bottomCollapsed ? (
          <div
            className="dock-resizer"
            title="拖拽调整底部高度"
            aria-label="拖拽调整底部高度"
            onMouseDown={handleDockResizeStart}
          />
        ) : null}
        <header className="bottom-dock-header">
          <div className="switches">
            <button
              type="button"
              title="状态"
              aria-label="状态"
              className={`icon-btn icon-only ${bottomTab === "status" ? "active" : ""}`}
              onClick={() => setBottomTab("status")}
            >
              <Info size={16} />
            </button>
            <button
              type="button"
              title="执行日志"
              aria-label="执行日志"
              className={`icon-btn icon-only ${bottomTab === "log" ? "active" : ""}`}
              onClick={() => setBottomTab("log")}
            >
              <FileText size={16} />
            </button>
          </div>
          <button
            type="button"
            title={bottomCollapsed ? "展开底部面板" : "折叠底部面板"}
            aria-label={bottomCollapsed ? "展开底部面板" : "折叠底部面板"}
            className="icon-btn icon-only"
            onClick={() => setBottomCollapsed((value) => !value)}
          >
            {bottomCollapsed ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </header>

        {!bottomCollapsed ? (
          bottomTab === "status" ? (
            <div className="status-bar">
              <div className="status-cell">
                <span className="status-label">翻译状态</span>
                <span>{statusText}</span>
              </div>
              <div className="status-cell">
                <span className="status-label">最近记录</span>
                <span>
                  {latestHistoryItem
                    ? `${latestHistoryItem.title}（${latestHistoryItem.engineDeleted ? `${latestHistoryItem.engineName} 已删除` : latestHistoryItem.engineName}）`
                    : "暂无"}
                </span>
              </div>
              <div className="status-cell">
                <span className="status-label">日志概览</span>
                <span>{lastLog ? `${lastLog.level} ${lastLog.time}` : "暂无日志"}</span>
              </div>
            </div>
          ) : (
            <section className="log-panel" aria-label="执行日志">
              <table className="log-table">
                <tbody>
                  {runtimeLogs.map((log) => (
                    <tr key={log.id} className={`log-item ${log.level.toLowerCase()}`}>
                      <td className="time">{log.time}</td>
                      <td className="level">{log.level}</td>
                      <td className="message">{log.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )
        ) : null}
      </section>

      {toastMessage ? <div className="toast">{toastMessage}</div> : null}
    </main>
  );
}

export default App;
