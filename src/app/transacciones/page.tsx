import { prisma } from "@/lib/db";
import { TransaccionesClient } from "./TransaccionesClient";

export const dynamic = "force-dynamic";

export default async function TransaccionesPage() {
  const [transactions, accounts, categories] = await Promise.all([
    prisma.transaction.findMany({
      include: {
        account: true,
        category: true,
      },
      orderBy: { date: "desc" },
    }),
    prisma.account.findMany({ orderBy: { name: "asc" } }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
  ]);

  // Serialize dates to ISO strings so they can safely cross the Server→Client boundary
  const serializedTransactions = transactions.map((t) => ({
    id: t.id,
    date: t.date.toISOString(),
    description: t.description,
    amount: t.amount,
    account: { id: t.account.id, name: t.account.name },
    category: { id: t.category.id, name: t.category.name, emoji: t.category.emoji },
  }));

  const serializedAccounts = accounts.map((a) => ({ id: a.id, name: a.name }));
  const serializedCategories = categories.map((c) => ({
    id: c.id,
    name: c.name,
    emoji: c.emoji,
  }));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-800">Transacciones</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Historial completo de movimientos
        </p>
      </div>
      <TransaccionesClient
        transactions={serializedTransactions}
        accounts={serializedAccounts}
        categories={serializedCategories}
      />
    </div>
  );
}
