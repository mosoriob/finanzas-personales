'use client';

import { totalPages } from '@/lib/month-utils';

interface PaginationProps {
  currentPage: number;
  totalCount: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

function ChevronLeft() {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

export function Pagination({
  currentPage,
  totalCount,
  pageSize,
  onPageChange,
}: PaginationProps) {
  const pages = totalPages(totalCount, pageSize);

  if (pages <= 1) return null;

  const from = (currentPage - 1) * pageSize + 1;
  const to = Math.min(currentPage * pageSize, totalCount);

  function goToPage(page: number) {
    onPageChange(page);
  }

  // Build a compact page range: show first, last, current ±1, and ellipsis
  function buildPageRange(): (number | 'ellipsis-left' | 'ellipsis-right')[] {
    if (pages <= 7) {
      return Array.from({ length: pages }, (_, i) => i + 1);
    }

    const range: (number | 'ellipsis-left' | 'ellipsis-right')[] = [1];

    const left = Math.max(2, currentPage - 1);
    const right = Math.min(pages - 1, currentPage + 1);

    if (left > 2) range.push('ellipsis-left');
    for (let i = left; i <= right; i++) range.push(i);
    if (right < pages - 1) range.push('ellipsis-right');

    range.push(pages);
    return range;
  }

  const pageRange = buildPageRange();

  return (
    <div className="flex flex-col items-center gap-3 pt-4">
      {/* Count label */}
      <p className="text-xs text-gray-400">
        Mostrando {from}–{to} de {totalCount} transacciones
      </p>

      {/* Page buttons */}
      <div className="flex items-center gap-1">
        {/* Prev */}
        <button
          type="button"
          onClick={() => goToPage(currentPage - 1)}
          disabled={currentPage <= 1}
          aria-label="Página anterior"
          className="flex items-center justify-center w-8 h-8 rounded-full text-gray-500 hover:bg-indigo-50 hover:text-indigo-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft />
        </button>

        {pageRange.map((item, idx) => {
          if (item === 'ellipsis-left' || item === 'ellipsis-right') {
            return (
              <span
                key={`${item}-${idx}`}
                className="w-8 text-center text-sm text-gray-400"
              >
                …
              </span>
            );
          }
          const isActive = item === currentPage;
          return (
            <button
              key={item}
              type="button"
              onClick={() => goToPage(item)}
              aria-current={isActive ? 'page' : undefined}
              className={`flex items-center justify-center w-8 h-8 rounded-full text-sm transition-colors ${
                isActive
                  ? 'bg-indigo-500 text-white font-semibold'
                  : 'text-gray-600 hover:bg-indigo-50 hover:text-indigo-500'
              }`}
            >
              {item}
            </button>
          );
        })}

        {/* Next */}
        <button
          type="button"
          onClick={() => goToPage(currentPage + 1)}
          disabled={currentPage >= pages}
          aria-label="Página siguiente"
          className="flex items-center justify-center w-8 h-8 rounded-full text-gray-500 hover:bg-indigo-50 hover:text-indigo-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronRight />
        </button>
      </div>
    </div>
  );
}
