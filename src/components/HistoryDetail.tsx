import { useCallback, useEffect, useRef, useState } from "react";
import type { LanguageOption, TranslationHistoryItem } from "../types";
import { LineNumberTextarea } from "./LineNumberTextarea";
import { ResultViewer } from "./ResultViewer";
import {
  getBlockIndexByLine,
  getBlockRangeByIndex,
  type MarkdownBlockRange,
} from "../services/markdownBlockMap";

interface HistoryDetailProps {
  item: TranslationHistoryItem;
  languages: LanguageOption[];
  viewMode: "markdown" | "html";
  onChangeViewMode: (mode: "markdown" | "html") => void;
  onBack: () => void;
  onStartNew: () => void;
  onEdit: () => void;
}

export function HistoryDetail({
  item,
  languages,
  viewMode,
  onChangeViewMode,
  onBack,
  onStartNew,
  onEdit,
}: HistoryDetailProps) {
  const applyLeftScrollToLineRef = useRef<(line: number) => void>(() => {});
  const applyRightScrollToBlockRef = useRef<(blockIndex: number) => void>(() => {});
  const blockSyncSourceRef = useRef<"left" | "right" | null>(null);
  const blockSyncResetTimerRef = useRef<number | null>(null);
  const [linkedRange, setLinkedRange] = useState<MarkdownBlockRange | null>(null);

  useEffect(() => {
    return () => {
      if (blockSyncResetTimerRef.current) {
        window.clearTimeout(blockSyncResetTimerRef.current);
      }
    };
  }, []);

  const handleSelectResultLine = (line: number) => {
    const blockIndex = getBlockIndexByLine(item.outputMarkdown, line);
    if (blockIndex == null) {
      setLinkedRange(null);
      return;
    }
    setLinkedRange(getBlockRangeByIndex(item.inputMarkdown, blockIndex));
  };

  const resetBlockSyncSource = useCallback((source: "left" | "right") => {
    if (blockSyncResetTimerRef.current) {
      window.clearTimeout(blockSyncResetTimerRef.current);
    }
    blockSyncResetTimerRef.current = window.setTimeout(() => {
      if (blockSyncSourceRef.current === source) {
        blockSyncSourceRef.current = null;
      }
    }, 120);
  }, []);

  const handleLeftVisibleLineChange = useCallback((line: number) => {
    if (blockSyncSourceRef.current === "right") {
      return;
    }
    const blockIndex = getBlockIndexByLine(item.inputMarkdown, line);
    if (blockIndex == null) {
      return;
    }
    blockSyncSourceRef.current = "left";
    applyRightScrollToBlockRef.current(blockIndex);
    resetBlockSyncSource("left");
  }, [item.inputMarkdown, resetBlockSyncSource]);

  const handleRightVisibleBlockChange = useCallback((blockIndex: number | null) => {
    if (blockSyncSourceRef.current === "left" || blockIndex == null) {
      return;
    }
    const range = getBlockRangeByIndex(item.inputMarkdown, blockIndex);
    if (!range) {
      return;
    }
    blockSyncSourceRef.current = "right";
    applyLeftScrollToLineRef.current(range.startLine);
    resetBlockSyncSource("right");
  }, [item.inputMarkdown, resetBlockSyncSource]);

  return (
    <section className="history-detail">
      <header className="detail-header">
        <div className="nav-buttons">
          <button type="button" onClick={onBack}>
            返回历史列表
          </button>
          <button type="button" onClick={onStartNew}>
            新建翻译
          </button>
          <button type="button" onClick={onEdit}>
            继续编辑并重译
          </button>
        </div>
        <h2>{item.title}</h2>
      </header>

      <div className="lang-row">
        <label>
          源语言
          <select disabled value={item.sourceLanguage}>
            {languages.map((language) => (
              <option key={language.code} value={language.code}>
                {language.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          目标语言
          <select disabled value={item.targetLanguage}>
            {languages.map((language) => (
              <option key={language.code} value={language.code}>
                {language.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="detail-panels">
        <section className="input-panel">
          <h3>原文（Markdown）</h3>
          <LineNumberTextarea
            value={item.inputMarkdown}
            readOnly
            highlightedRange={linkedRange}
            onVisibleLineChange={handleLeftVisibleLineChange}
            registerScrollToLine={(scrollToLine) => {
              applyLeftScrollToLineRef.current = scrollToLine;
            }}
          />
        </section>

        <ResultViewer
          markdownText={item.outputMarkdown}
          viewMode={viewMode}
          onChangeViewMode={onChangeViewMode}
          onVisibleBlockChange={handleRightVisibleBlockChange}
          registerScrollToBlock={(scrollToBlock) => {
            applyRightScrollToBlockRef.current = scrollToBlock;
          }}
          onSelectLine={handleSelectResultLine}
        />
      </div>
    </section>
  );
}
