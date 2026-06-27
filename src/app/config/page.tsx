import { prisma } from "@/lib/db";
import { ConfigClient } from "./ConfigClient";

export const dynamic = "force-dynamic";

export default async function ConfigPage() {
  const [accounts, categories, rules] = await Promise.all([
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
    prisma.rule.findMany({
      orderBy: { match: "asc" },
      include: { category: true },
    }),
  ]);

  const ruleViews = rules.map((r) => ({
    id: r.id,
    match: r.match,
    categoryId: r.categoryId,
    category: { id: r.category.id, name: r.category.name, emoji: r.category.emoji },
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-800">Configuración</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Administra tus cuentas, categorías y reglas
        </p>
      </div>
      <ConfigClient accounts={accounts} categories={categories} rules={ruleViews} />
    </div>
  );
}
