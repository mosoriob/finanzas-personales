import { matchesHouseholdFilter, type Familiar, type HouseholdFilter } from "./familiar";
import { totalPages } from "./month-utils";

export type TransactionFilters = {
  search: string;
  accountFilter: string; // 'todas' or an account name
  categoryFilter: string; // 'todas' or a category name
  householdFilter: HouseholdFilter;
};

export type FilterableTransaction = {
  description: string;
  note: string | null;
  familiar: Familiar | null;
  account: { name: string };
  category: { name: string };
};

/**
 * Apply the search / account / category / household filters in memory.
 * Mirrors the four filter controls in the transactions view.
 */
export function filterTransactions<T extends FilterableTransaction>(
  transactions: readonly T[],
  filters: TransactionFilters,
): T[] {
  const q = filters.search.trim().toLowerCase();
  return transactions.filter((t) => {
    if (q) {
      const matchesDesc = t.description.toLowerCase().includes(q);
      const matchesAccount = t.account.name.toLowerCase().includes(q);
      const matchesNote = t.note?.toLowerCase().includes(q) ?? false;
      if (!matchesDesc && !matchesAccount && !matchesNote) return false;
    }
    if (filters.accountFilter !== "todas" && t.account.name !== filters.accountFilter)
      return false;
    if (filters.categoryFilter !== "todas" && t.category.name !== filters.categoryFilter)
      return false;
    if (!matchesHouseholdFilter(t.familiar, filters.householdFilter)) return false;
    return true;
  });
}

export type PaginatedResult<T> = {
  pageItems: T[];
  filteredCount: number;
  totalPages: number;
};

/**
 * Filter the full set first, THEN paginate the result. This is the correct
 * order: page sizes and counts reflect the filtered set, not the raw set.
 * `page` is clamped to the available range.
 */
export function filterAndPaginate<T extends FilterableTransaction>(
  transactions: readonly T[],
  filters: TransactionFilters,
  page: number,
  pageSize: number,
): PaginatedResult<T> {
  const filtered = filterTransactions(transactions, filters);
  const filteredCount = filtered.length;
  const pages = totalPages(filteredCount, pageSize);
  const safePage = Math.min(Math.max(1, page), pages);
  const start = (safePage - 1) * pageSize;
  const pageItems = filtered.slice(start, start + pageSize);
  return { pageItems, filteredCount, totalPages: pages };
}
