"use server";

import { prisma } from "@/lib/db";
import { matchCategory } from "@/lib/rules";
import { serializeRules, planImport, type ImportReport } from "@/lib/rules-io";
import {
  computeSuggestions,
  type RuleSuggestion,
  type AmbiguousMerchant,
} from "@/lib/rule-suggestions";
import { revalidatePath } from "next/cache";

export async function createAccount(formData: FormData) {
  const name = formData.get("name") as string;
  const bank = formData.get("bank") as string;
  const type = formData.get("type") as string;
  const color = (formData.get("color") as string) || "#6366f1";

  if (!name?.trim() || !bank || !type) {
    throw new Error("Faltan campos obligatorios");
  }

  await prisma.account.create({
    data: {
      name: name.trim(),
      bank,
      type,
      color,
      balance: 0,
    },
  });

  revalidatePath("/config");
}

export async function deleteAccount(id: number) {
  await prisma.account.delete({
    where: { id },
  });

  revalidatePath("/config");
}

export async function toggleAccountVisibility(id: number) {
  const account = await prisma.account.findUniqueOrThrow({ where: { id } });
  await prisma.account.update({
    where: { id },
    data: { hidden: !account.hidden },
  });
  revalidatePath("/config");
  revalidatePath("/");
  revalidatePath("/cuentas");
  revalidatePath("/transacciones");
}

export async function createCategory(formData: FormData) {
  const name = formData.get("name") as string;
  const emoji = (formData.get("emoji") as string) || "📌";

  if (!name?.trim()) {
    throw new Error("El nombre es obligatorio");
  }

  await prisma.category.create({
    data: {
      name: name.trim(),
      emoji: emoji.trim() || "📌",
    },
  });

  revalidatePath("/config");
}

export type UpdateCategoryResult =
  | { ok: true }
  | { ok: false; error: string };

export async function updateCategory(
  id: number,
  data: { name: string; emoji: string }
): Promise<UpdateCategoryResult> {
  const trimmedName = data.name.trim();
  if (!trimmedName) return { ok: false, error: "El nombre no puede estar vacío" };

  // Check uniqueness (excluding self)
  const existing = await prisma.category.findFirst({
    where: { name: trimmedName, NOT: { id } },
  });
  if (existing) return { ok: false, error: "Ya existe una categoría con ese nombre" };

  await prisma.category.update({
    where: { id },
    data: { name: trimmedName, emoji: data.emoji.trim() || "📌" },
  });

  revalidatePath("/config");
  revalidatePath("/transacciones");
  return { ok: true };
}

export type DeleteCategoryResult =
  | { ok: true }
  | { ok: false; error: string };

export async function deleteCategory(
  id: number,
  replacementCategoryId: number
): Promise<DeleteCategoryResult> {
  if (id === replacementCategoryId) {
    return { ok: false, error: "La categoría de reemplazo no puede ser la misma" };
  }

  const [target, replacement] = await Promise.all([
    prisma.category.findUnique({ where: { id } }),
    prisma.category.findUnique({ where: { id: replacementCategoryId } }),
  ]);
  if (!target) return { ok: false, error: "Categoría no encontrada" };
  if (!replacement) return { ok: false, error: "Categoría de reemplazo no encontrada" };

  await prisma.$transaction([
    prisma.transaction.updateMany({
      where: { categoryId: id },
      data: { categoryId: replacementCategoryId },
    }),
    prisma.rule.updateMany({
      where: { categoryId: id },
      data: { categoryId: replacementCategoryId },
    }),
    prisma.category.delete({ where: { id } }),
  ]);

  revalidatePath("/config");
  revalidatePath("/transacciones");
  revalidatePath("/");
  return { ok: true };
}

// ─── Rules ───

export type RuleMutationResult =
  | { ok: true }
  | { ok: false; error: string };

async function findRuleByMatch(match: string, excludeId?: number) {
  // SQLite (via Prisma) has no `mode: "insensitive"`, so compare case-insensitively
  // in memory. The DB still enforces a COLLATE NOCASE UNIQUE index as a backstop.
  const needle = match.trim().toLowerCase();
  const rules = await prisma.rule.findMany();
  return rules.find(
    (r) => r.match.trim().toLowerCase() === needle && r.id !== excludeId
  );
}

// Shared validation for createRule/updateRule. On success returns the trimmed
// match text so callers don't re-trim. `excludeId` skips a rule when checking
// for duplicates (so a rule can keep its own match text on update).
async function validateRuleInput(
  data: { match: string; categoryId: number },
  excludeId?: number
): Promise<{ ok: true; match: string } | { ok: false; error: string }> {
  const trimmedMatch = data.match.trim();
  if (!trimmedMatch) {
    return { ok: false, error: "El texto a buscar no puede estar vacío" };
  }

  const category = await prisma.category.findUnique({
    where: { id: data.categoryId },
  });
  if (!category) return { ok: false, error: "Categoría no encontrada" };

  const duplicate = await findRuleByMatch(trimmedMatch, excludeId);
  if (duplicate) {
    return { ok: false, error: "Ya existe una regla con ese texto" };
  }

  return { ok: true, match: trimmedMatch };
}

export async function createRule(data: {
  match: string;
  categoryId: number;
}): Promise<RuleMutationResult> {
  const validation = await validateRuleInput(data);
  if (!validation.ok) return validation;

  await prisma.rule.create({
    data: { match: validation.match, categoryId: data.categoryId },
  });

  revalidatePath("/config");
  return { ok: true };
}

export async function updateRule(
  id: number,
  data: { match: string; categoryId: number }
): Promise<RuleMutationResult> {
  const validation = await validateRuleInput(data, id);
  if (!validation.ok) return validation;

  await prisma.rule.update({
    where: { id },
    data: { match: validation.match, categoryId: data.categoryId },
  });

  revalidatePath("/config");
  return { ok: true };
}

export async function deleteRule(id: number): Promise<void> {
  await prisma.rule.delete({ where: { id } });
  revalidatePath("/config");
}

// ─── Export rules ───

// Loads all rules + categories and returns the portable JSON document as a
// string. The client wraps this in a Blob and triggers a dated download.
// Serialization (the versioned shape, category-by-name resolution) lives in the
// pure `serializeRules` seam; this action is wiring only. No `/api` route is
// introduced — consistent with the server-action-only rule CRUD.
export async function exportRules(): Promise<string> {
  const [rules, categories] = await Promise.all([
    prisma.rule.findMany(),
    prisma.category.findMany(),
  ]);

  const file = serializeRules(rules, categories, new Date());
  return JSON.stringify(file, null, 2);
}

// ─── Import rules ───

// Reason-coded report returned to the Reglas panel after an import, or a
// structural error that rejected the whole file (nothing written). The success
// branch is exactly the planner's `ImportReport` plus the `ok` discriminant, so
// the two stay in sync as report fields evolve.
export type ImportRulesResult =
  | ({ ok: true } & ImportReport)
  | { ok: false; error: string };

// Loads the existing rules + categories, delegates every decision to the pure
// `planImport` seam, then — when the plan is accepted — executes every rule
// insert (each carrying a `connectOrCreate` for its category) inside one
// `prisma.$transaction`, so the auto-created categories and the rule inserts are
// atomic. A structural problem rejects the whole file: nothing is written. The
// operation is otherwise non-destructive (existing matches are skipped, never
// overwritten), so the client runs it immediately on file selection with no
// confirm step. An empty/whitespace file plans nothing and is a harmless no-op.
export async function importRules(
  fileContents: string
): Promise<ImportRulesResult> {
  const [rules, categories] = await Promise.all([
    prisma.rule.findMany(),
    prisma.category.findMany(),
  ]);

  const plan = planImport(fileContents, { rules, categories });
  if (!plan.ok) return { ok: false, error: plan.error };

  if (plan.toCreate.length > 0) {
    await prisma.$transaction(
      plan.toCreate.map((r) =>
        prisma.rule.create({
          data: {
            match: r.match,
            category: {
              connectOrCreate: {
                where: { name: r.category.name },
                create: { name: r.category.name, emoji: r.category.emoji },
              },
            },
          },
        })
      )
    );
    revalidatePath("/config");
  }

  return { ok: true, ...plan.report };
}

// ─── Rule suggestions (from manual categorizations) ───

export type LoadSuggestionsResult = {
  suggestions: RuleSuggestion[];
  ambiguous: AmbiguousMerchant[];
};

// Loads the live data (transactions + rules + dismissals) and delegates every
// decision to the pure `computeSuggestions` seam. Recomputed each call so the
// panel always reflects the latest categorizations and rules (no stale store).
// When "Otro" is missing, every category is treated as suggestible (no rows are
// excluded as "Otro"), which is harmless on a DB that should always have it.
export async function loadRuleSuggestions(): Promise<LoadSuggestionsResult> {
  const [transactions, rules, dismissals, otro] = await Promise.all([
    prisma.transaction.findMany({
      select: { description: true, categoryId: true, manuallySet: true },
    }),
    prisma.rule.findMany({ select: { id: true, match: true, categoryId: true } }),
    prisma.dismissedSuggestion.findMany({
      select: { match: true, categoryId: true },
    }),
    prisma.category.findFirst({ where: { name: "Otro" } }),
  ]);

  return computeSuggestions(transactions, rules, dismissals, otro?.id ?? -1);
}

// Records a dismissal so the suggestion never reappears. Idempotent: a repeat
// dismissal of the same (match, categoryId) is a no-op thanks to the unique key.
export async function dismissSuggestion(data: {
  match: string;
  categoryId: number;
}): Promise<{ ok: true }> {
  const match = data.match.trim();
  await prisma.dismissedSuggestion.upsert({
    where: { match_categoryId: { match, categoryId: data.categoryId } },
    update: {},
    create: { match, categoryId: data.categoryId },
  });
  revalidatePath("/config");
  return { ok: true };
}

export type AcceptSuggestionResult =
  | { ok: true; recategorized: number }
  | { ok: false; error: string };

// Accepting a suggestion creates the rule (reusing the validated `createRule`
// seam) and then immediately sweeps any matching "Otro" transactions into the
// target category, returning how many were recategorized. Only "Otro"
// transactions are ever touched — manual categorizations are never overwritten
// — so the auto-apply is safe. Reassignment respects the full rule engine's
// longest-match resolution, counting only transactions that land in the new
// category.
export async function acceptSuggestion(data: {
  match: string;
  categoryId: number;
}): Promise<AcceptSuggestionResult> {
  const created = await createRule(data);
  if (!created.ok) return created;

  const otro = await prisma.category.findFirst({ where: { name: "Otro" } });
  if (!otro) return { ok: true, recategorized: 0 };

  const [transactions, rules] = await Promise.all([
    prisma.transaction.findMany({
      where: { categoryId: otro.id },
      select: { id: true, description: true },
    }),
    prisma.rule.findMany({ select: { id: true, match: true, categoryId: true } }),
  ]);

  const ids = transactions
    .filter((t) => matchCategory(t.description, rules) === data.categoryId)
    .map((t) => t.id);

  if (ids.length > 0) {
    await prisma.transaction.updateMany({
      where: { id: { in: ids } },
      data: { categoryId: data.categoryId },
    });
    revalidatePath("/config");
    revalidatePath("/transacciones");
    revalidatePath("/");
  }

  return { ok: true, recategorized: ids.length };
}

// ─── Apply rules to existing transactions ───

export type ApplyRulesPreview =
  | { ok: true; count: number }
  | { ok: false; error: string };

export type ApplyRulesResult =
  | { ok: true; updated: number }
  | { ok: false; error: string };

type Reassignment = { id: number; categoryId: number };

// Computes which transactions currently in "Otro" would move to a different
// category if the current rule set were applied. Only "Otro" transactions are
// considered (manual categorizations are never overwritten), and a transaction
// is included only when a rule matches AND points at a different category.
async function computeRuleReassignments(): Promise<
  | { ok: true; reassignments: Reassignment[] }
  | { ok: false; error: string }
> {
  const otro = await prisma.category.findFirst({ where: { name: "Otro" } });
  if (!otro) return { ok: false, error: 'No existe la categoría "Otro"' };

  const [transactions, rules] = await Promise.all([
    prisma.transaction.findMany({
      where: { categoryId: otro.id },
      select: { id: true, description: true },
    }),
    prisma.rule.findMany({
      select: { id: true, match: true, categoryId: true },
    }),
  ]);

  const reassignments: Reassignment[] = [];
  for (const t of transactions) {
    const matched = matchCategory(t.description, rules);
    if (matched !== null && matched !== otro.id) {
      reassignments.push({ id: t.id, categoryId: matched });
    }
  }

  return { ok: true, reassignments };
}

// Step 1 of "apply to existing": how many "Otro" transactions would change.
export async function previewApplyRules(): Promise<ApplyRulesPreview> {
  const result = await computeRuleReassignments();
  if (!result.ok) return result;
  return { ok: true, count: result.reassignments.length };
}

// Step 2 of "apply to existing": perform the recategorization and report how
// many transactions were updated.
export async function applyRulesToExisting(): Promise<ApplyRulesResult> {
  const result = await computeRuleReassignments();
  if (!result.ok) return result;

  const { reassignments } = result;
  if (reassignments.length === 0) return { ok: true, updated: 0 };

  // Group by target category so we issue one updateMany per category.
  const byCategory = new Map<number, number[]>();
  for (const r of reassignments) {
    const ids = byCategory.get(r.categoryId) ?? [];
    ids.push(r.id);
    byCategory.set(r.categoryId, ids);
  }

  await prisma.$transaction(
    [...byCategory.entries()].map(([categoryId, ids]) =>
      prisma.transaction.updateMany({
        where: { id: { in: ids } },
        data: { categoryId },
      })
    )
  );

  revalidatePath("/config");
  revalidatePath("/transacciones");
  revalidatePath("/");
  return { ok: true, updated: reassignments.length };
}
