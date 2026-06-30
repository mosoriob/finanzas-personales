/**
 * Per-category expense breakdown for the /gastos page.
 *
 * Unlike the dashboard donut (server-aggregated, fixed), this powers an
 * interactive view: the user picks a household lens and toggles categories
 * on/off, and the breakdown recomputes in the browser. The input rows are
 * already scoped on the server to expenses only and non-excluded categories
 * (see countsInStats); here we apply the two view-only filters — household and
 * the off-category set — and keep USD out of the peso total while counting it
 * for the integrity note.
 */

import {
  matchesHouseholdFilter,
  type Familiar,
  type HouseholdFilter,
} from "@/lib/familiar";

export type GastoRow = {
  amount: number; // negative (expense), native units
  isCLP: boolean;
  familiar: Familiar | null;
  category: { id: number; name: string; emoji: string };
};

export type CategoryAggregate = {
  id: number;
  name: string;
  emoji: string;
  total: number; // positive CLP magnitude
  count: number;
};

export type GastosBreakdown = {
  /** All categories with spending in scope, sorted by total descending. */
  categories: CategoryAggregate[];
  /** Sum of the categories that are toggled ON (off-set excluded). */
  visibleTotal: number;
  /** USD expense rows in the current household scope (kept out of the total). */
  usdCount: number;
};

export function buildGastosBreakdown(
  rows: readonly GastoRow[],
  householdFilter: HouseholdFilter,
  offCategoryIds: ReadonlySet<number>,
): GastosBreakdown {
  const byId = new Map<number, CategoryAggregate>();
  let usdCount = 0;

  for (const r of rows) {
    if (!matchesHouseholdFilter(r.familiar, householdFilter)) continue;
    if (!r.isCLP) {
      usdCount++;
      continue;
    }
    const prev =
      byId.get(r.category.id) ??
      {
        id: r.category.id,
        name: r.category.name,
        emoji: r.category.emoji,
        total: 0,
        count: 0,
      };
    prev.total += Math.abs(r.amount);
    prev.count += 1;
    byId.set(r.category.id, prev);
  }

  const categories = Array.from(byId.values()).sort(
    (a, b) => b.total - a.total,
  );
  const visibleTotal = categories.reduce(
    (sum, c) => (offCategoryIds.has(c.id) ? sum : sum + c.total),
    0,
  );

  return { categories, visibleTotal, usdCount };
}
