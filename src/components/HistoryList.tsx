import type { TranslationHistoryItem } from "../types";
import { Pagination } from "./Pagination";

interface HistoryListProps {
  items: TranslationHistoryItem[];
  currentPage: number;
  pageSize: number;
  onChangePage: (page: number) => void;
  onOpenDetail: (item: TranslationHistoryItem) => void;
  onRenameTitle: (id: string, title: string) => void;
  onDelete: (id: string) => void;
}

export function HistoryList({
  items,
  currentPage,
  pageSize,
  onChangePage,
  onOpenDetail,
  onRenameTitle,
  onDelete,
}: HistoryListProps) {
  const start = (currentPage - 1) * pageSize;
  const pageItems = items.slice(start, start + pageSize);

  return (
    <section className="history-list">
      <header className="history-header">
        <h2>历史记录</h2>
        <p>共 {items.length} 条</p>
      </header>

      {pageItems.length === 0 ? (
        <p className="empty">暂无记录</p>
      ) : (
        <div className="history-table-wrap">
          <table className="history-table">
            <thead>
              <tr>
                <th>标题</th>
                <th>语言方向</th>
                <th>模型</th>
                <th>引擎</th>
                <th>时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((item) => (
                <tr key={item.id}>
                  <td>
                    <input
                      value={item.title}
                      onChange={(event) => onRenameTitle(item.id, event.target.value)}
                      aria-label="历史标题"
                    />
                  </td>
                  <td>
                    {item.sourceLanguage} → {item.targetLanguage}
                  </td>
                  <td>{item.model}</td>
                  <td>{item.engineDeleted ? `${item.engineName}（已删除）` : item.engineName}</td>
                  <td>{new Date(item.createdAt).toLocaleString()}</td>
                  <td>
                    <div className="table-actions">
                      <button type="button" onClick={() => onOpenDetail(item)}>
                        查看/编辑
                      </button>
                      <button type="button" onClick={() => onDelete(item.id)}>
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

      <Pagination
        currentPage={currentPage}
        pageSize={pageSize}
        total={items.length}
        onChange={onChangePage}
      />
    </section>
  );
}
