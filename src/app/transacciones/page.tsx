import { prisma } from "@/lib/db";
import { TransaccionesClient } from "./TransaccionesClient";
import {
  parseMesParam,
  getDateFilterForMonth,
  parsePageParam,
} from "@/lib/month-utils";
import { isFamiliar, type Familiar } from "@/lib/familiar";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export default async function TransaccionesPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; pagina?: string }>;
}) {
  const params = await searchParams;
  const mesParam = params.mes;
  const pagina = parsePageParam(params.pagina);

  const dateInfo = parseMesParam(mesParam);
  const dateFilter = getDateFilterForMonth(dateInfo);

  // Resolve the effective mes string to pass to client (so MonthPicker
  // always has a concrete value even when the URL has no mes param).
  const effectiveMes =
    dateInfo.type === 'all'
      ? 'todo'
      : `${dateInfo.year}-${String(dateInfo.month).padStart(2, '0')}`;

  const whereFilter = {
    account: { hidden: false },
    ...(dateFilter ? { date: dateFilter } : {}),
  };

  const [transactions, totalCount, accounts, categories] = await Promise.all([
    prisma.transaction.findMany({
      where: whereFilter,
      include: {
        account: true,
        category: true,
      },
      orderBy: { date: "desc" },
      skip: (pagina - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.transaction.count({
      where: whereFilter,
    }),
    prisma.account.findMany({ where: { hidden: false }, orderBy: { name: "asc" } }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
  ]);

  // Serialize dates to ISO strings so they can safely cross the Server→Client boundary
  const serializedTransactions = transactions.map((t) => ({
    id: t.id,
    date: t.date.toISOString(),
    description: t.description,
    note: t.note,
    amount: t.amount,
    familiar: (isFamiliar(t.familiar) ? t.familiar : null) as Familiar | null,
    isReimbursed: t.isReimbursed,
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
        totalCount={totalCount}
        currentPage={pagina}
        pageSize={PAGE_SIZE}
        mes={effectiveMes}
      />
    </div>
  );
}
