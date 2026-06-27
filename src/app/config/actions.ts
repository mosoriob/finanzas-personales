"use server";

import { prisma } from "@/lib/db";
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
