/**
 * Portable import/export format for categorization rules.
 *
 * This module is the single pure seam for the rules file format: it has no
 * database or network access, mirroring how `matchCategory` in `rules.ts` is a
 * pure seam reused by the bank sync and apply-rules action. The thin
 * `exportRules` / `importRules` server actions load/persist data and delegate
 * all format and decision logic here.
 *
 * Categories are referenced by **name** (and carry their emoji) rather than by
 * numeric id, so a file exported from one database imports faithfully into
 * another where the category ids differ.
 */

/** Current export format version. Only this version is recognized today. */
export const RULES_FILE_VERSION = 1;

/** A rule as loaded from the database (the input to `serializeRules`). */
export type SerializableRule = {
  id: number;
  match: string;
  categoryId: number;
};

/** A category as loaded from the database (the input to `serializeRules`). */
export type SerializableCategory = {
  id: number;
  name: string;
  emoji: string;
};

/** One rule entry in the portable file: category referenced by name + emoji. */
export type ExportedRule = {
  match: string;
  category: { name: string; emoji: string };
};

/** The top-level portable export document. */
export type RulesExportFile = {
  version: number;
  exportedAt: string;
  rules: ExportedRule[];
};

/**
 * Pure function (no DB / no network): build the versioned export document from
 * the current rules and categories.
 *
 * Each rule's `categoryId` is resolved to its category's `name` + `emoji` so
 * the file is portable across databases. A rule whose category cannot be
 * resolved is skipped (defensive — the FK normally guarantees a match).
 */
export function serializeRules(
  rules: SerializableRule[],
  categories: SerializableCategory[],
  exportedAt: Date
): RulesExportFile {
  const byId = new Map(categories.map((c) => [c.id, c]));

  const exported: ExportedRule[] = [];
  for (const rule of rules) {
    const category = byId.get(rule.categoryId);
    if (!category) continue;
    exported.push({
      match: rule.match,
      category: { name: category.name, emoji: category.emoji },
    });
  }

  return {
    version: RULES_FILE_VERSION,
    exportedAt: exportedAt.toISOString(),
    rules: exported,
  };
}
