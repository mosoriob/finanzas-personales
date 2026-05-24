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
