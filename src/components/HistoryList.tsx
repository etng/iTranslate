import type { TranslationHistoryItem } from "../types";
import { Pagination } from "./Pagination";

interface HistoryListProps {
  items: TranslationHistoryItem[];
  currentPage: number;
  pageSize: number;
  onChangePage: (page: number) => void;
  onOpenDetail: (item: TranslationHistoryItem) => void;
  onRenameTitle: (id: string, title: string) => void;
}

export function HistoryList({
  items,
  currentPage,
  pageSize,
  onChangePage,
  onOpenDetail,
  onRenameTitle,
}: HistoryListProps) {
  const start = (currentPage - 1) * pageSize;
  const pageItems = items.slice(start, start + pageSize);

  return (
    <section className="history-list">
      <header>
        <h2>历史记录</h2>
        <p>共 {items.length} 条</p>
      </header>

      {pageItems.length === 0 ? (
        <p className="empty">暂无记录</p>
      ) : (
        <ul>
          {pageItems.map((item) => (
            <li key={item.id}>
              <input
                value={item.title}
                onChange={(event) => onRenameTitle(item.id, event.target.value)}
                aria-label="历史标题"
              />
              <div className="meta">
                <span>
                  {item.sourceLanguage} → {item.targetLanguage}
                </span>
                <span>{new Date(item.createdAt).toLocaleString()}</span>
              </div>
              <button type="button" onClick={() => onOpenDetail(item)}>
                查看
              </button>
            </li>
          ))}
        </ul>
      )}

      <Pagination
        currentPage={currentPage}
        pageSize={pageSize}
        total={items.length}
        onChange={onChangePage}
      />
    </section>
  );
}
