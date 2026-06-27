/**
 * A categorization rule: if a transaction description contains `match`
 * (case-insensitive substring), the transaction is assigned `categoryId`.
 *
 * `match` is stored as entered (casing preserved for display) but compared
 * case-insensitively. This is the single matching seam used by both the bank
 * sync and the "apply rules to existing" action.
 */
export type Rule = {
  id: number;
  match: string;
  categoryId: number;
};

/**
 * Pure function (no DB / no network): given a transaction description and a set
 * of rules, return the winning `categoryId`, or `null` when nothing matches.
 *
 * - Match test: the description contains the rule's `match` text as a
 *   case-insensitive substring.
 * - Conflict resolution: among all matching rules, the one with the longest
 *   `match` text wins; ties are broken by lowest `id` for determinism.
 * - No match (or empty rule set) → `null` (the caller assigns "Otro").
 */
export function matchCategory(
  description: string,
  rules: Rule[]
): number | null {
  const haystack = description.toLowerCase();

  let best: Rule | null = null;
  let bestLength = 0;

  for (const rule of rules) {
    const needle = rule.match.trim().toLowerCase();
    if (needle.length === 0) continue;
    if (!haystack.includes(needle)) continue;

    const isLonger = needle.length > bestLength;
    const isTieWithLowerId = needle.length === bestLength && best !== null && rule.id < best.id;

    if (best === null || isLonger || isTieWithLowerId) {
      best = rule;
      bestLength = needle.length;
    }
  }

  return best ? best.categoryId : null;
}
