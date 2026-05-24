'use client';

import { useRouter } from 'next/navigation';
import { formatMonthLabel, navigateMonth, buildMonthUrl } from '@/lib/month-utils';

interface MonthPickerProps {
  /** "todo" | "YYYY-MM" (e.g. "2026-05") — the current mes param value */
  mes: string;
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

export function MonthPicker({ mes }: MonthPickerProps) {
  const router = useRouter();

  const isTodo = mes === 'todo';
  let year = 0;
  let month = 0;

  if (!isTodo && /^\d{4}-\d{2}$/.test(mes)) {
    const [y, m] = mes.split('-').map(Number);
    year = y;
    month = m;
  } else if (!isTodo) {
    // Fallback to current month if mes is unparseable
    const now = new Date();
    year = now.getFullYear();
    month = now.getMonth() + 1;
  }

  function goTo(url: string) {
    router.push(url);
  }

  function handlePrev() {
    if (isTodo) return;
    const { year: ny, month: nm } = navigateMonth(year, month, 'prev');
    goTo(buildMonthUrl(ny, nm));
  }

  function handleNext() {
    if (isTodo) return;
    const { year: ny, month: nm } = navigateMonth(year, month, 'next');
    goTo(buildMonthUrl(ny, nm));
  }

  function handleTodo() {
    goTo(buildMonthUrl('todo'));
  }

  const label = isTodo ? 'Todos' : formatMonthLabel(year, month);

  return (
    <div className="flex items-center gap-2">
      {/* Left arrow */}
      <button
        type="button"
        onClick={handlePrev}
        disabled={isTodo}
        aria-label="Mes anterior"
        className="flex items-center justify-center w-8 h-8 rounded-full text-gray-500 hover:bg-white hover:text-indigo-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <ChevronLeft />
      </button>

      {/* Month label */}
      <span className="text-sm font-semibold text-gray-700 min-w-[130px] text-center select-none">
        {label}
      </span>

      {/* Right arrow */}
      <button
        type="button"
        onClick={handleNext}
        disabled={isTodo}
        aria-label="Mes siguiente"
        className="flex items-center justify-center w-8 h-8 rounded-full text-gray-500 hover:bg-white hover:text-indigo-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <ChevronRight />
      </button>

      {/* Todo button */}
      <button
        type="button"
        onClick={handleTodo}
        className={`ml-2 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
          isTodo
            ? 'bg-indigo-50 border-violet-300 text-indigo-500'
            : 'bg-white border-indigo-100 text-gray-500 hover:border-indigo-200 hover:text-indigo-400'
        }`}
      >
        Todo
      </button>
    </div>
  );
}
