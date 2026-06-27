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

export type DeleteTransactionResult =
  | { ok: true }
  | { ok: false; error: string };

export async function deleteTransaction(
  id: number,
): Promise<DeleteTransactionResult> {
  try {
    await prisma.transaction.delete({ where: { id } });
    revalidatePath('/transacciones');
    revalidatePath('/');
    return { ok: true };
  } catch {
    return { ok: false, error: 'No se pudo eliminar la transacción' };
  }
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

export type CreateTransactionResult =
  | {
      ok: true;
      transaction: {
        id: number;
        date: string;
        description: string;
        note: string | null;
        amount: number;
        accountId: number;
        categoryId: number;
        isShared: boolean;
        isReimbursed: boolean;
        createdAt: string;
      };
    }
  | { ok: false; error: string };

export async function createTransaction(data: {
  amount: number;
  type: "expense" | "income";
  description: string;
  date: string;
  accountId: number;
  categoryId: number;
  note?: string;
  isShared?: boolean;
  isReimbursed?: boolean;
}): Promise<CreateTransactionResult> {
  const finalAmount =
    data.type === "expense" ? -Math.abs(data.amount) : Math.abs(data.amount);

  try {
    const transaction = await prisma.transaction.create({
      data: {
        amount: finalAmount,
        description: data.description.trim(),
        date: new Date(data.date),
        accountId: data.accountId,
        categoryId: data.categoryId,
        note: data.note?.trim() || null,
        isShared: data.isShared ?? false,
        isReimbursed: data.isReimbursed ?? false,
      },
    });

    revalidatePath("/transacciones");
    revalidatePath("/");

    return {
      ok: true,
      transaction: {
        ...transaction,
        date: transaction.date.toISOString(),
        createdAt: transaction.createdAt.toISOString(),
      },
    };
  } catch {
    return { ok: false, error: "No se pudo crear la transacción" };
  }
}
