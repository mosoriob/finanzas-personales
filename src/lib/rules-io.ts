/**
 * Portable import/export format for categorization rules.
 *
 * This module is the single pure seam for the rules file format: it has no
 * database or network access, mirroring how `matchCategory` in `rules.ts` is a
 * pure seam reused by the bank sync and apply-rules action. The thin
 * `exportRules` server action loads the data and delegates all format logic
 * here.
 *
 * Categories are referenced by **name** (and carry their emoji) rather than by
 * numeric id, so a file exported from one database imports faithfully into
 * another where the category ids differ.
 *
 * Import side: `planImport` is the pure decision seam. It parses a valid export
 * file and computes the executable plan (rule inserts) plus a report (what was
 * created vs skipped). The thin `importRules` server action loads the existing
 * rules + categories, calls this, and runs the inserts in one transaction. This
 * slice covers the happy path — referenced categories are assumed to exist
 * locally; structural rejection, per-rule validation, within-file dedup, and
 * auto-creating missing categories belong to the robustness slice.
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

// ─── Import ───

/** A rule already present locally — only its `match` matters for skip checks. */
export type ImportableRule = { match: string };

/** A category already present locally, resolved by `name` during import. */
export type ImportableCategory = { id: number; name: string };

/** Snapshot of the local DB that `planImport` decides against. */
export type ImportExistingState = {
  rules: ImportableRule[];
  categories: ImportableCategory[];
};

/** One rule insert in the executable plan: trimmed match + resolved category id. */
export type PlannedRule = { match: string; categoryId: number };

/** What `planImport` produces: the executable plan plus the Spanish-UI report. */
export type ImportPlan = {
  /** Rules to insert (the only writes this slice performs). */
  toCreate: PlannedRule[];
  report: {
    /** Match texts that will be created. */
    created: string[];
    /** Match texts skipped because they already exist locally. */
    skippedExisting: string[];
  };
};

/**
 * Pure function (no DB / no network): given the contents of an export file and a
 * snapshot of the local rules + categories, compute the import plan and report.
 *
 * Happy-path slice:
 * - Each file rule's `match` is trimmed (held to the same normalization as a
 *   manually-created rule).
 * - A match that already exists locally — compared case-insensitively after
 *   trimming on both sides — is skipped, never overwritten (`skippedExisting`).
 * - Otherwise the rule's category is resolved by **existing name** and the rule
 *   is planned for creation. (Categories are assumed to exist locally; an
 *   unresolved category is skipped defensively — auto-create is a later slice.)
 *
 * An empty/whitespace file, or a valid file with no rules, is a harmless no-op.
 */
export function planImport(
  fileContents: string,
  existing: ImportExistingState
): ImportPlan {
  const empty: ImportPlan = {
    toCreate: [],
    report: { created: [], skippedExisting: [] },
  };

  const trimmed = fileContents.trim();
  if (trimmed.length === 0) return empty;

  const parsed = JSON.parse(trimmed) as RulesExportFile;
  const fileRules = parsed.rules ?? [];

  const categoryIdByName = new Map(
    existing.categories.map((c) => [c.name, c.id])
  );
  const existingMatches = new Set(
    existing.rules.map((r) => r.match.trim().toLowerCase())
  );

  const toCreate: PlannedRule[] = [];
  const skippedExisting: string[] = [];

  for (const entry of fileRules) {
    const match = entry.match.trim();
    if (existingMatches.has(match.toLowerCase())) {
      skippedExisting.push(match);
      continue;
    }
    const categoryId = categoryIdByName.get(entry.category.name);
    if (categoryId === undefined) continue; // category auto-create: later slice
    toCreate.push({ match, categoryId });
  }

  const created = toCreate.map((r) => r.match);
  return { toCreate, report: { created, skippedExisting } };
}
