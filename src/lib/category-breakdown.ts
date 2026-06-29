/**
 * Expense-by-category breakdown for the dashboard donut.
 *
 * Peso-only by construction (USD rows have no FX source), expenses only
 * (negative amounts), and excluded categories never appear — so an internal
 * movement can't dominate the chart. Returns categories sorted by total spend.
 */

import { isCLP } from "@/lib/currency";
import { countsInStats } from "@/lib/stats-exclusion";

type BreakdownInput = {
  amount: number;
  currency?: string | null;
  category: { name: string; emoji: string; excluded: boolean };
};

export type CategoryBreakdown = { name: string; emoji: string; total: number };

export function summarizeByCategory(
  transactions: readonly BreakdownInput[],
): CategoryBreakdown[] {
  const byName = new Map<string, { emoji: string; total: number }>();
  for (const t of transactions) {
    if (t.amount >= 0 || !isCLP(t) || !countsInStats(t)) continue;
    const prev = byName.get(t.category.name) ?? { emoji: t.category.emoji, total: 0 };
    byName.set(t.category.name, { emoji: prev.emoji, total: prev.total + Math.abs(t.amount) });
  }
  return Array.from(byName.entries())
    .map(([name, v]) => ({ name, emoji: v.emoji, total: v.total }))
    .sort((a, b) => b.total - a.total);
}
