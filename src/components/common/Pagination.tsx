import type { FC } from "react";
import React from "react";

interface PaginationProps {
  pageIndex: number;
  pageSize: number;
  totalPages: number;
  onPageChange: (pageIndex: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  disabled?: boolean;
  totalRecords?: number;
}

const Pagination: FC<PaginationProps> = ({
  pageIndex,
  pageSize,
  totalPages,
  onPageChange,
  onPageSizeChange,
  disabled = false,
  totalRecords,
}) => {
  const canGoPrevious = pageIndex > 0;
  const canGoNext = pageIndex < totalPages - 1;

  const handlePageInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const page = e.target.value ? Number(e.target.value) - 1 : 0;
    if (page >= 0 && page < totalPages) {
      onPageChange(page);
    }
  };

  return (
    // Envoltorio de Resolución (reunión del 2026-09-16, punto 1): en pantallas estrechas la fila de
    // controles SCROLLEA en horizontal en vez de partirse en varias líneas, que era lo que hacía el
    // `join` suelto de antes — con los botones de página arriba y el selector de tamaño debajo.
    <div className="app-table-pagination-shell">
      <div className="app-table-pagination-inner">
        {/* Navigation Buttons */}
        <div className="join shrink-0">
          <button
            className="join-item btn btn-soft btn-primary"
            onClick={() => onPageChange(0)}
            disabled={disabled || !canGoPrevious}
            title="Primera página"
          >
            {"<<"}
          </button>
          <button
            className="join-item btn btn-soft btn-primary"
            onClick={() => onPageChange(Math.max(0, pageIndex - 1))}
            disabled={disabled || !canGoPrevious}
            title="Página anterior"
          >
            {"<"}
          </button>
          <button
            className="join-item btn btn-soft btn-primary"
            onClick={() =>
              onPageChange(Math.min(totalPages - 1, pageIndex + 1))
            }
            disabled={disabled || !canGoNext}
            title="Página siguiente"
          >
            {">"}
          </button>
          <button
            className="join-item btn btn-soft btn-primary"
            onClick={() => onPageChange(totalPages - 1)}
            disabled={disabled || !canGoNext}
            title="Última página"
          >
            {">>"}
          </button>
        </div>

        {/* Page Info and Input */}
        <div className="app-table-pagination-meta">
          <span className="flex items-center gap-1">
            <div>Página</div>
            <strong>
              {pageIndex + 1} de {totalPages}
            </strong>
          </span>
          <span className="divider divider-horizontal mx-1 h-6"></span>
          <span className="flex items-center gap-1">
            Ir a:
            <input
              type="number"
              min="1"
              max={totalPages}
              value={pageIndex + 1}
              onChange={handlePageInput}
              disabled={disabled}
              className="border p-1 rounded w-16"
            />
          </span>
          <span className="divider divider-horizontal mx-1 h-6"></span>
          <span className="flex items-center gap-1">
            Registros/página:
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              disabled={disabled}
              className="select select-bordered select-sm w-24"
            >
              {[5, 10, 20, 30, 40, 50].map((size) => (
                <option
                  key={size}
                  value={size}
                >
                  {size}
                </option>
              ))}
            </select>
          </span>
          {totalRecords !== undefined && (
            <>
              <span className="divider divider-horizontal mx-1 h-6"></span>
              <span className="text-sm text-neutral-500">
                Total: {totalRecords}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Pagination;
