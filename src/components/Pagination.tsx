interface PaginationProps {
  currentPage: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
}

function createPageItems(currentPage: number, totalPages: number): Array<number | string> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages = new Set<number>([1, 2, totalPages - 1, totalPages, currentPage - 1, currentPage, currentPage + 1]);
  const sorted = Array.from(pages).filter((page) => page >= 1 && page <= totalPages).sort((a, b) => a - b);

  const result: Array<number | string> = [];
  for (const page of sorted) {
    const last = result[result.length - 1];
    if (typeof last === "number" && page - last > 1) {
      result.push("...");
    }
    result.push(page);
  }
  return result;
}

export function Pagination({ currentPage, pageSize, total, onChange }: PaginationProps) {
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) {
    return null;
  }

  const pageItems = createPageItems(currentPage, totalPages);

  return (
    <div className="pagination">
      <button type="button" disabled={currentPage === 1} onClick={() => onChange(currentPage - 1)}>
        上一页
      </button>
      {pageItems.map((item, index) => {
        if (typeof item !== "number") {
          return (
            <span className="ellipsis" key={`ellipsis-${index}`}>
              ...
            </span>
          );
        }

        return (
          <button
            type="button"
            key={item}
            className={item === currentPage ? "active" : ""}
            onClick={() => onChange(item)}
          >
            {item}
          </button>
        );
      })}
      <button
        type="button"
        disabled={currentPage === totalPages}
        onClick={() => onChange(currentPage + 1)}
      >
        下一页
      </button>
    </div>
  );
}
