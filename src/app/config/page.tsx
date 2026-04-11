import { prisma } from "@/lib/db";
import { ConfigClient } from "./ConfigClient";

export default async function ConfigPage() {
  const [accounts, categories] = await Promise.all([
    prisma.account.findMany({
      orderBy: { createdAt: "asc" },
    }),
    prisma.category.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: { transactions: true },
        },
      },
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-800">Configuración</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Administra tus cuentas y categorías
        </p>
      </div>
      <ConfigClient accounts={accounts} categories={categories} />
    </div>
  );
}
