import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import type { TranslationHistoryItem } from "../types";
import { buildBilingualEpubBlob, saveEpubByPicker, type EpubLayoutMode } from "../services/epub";

interface ExportEpubWizardProps {
  open: boolean;
  items: TranslationHistoryItem[];
  defaultAuthor: string;
  defaultDir: string | null;
  onChangeDefaultAuthor: (author: string) => void;
  onChangeDefaultDir: (dir: string | null) => void;
  onToast: (message: string) => void;
  onClose: () => void;
}

type SortOrder = "asc" | "desc";
type ChapterOrderMode = "auto" | "manual";

export function ExportEpubWizard({
  open,
  items,
  defaultAuthor,
  defaultDir,
  onChangeDefaultAuthor,
  onChangeDefaultDir,
  onToast,
  onClose,
}: ExportEpubWizardProps) {
  const [step, setStep] = useState(1);
  const [bookTitle, setBookTitle] = useState("双语译文合集");
  const [author, setAuthor] = useState(defaultAuthor || "iTranslate");
  const [language, setLanguage] = useState("zh-CN");
  const [layoutMode, setLayoutMode] = useState<EpubLayoutMode>("default");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [chapterOrderMode, setChapterOrderMode] = useState<ChapterOrderMode>("auto");
  const [manualOrderIds, setManualOrderIds] = useState<string[]>([]);
  const [setDefaultDir, setSetDefaultDir] = useState(false);
  const [setDefaultAuthor, setSetDefaultAuthor] = useState(false);
  const [exporting, setExporting] = useState(false);

  const defaultChapterItems = useMemo(() => {
    return [...items].sort((a, b) => {
      if (a.sourceType === "epub" && b.sourceType === "epub") {
        const aIndex = a.sourceChapterIndex ?? Number.MAX_SAFE_INTEGER;
        const bIndex = b.sourceChapterIndex ?? Number.MAX_SAFE_INTEGER;
        if (aIndex !== bIndex) {
          return aIndex - bIndex;
        }
      }
      const value = a.title.localeCompare(b.title, "zh-CN");
      if (value !== 0) {
        return value;
      }
      return a.createdAt.localeCompare(b.createdAt);
    });
  }, [items]);

  const sortedItems = useMemo(() => {
    if (chapterOrderMode === "manual") {
      const map = new Map(defaultChapterItems.map((item) => [item.id, item]));
      return manualOrderIds
        .map((id) => map.get(id))
        .filter((item): item is TranslationHistoryItem => Boolean(item));
    }
    const ordered = [...defaultChapterItems];
    if (sortOrder === "desc") {
      ordered.reverse();
    }
    return ordered;
  }, [chapterOrderMode, defaultChapterItems, manualOrderIds, sortOrder]);

  useEffect(() => {
    if (!open) {
      return;
    }
    setAuthor(defaultAuthor || "iTranslate");
    setSetDefaultAuthor(false);
    setSetDefaultDir(false);
    setLanguage("zh-CN");
    setLayoutMode("default");
    setChapterOrderMode("auto");
    setManualOrderIds(defaultChapterItems.map((item) => item.id));
    setStep(1);
  }, [defaultAuthor, defaultChapterItems, open]);

  useEffect(() => {
    if (language.toLowerCase().startsWith("ja")) {
      setLayoutMode("ja-vertical");
    } else if (layoutMode === "ja-vertical") {
      setLayoutMode("default");
    }
  }, [language, layoutMode]);

  if (!open) {
    return null;
  }

  const handleExport = async () => {
    if (sortedItems.length === 0) {
      return;
    }
    setExporting(true);
    try {
      const blob = await buildBilingualEpubBlob(sortedItems, {
        title: bookTitle.trim() || "双语译文合集",
        author: author.trim() || "iTranslate",
        language,
        identifier: crypto.randomUUID(),
        layoutMode,
      });
      const safeTitle = (bookTitle.trim() || "双语译文合集").replace(/[\\/:*?"<>|]/g, "_");
      const savedPath = await saveEpubByPicker(blob, `${safeTitle}.epub`, defaultDir);
      if (!savedPath) {
        return;
      }
      if (savedPath && setDefaultDir) {
        const dir = savedPath.slice(0, Math.max(savedPath.lastIndexOf("/"), savedPath.lastIndexOf("\\")));
        if (dir) {
          onChangeDefaultDir(dir);
        }
      }
      if (setDefaultAuthor && author.trim()) {
        onChangeDefaultAuthor(author.trim());
      }
      onToast(`EPUB 已保存成功：${savedPath}`);
      onClose();
      setStep(1);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="modal-mask" role="dialog" aria-modal="true" aria-label="导出 EPUB 向导">
      <section className="modal-card">
        <header className="history-header">
          <h3>导出 EPUB（步骤 {step}/2）</h3>
          <button type="button" onClick={onClose}>关闭</button>
        </header>

        {step === 1 ? (
          <div className="wizard-form">
            <label>
              电子书标题
              <input value={bookTitle} onChange={(event) => setBookTitle(event.target.value)} />
            </label>
            <label>
              作者
              <input value={author} onChange={(event) => setAuthor(event.target.value)} />
            </label>
            <label className="inline-check">
              <input type="checkbox" checked={setDefaultAuthor} onChange={(event) => setSetDefaultAuthor(event.target.checked)} />
              将该作者设为默认偏好
            </label>
            <label>
              语言代码
              <input value={language} onChange={(event) => setLanguage(event.target.value)} />
            </label>
            <label>
              阅读布局
              <select value={layoutMode} onChange={(event) => setLayoutMode(event.target.value as EpubLayoutMode)}>
                <option value="default">标准横排</option>
                <option value="ja-vertical">日文竖排（右到左段落流）</option>
              </select>
            </label>
            <label>
              默认导出目录（当前）
              <input value={defaultDir ?? ""} readOnly placeholder="未设置，导出时手动选择" />
            </label>
            <label className="inline-check">
              <input type="checkbox" checked={setDefaultDir} onChange={(event) => setSetDefaultDir(event.target.checked)} />
              将本次选择的目录设为默认偏好
            </label>
          </div>
        ) : (
          <div className="wizard-form">
            <label>
              章节排序（按标题）
              <select value={sortOrder} onChange={(event) => setSortOrder(event.target.value as SortOrder)}>
                <option value="asc">升序（默认）</option>
                <option value="desc">降序</option>
              </select>
            </label>
            <label>
              排序方式
              <select
                value={chapterOrderMode}
                onChange={(event) => setChapterOrderMode(event.target.value as ChapterOrderMode)}
              >
                <option value="auto">自动排序</option>
                <option value="manual">手动排序</option>
              </select>
            </label>
            <p>将导出 {sortedItems.length} 个章节（每条记录一个章节，含原文+译文）。</p>
            <div className="wizard-preview">
              {sortedItems.map((item, index) => {
                const moveUpDisabled = chapterOrderMode !== "manual" || index === 0;
                const moveDownDisabled = chapterOrderMode !== "manual" || index === sortedItems.length - 1;
                return (
                  <div key={item.id} className="wizard-row">
                    <span>{index + 1}. {item.title}</span>
                    <div className="table-actions">
                      <button
                        type="button"
                        className="icon-btn icon-only"
                        title="上移"
                        aria-label="上移"
                        disabled={moveUpDisabled}
                        onClick={() => {
                          if (moveUpDisabled) return;
                          setManualOrderIds((prev) => {
                            const next = [...prev];
                            const idx = next.indexOf(item.id);
                            if (idx <= 0) return prev;
                            [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                            return next;
                          });
                        }}
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button
                        type="button"
                        className="icon-btn icon-only"
                        title="下移"
                        aria-label="下移"
                        disabled={moveDownDisabled}
                        onClick={() => {
                          if (moveDownDisabled) return;
                          setManualOrderIds((prev) => {
                            const next = [...prev];
                            const idx = next.indexOf(item.id);
                            if (idx < 0 || idx >= next.length - 1) return prev;
                            [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
                            return next;
                          });
                        }}
                      >
                        <ArrowDown size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <footer className="table-actions">
          <button type="button" onClick={onClose}>取消</button>
          {step > 1 ? <button type="button" onClick={() => setStep((value) => value - 1)}>上一步</button> : null}
          {step < 2 ? (
            <button type="button" className="icon-btn primary" onClick={() => setStep(2)}>下一步</button>
          ) : (
            <button type="button" className="icon-btn primary" onClick={() => void handleExport()} disabled={exporting}>
              {exporting ? "导出中..." : "导出 EPUB"}
            </button>
          )}
        </footer>
      </section>
    </div>
  );
}
