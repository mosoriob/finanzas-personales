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
