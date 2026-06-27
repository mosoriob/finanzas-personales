/**
 * Pure categorization-rule matching. No DB, no network — this is the single
 * seam used by both the bank sync and the "apply to existing" action.
 */

/** The minimal shape `matchCategory` needs from a rule. */
export type MatchableRule = {
  id: number;
  /** Text to look for in a transaction description (compared case-insensitively). */
  match: string;
  /** Category assigned when this rule wins. */
  categoryId: number;
};

/**
 * Returns the winning `categoryId` for a transaction description, or `null`
 * when no rule matches (the caller then assigns "Otro").
 *
 * Matching semantics:
 * - case-insensitive substring: the description *contains* the rule's match text
 * - when several rules match, the one with the longest `match` wins
 * - ties on equal length are broken by lowest `id` for determinism
 */
export function matchCategory(
  description: string,
  rules: MatchableRule[]
): number | null {
  const haystack = description.toLowerCase();

  let winner: MatchableRule | null = null;
  for (const rule of rules) {
    const needle = rule.match.toLowerCase();
    if (!needle || !haystack.includes(needle)) continue;

    if (
      winner === null ||
      needle.length > winner.match.length ||
      (needle.length === winner.match.length && rule.id < winner.id)
    ) {
      winner = rule;
    }
  }

  return winner ? winner.categoryId : null;
}
