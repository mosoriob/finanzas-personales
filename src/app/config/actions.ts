"use server";

import { prisma } from "@/lib/db";
import { matchCategory } from "@/lib/rules";
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
