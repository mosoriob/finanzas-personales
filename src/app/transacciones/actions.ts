"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export type UpdateCategoryResult =
  | { ok: true }
  | { ok: false; error: string };

export async function updateTransactionCategory(
  transactionId: number,
  categoryId: number,
): Promise<UpdateCategoryResult> {
  if (!Number.isInteger(transactionId) || transactionId <= 0) {
    return { ok: false, error: "Datos inválidos" };
  }
  if (!Number.isInteger(categoryId) || categoryId <= 0) {
    return { ok: false, error: "Datos inválidos" };
  }

  try {
    await prisma.transaction.update({
      where: { id: transactionId },
      data: { categoryId },
    });
  } catch {
    return { ok: false, error: "No se pudo actualizar" };
  }

  revalidatePath("/transacciones");
  revalidatePath("/"); // dashboard donut depends on categories
  return { ok: true };
}

export type UpdateNoteResult =
  | { ok: true }
  | { ok: false; error: string };

export async function updateTransactionNote(
  id: number,
  note: string | null,
): Promise<UpdateNoteResult> {
  if (!Number.isInteger(id) || id <= 0) {
    return { ok: false, error: "Datos inválidos" };
  }

  const normalizedNote = note?.trim() || null;

  try {
    await prisma.transaction.update({
      where: { id },
      data: { note: normalizedNote },
    });
  } catch {
    return { ok: false, error: "No se pudo actualizar la nota" };
  }

  revalidatePath("/transacciones");
  return { ok: true };
}

export async function updateSharedFlags(
  id: number,
  isShared: boolean,
  isReimbursed: boolean,
): Promise<void> {
  const normalizedReimbursed = isShared ? isReimbursed : false;

  await prisma.transaction.update({
    where: { id },
    data: { isShared, isReimbursed: normalizedReimbursed },
  });

  revalidatePath("/transacciones");
}
