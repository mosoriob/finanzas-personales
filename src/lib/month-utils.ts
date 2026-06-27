/**
 * Utility functions for month-based filtering and pagination in the
 * transactions page.
 */

export type DateInfo =
  | { type: 'month'; year: number; month: number }
  | { type: 'all' };

const MONTH_NAMES: Record<number, string> = {
  1: 'Enero',
  2: 'Febrero',
  3: 'Marzo',
  4: 'Abril',
  5: 'Mayo',
  6: 'Junio',
  7: 'Julio',
  8: 'Agosto',
  9: 'Septiembre',
  10: 'Octubre',
  11: 'Noviembre',
  12: 'Diciembre',
};

/**
 * Parse the `mes` URL search parameter into a DateInfo.
 *
 * - undefined → current month
 * - "todo"    → all transactions (no date filter)
 * - "YYYY-MM" → specific month
 */
export function parseMesParam(mes: string | undefined): DateInfo {
  if (mes === 'todo') {
    return { type: 'all' };
  }

  if (mes && /^\d{4}-\d{2}$/.test(mes)) {
    const [yearStr, monthStr] = mes.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    if (year > 0 && month >= 1 && month <= 12) {
      return { type: 'month', year, month };
    }
  }

  // Default: current month
  const now = new Date();
  return {
    type: 'month',
    year: now.getFullYear(),
    month: now.getMonth() + 1,
  };
}

/**
 * Convert a DateInfo into a Prisma-compatible date where clause.
 * Returns undefined for the 'all' type (no filter).
 */
export function getDateFilterForMonth(
  info: DateInfo,
): { gte: Date; lt: Date } | undefined {
  if (info.type === 'all') {
    return undefined;
  }
  const { year, month } = info;
  return {
    gte: new Date(year, month - 1, 1),
    lt: new Date(year, month, 1),
  };
}

/**
 * Format a month label in Spanish: "Mayo 2026".
 */
export function formatMonthLabel(year: number, month: number): string {
  const name = MONTH_NAMES[month];
  if (!name) throw new Error(`Invalid month: ${month}`);
  return `${name} ${year}`;
}

/**
 * Navigate one month forward or backward, wrapping across year boundaries.
 */
export function navigateMonth(
  year: number,
  month: number,
  direction: 'prev' | 'next',
): { year: number; month: number } {
  if (direction === 'prev') {
    if (month === 1) return { year: year - 1, month: 12 };
    return { year, month: month - 1 };
  } else {
    if (month === 12) return { year: year + 1, month: 1 };
    return { year, month: month + 1 };
  }
}

/**
 * Build a URL query string for the given month or for "todo".
 * Always resets pagina to 1 when changing the month.
 */
export function buildMonthUrl(yearOrTodo: number | 'todo', month?: number): string {
  if (yearOrTodo === 'todo') {
    return '?mes=todo';
  }
  const m = String(month).padStart(2, '0');
  return `?mes=${yearOrTodo}-${m}`;
}

/**
 * Calculate total pages given a count and page size.
 */
export function totalPages(count: number, pageSize: number): number {
  if (count === 0) return 1;
  return Math.ceil(count / pageSize);
}

/**
 * Parse the `pagina` URL search parameter, clamping to a minimum of 1.
 */
export function parsePageParam(pagina: string | undefined): number {
  if (pagina === undefined) return 1;
  const n = parseInt(pagina, 10);
  if (isNaN(n) || n < 1) return 1;
  return n;
}
