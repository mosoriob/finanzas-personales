/**
 * Peso-only summary for the transactions screen.
 *
 * Every total here is "pesos only" by construction: USD rows are filtered out
 * via the shared isCLP predicate before summing, so a USD charge can never
 * silently undercount a peso total. The count of excluded USD rows feeds the
 * single integrity indicator the screen shows alongside the summary.
 */

import { isCLP } from "@/lib/currency";
import { householdPendingTotals, type Familiar } from "@/lib/familiar";
import { countsInStats } from "@/lib/stats-exclusion";

type SummaryInput = {
  amount: number;
  currency?: string | null;
  familiar: Familiar | null;
  isReimbursed: boolean;
  category: { excluded: boolean };
};

export type TransactionSummary = {
  expenses: number;
  income: number;
  pendingByHousehold: Record<Familiar, number>;
  excludedUsdCount: number;
};

export function summarizeTransactions(
  transactions: readonly SummaryInput[],
): TransactionSummary {
  // Excluded categories (e.g. internal movements) are invisible to every
  // total, so drop them before any sum — including the excluded-USD count.
  const counted = transactions.filter(countsInStats);
  const pesoRows = counted.filter((t) => isCLP(t));
  const expenses = pesoRows
    .filter((t) => t.amount < 0)
    .reduce((acc, t) => acc + t.amount, 0);
  const income = pesoRows
    .filter((t) => t.amount > 0)
    .reduce((acc, t) => acc + t.amount, 0);
  const pendingByHousehold = householdPendingTotals(pesoRows);
  const excludedUsdCount = counted.length - pesoRows.length;
  return { expenses, income, pendingByHousehold, excludedUsdCount };
}

/** Spanish indicator text for USD charges left out of the peso totals. */
export function excludedUsdLabel(count: number): string {
  return count === 1
    ? "1 cargo en US$ no incluido en los totales"
    : `${count} cargos en US$ no incluidos en los totales`;
}
