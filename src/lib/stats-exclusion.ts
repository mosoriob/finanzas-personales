/**
 * Single source of truth for keeping a category out of every statistic.
 *
 * A category flagged `excluded` (e.g. "Movimiento interno" — money moved
 * between the user's own accounts) is neither expense nor income. Any
 * aggregate — donut, expense/income/net totals, per-household pending, in
 * both CLP and USD — gates its rows through this predicate so an excluded
 * category never contributes to a sum. It stays fully visible in the
 * transactions list and selectable in the category picker.
 */

type StatsExcludable = { category: { excluded: boolean } };

/** A transaction counts toward statistics unless its category is excluded. */
export function countsInStats(t: StatsExcludable): boolean {
  return !t.category.excluded;
}
