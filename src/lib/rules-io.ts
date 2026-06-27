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
 * Import side: `planImport` is the pure decision seam. It parses an export file,
 * hardens it (structural rejection + per-rule validation + within-file dedup),
 * and computes the executable plan (categories to auto-create + rule inserts)
 * plus a reason-coded report. The thin `importRules` server action loads the
 * existing rules + categories, calls this, and — when the plan is accepted —
 * runs every rule insert (each with a `connectOrCreate` for its category) inside
 * one `prisma.$transaction`, so category-creates and rule-inserts are atomic.
 */

/** Current export format version. Only this version is recognized today. */
export const RULES_FILE_VERSION = 1;

/** Emoji a category falls back to when a file entry has no usable emoji. */
export const DEFAULT_CATEGORY_EMOJI = "📌";

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

/** A category already present locally, reused by `name` during import. */
export type ImportableCategory = { id: number; name: string };

/** Snapshot of the local DB that `planImport` decides against. */
export type ImportExistingState = {
  rules: ImportableRule[];
  categories: ImportableCategory[];
};

/**
 * One rule insert in the executable plan: trimmed match plus its category by
 * name + emoji. The category is referenced by name (not id) because it may not
 * exist locally yet; the action resolves/creates it via `connectOrCreate`. The
 * emoji is only used when the category has to be created.
 */
export type PlannedRule = {
  match: string;
  category: { name: string; emoji: string };
};

/** Reason-coded report distinguishing why each file rule was created or skipped. */
export type ImportReport = {
  /** Match texts that will be created. */
  created: string[];
  /** Category names that will be auto-created (didn't exist locally). */
  createdCategories: string[];
  /** Match texts skipped because they already exist locally. */
  skippedExisting: string[];
  /** Match texts skipped because the entry was invalid (empty match / no category). */
  skippedInvalid: string[];
  /** Match texts skipped because an earlier file entry already used that match. */
  skippedDuplicate: string[];
};

/**
 * What `planImport` produces. Hybrid validation: a structural problem (bad JSON,
 * unknown version, wrong shape) rejects the whole import (`ok: false`), while a
 * per-rule problem only skips that rule (reported under `ok: true`).
 */
export type ImportPlan =
  | { ok: false; error: string }
  | { ok: true; toCreate: PlannedRule[]; report: ImportReport };

/**
 * Pure function (no DB / no network): given the contents of an export file and a
 * snapshot of the local rules + categories, validate and compute the import plan
 * plus a reason-coded report.
 *
 * Structural rejection (reject-all): invalid JSON, an unknown `version`, or a
 * wrong top-level shape rejects the entire import — nothing is planned.
 *
 * Per-rule handling (skip, valid siblings still import):
 * - `match` is trimmed (same normalization as a manually-created rule). An empty
 *   match or a missing/blank category name → `skippedInvalid`.
 * - A match that already exists locally — compared case-insensitively after
 *   trimming on both sides — is skipped, never overwritten (`skippedExisting`).
 * - A match a previous file entry already used (case-insensitive, after trim) is
 *   skipped as `skippedDuplicate` (first kept, rest dropped).
 * - Otherwise the rule is planned. Its category is reused by name if it exists
 *   locally (emoji left untouched); otherwise it is queued for auto-create with
 *   the file's emoji, falling back to the default when missing/blank.
 *
 * An empty/whitespace file, or a valid file with no rules, is a harmless no-op.
 */
export function planImport(
  fileContents: string,
  existing: ImportExistingState
): ImportPlan {
  const report: ImportReport = {
    created: [],
    createdCategories: [],
    skippedExisting: [],
    skippedInvalid: [],
    skippedDuplicate: [],
  };

  const trimmed = fileContents.trim();
  if (trimmed.length === 0) return { ok: true, toCreate: [], report };

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { ok: false, error: "El archivo no es un JSON válido." };
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { ok: false, error: "El archivo no tiene el formato esperado." };
  }
  const doc = parsed as { version?: unknown; rules?: unknown };
  if (doc.version !== RULES_FILE_VERSION) {
    return {
      ok: false,
      error: `Versión de archivo no compatible (se esperaba ${RULES_FILE_VERSION}).`,
    };
  }
  if (!Array.isArray(doc.rules)) {
    return { ok: false, error: "El archivo no tiene el formato esperado." };
  }

  const existingCategoryNames = new Set(existing.categories.map((c) => c.name));
  const existingMatches = new Set(
    existing.rules.map((r) => r.match.trim().toLowerCase())
  );
  const seenInFile = new Set<string>();
  const plannedCategories = new Set<string>();

  const toCreate: PlannedRule[] = [];

  for (const raw of doc.rules) {
    const entry = (raw ?? {}) as { match?: unknown; category?: unknown };
    const match = typeof entry.match === "string" ? entry.match.trim() : "";
    const category = (entry.category ?? {}) as { name?: unknown; emoji?: unknown };
    const categoryName =
      typeof category.name === "string" ? category.name.trim() : "";

    if (match.length === 0 || categoryName.length === 0) {
      report.skippedInvalid.push(match);
      continue;
    }

    const key = match.toLowerCase();
    if (existingMatches.has(key)) {
      report.skippedExisting.push(match);
      continue;
    }
    if (seenInFile.has(key)) {
      report.skippedDuplicate.push(match);
      continue;
    }
    seenInFile.add(key);

    const emoji =
      (typeof category.emoji === "string" ? category.emoji.trim() : "") ||
      DEFAULT_CATEGORY_EMOJI;
    toCreate.push({ match, category: { name: categoryName, emoji } });
    report.created.push(match);

    if (
      !existingCategoryNames.has(categoryName) &&
      !plannedCategories.has(categoryName)
    ) {
      plannedCategories.add(categoryName);
      report.createdCategories.push(categoryName);
    }
  }

  return { ok: true, toCreate, report };
}
