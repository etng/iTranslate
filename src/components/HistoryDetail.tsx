import { useState, useRef } from "react";
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
  onEdit: () => void;
}

export function HistoryDetail({
  item,
  languages,
  viewMode,
  onChangeViewMode,
  onBack,
  onEdit,
}: HistoryDetailProps) {
  const applyLeftScrollRatioRef = useRef<(ratio: number) => void>(() => {});
  const applyRightScrollRatioRef = useRef<(ratio: number) => void>(() => {});
  const [linkedRange, setLinkedRange] = useState<MarkdownBlockRange | null>(null);

  const handleSelectResultLine = (line: number) => {
    const blockIndex = getBlockIndexByLine(item.outputMarkdown, line);
    if (blockIndex == null) {
      setLinkedRange(null);
      return;
    }
    setLinkedRange(getBlockRangeByIndex(item.inputMarkdown, blockIndex));
  };

  return (
    <section className="history-detail">
      <header className="detail-header">
        <div className="nav-buttons">
          <button type="button" onClick={onBack}>
            返回历史列表
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
            onScrollRatioChange={(ratio) => applyRightScrollRatioRef.current(ratio)}
            registerApplyScrollRatio={(apply) => {
              applyLeftScrollRatioRef.current = apply;
            }}
          />
        </section>

        <ResultViewer
          markdownText={item.outputMarkdown}
          viewMode={viewMode}
          onChangeViewMode={onChangeViewMode}
          onScrollRatioChange={(ratio) => applyLeftScrollRatioRef.current(ratio)}
          registerApplyScrollRatio={(apply) => {
            applyRightScrollRatioRef.current = apply;
          }}
          onSelectLine={handleSelectResultLine}
        />
      </div>
    </section>
  );
}
