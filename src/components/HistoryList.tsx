import { useEffect, useMemo, useRef, useState } from "react";
import type { TranslationHistoryItem } from "../types";
import { ExportEpubWizard } from "./ExportEpubWizard";
import { Pagination } from "./Pagination";

interface HistoryListProps {
  items: TranslationHistoryItem[];
  currentPage: number;
  pageSize: number;
  onChangePage: (page: number) => void;
  onOpenDetail: (item: TranslationHistoryItem) => void;
  onRenameTitle: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  defaultEpubAuthor: string;
  defaultEpubDir: string | null;
  onChangeDefaultEpubAuthor: (author: string) => void;
  onChangeDefaultEpubDir: (dir: string | null) => void;
}

export function HistoryList({
  items,
  currentPage,
  pageSize,
  onChangePage,
  onOpenDetail,
  onRenameTitle,
  onDelete,
  defaultEpubAuthor,
  defaultEpubDir,
  onChangeDefaultEpubAuthor,
  onChangeDefaultEpubDir,
}: HistoryListProps) {
  const [searchText, setSearchText] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [targetFilter, setTargetFilter] = useState("");
  const [engineFilter, setEngineFilter] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [wizardOpen, setWizardOpen] = useState(false);

  const prevFiltersRef = useRef({
    searchText: "",
    sourceFilter: "",
    targetFilter: "",
    engineFilter: "",
  });

  const sourceOptions = useMemo(() => Array.from(new Set(items.map((item) => item.sourceLanguage))).sort(), [items]);
  const targetOptions = useMemo(() => Array.from(new Set(items.map((item) => item.targetLanguage))).sort(), [items]);
  const engineOptions = useMemo(() => Array.from(new Set(items.map((item) => item.engineName))).sort(), [items]);

  const filteredItems = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();
    return items.filter((item) => {
      if (sourceFilter && item.sourceLanguage !== sourceFilter) return false;
      if (targetFilter && item.targetLanguage !== targetFilter) return false;
      if (engineFilter && item.engineName !== engineFilter) return false;
      if (!keyword) return true;

      const haystack = [item.title, item.inputMarkdown, item.outputMarkdown, item.engineName].join("\n").toLowerCase();
      return haystack.includes(keyword);
    });
  }, [engineFilter, items, searchText, sourceFilter, targetFilter]);

  useEffect(() => {
    const prev = prevFiltersRef.current;
    if (
      prev.searchText === searchText
      && prev.sourceFilter === sourceFilter
      && prev.targetFilter === targetFilter
      && prev.engineFilter === engineFilter
    ) {
      return;
    }
    prevFiltersRef.current = { searchText, sourceFilter, targetFilter, engineFilter };
    onChangePage(1);
  }, [engineFilter, onChangePage, searchText, sourceFilter, targetFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  useEffect(() => {
    if (currentPage > totalPages) {
      onChangePage(totalPages);
    }
  }, [currentPage, onChangePage, totalPages]);

  const safePage = Math.min(currentPage, totalPages);
  const start = (safePage - 1) * pageSize;
  const pageItems = filteredItems.slice(start, start + pageSize);

  const validSelectedIds = useMemo(() => {
    const idSet = new Set(items.map((item) => item.id));
    return selectedIds.filter((id) => idSet.has(id));
  }, [items, selectedIds]);

  const selectedItems = useMemo(() => {
    const set = new Set(validSelectedIds);
    return items.filter((item) => set.has(item.id));
  }, [items, validSelectedIds]);

  const allPageSelected = pageItems.length > 0 && pageItems.every((item) => validSelectedIds.includes(item.id));

  return (
    <section className="history-list">
      <header className="history-header">
        <h2>历史记录</h2>
      </header>

      <section className="history-filters">
        <input
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
          placeholder="搜索标题/原文/译文/引擎"
          aria-label="历史搜索"
        />
        <select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)} aria-label="筛选源语言">
          <option value="">全部源语言</option>
          {sourceOptions.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
        <select value={targetFilter} onChange={(event) => setTargetFilter(event.target.value)} aria-label="筛选目标语言">
          <option value="">全部目标语言</option>
          {targetOptions.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
        <select value={engineFilter} onChange={(event) => setEngineFilter(event.target.value)} aria-label="筛选引擎">
          <option value="">全部引擎</option>
          {engineOptions.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
      </section>

      {pageItems.length === 0 ? (
        <p className="empty">暂无记录</p>
      ) : (
        <div className="history-table-wrap">
          <table className="history-table">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    checked={allPageSelected}
                    onChange={() => {
                      if (allPageSelected) {
                        setSelectedIds((prev) => prev.filter((id) => !pageItems.some((item) => item.id === id)));
                        return;
                      }
                      setSelectedIds((prev) => {
                        const merged = new Set([...prev, ...pageItems.map((item) => item.id)]);
                        return Array.from(merged);
                      });
                    }}
                    aria-label="全选当前页"
                  />
                </th>
                <th>标题</th>
                <th>语言方向</th>
                <th>翻译引擎</th>
                <th>时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((item) => (
                <tr key={item.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={validSelectedIds.includes(item.id)}
                      onChange={() => {
                        setSelectedIds((prev) => (
                          prev.includes(item.id) ? prev.filter((id) => id !== item.id) : [...prev, item.id]
                        ));
                      }}
                      aria-label={`选择翻译记录-${item.title}`}
                    />
                  </td>
                  <td>
                    <input
                      value={item.title}
                      onChange={(event) => onRenameTitle(item.id, event.target.value)}
                      aria-label="历史标题"
                    />
                  </td>
                  <td>{item.sourceLanguage} → {item.targetLanguage}</td>
                  <td>
                    <div className="credential-cell">
                      <strong>{item.engineDeleted ? `${item.engineName}（已删除）` : item.engineName}</strong>
                      <small>{item.provider}/{item.model}</small>
                    </div>
                  </td>
                  <td>{new Date(item.createdAt).toLocaleString()}</td>
                  <td>
                    <div className="table-actions">
                      <button type="button" onClick={() => onOpenDetail(item)}>查看/编辑</button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedIds((prev) => prev.filter((id) => id !== item.id));
                          onDelete(item.id);
                        }}
                      >
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="history-footer">
        <div className="table-actions">
          <span className="status-label">总计 {items.length} 条 / 筛选后 {filteredItems.length} 条 / 已选 {validSelectedIds.length} 条</span>
          <button type="button" onClick={() => setWizardOpen(true)} disabled={validSelectedIds.length === 0}>导出 EPUB</button>
        </div>
        <Pagination currentPage={safePage} pageSize={pageSize} total={filteredItems.length} onChange={onChangePage} />
      </div>

      <ExportEpubWizard
        open={wizardOpen}
        items={selectedItems}
        defaultAuthor={defaultEpubAuthor}
        defaultDir={defaultEpubDir}
        onChangeDefaultAuthor={onChangeDefaultEpubAuthor}
        onChangeDefaultDir={onChangeDefaultEpubDir}
        onClose={() => setWizardOpen(false)}
      />
    </section>
  );
}
