import { prisma } from "@/lib/db";
import { isCLP } from "@/lib/currency";
import { isFamiliar } from "@/lib/familiar";
import { parseMesParam, getDateFilterForMonth } from "@/lib/month-utils";
import { GastosClient } from "./GastosClient";
import type { GastoRow } from "@/lib/gastos-breakdown";

export const dynamic = "force-dynamic";

export default async function GastosPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const params = await searchParams;
  const dateInfo = parseMesParam(params.mes);
  const dateFilter = getDateFilterForMonth(dateInfo);

  // Concrete mes value so MonthPicker always has something to render.
  const effectiveMes =
    dateInfo.type === "all"
      ? "todo"
      : `${dateInfo.year}-${String(dateInfo.month).padStart(2, "0")}`;

  // Expenses only, non-excluded categories (the stats-exclusion gate, done in
  // the query). Household and per-category toggles are applied client-side.
  const transactions = await prisma.transaction.findMany({
    where: {
      account: { hidden: false },
      amount: { lt: 0 },
      category: { excluded: false },
      ...(dateFilter ? { date: dateFilter } : {}),
    },
    select: {
      amount: true,
      currency: true,
      familiar: true,
      category: { select: { id: true, name: true, emoji: true } },
    },
  });

  const rows: GastoRow[] = transactions.map((t) => ({
    amount: t.amount,
    isCLP: isCLP(t),
    familiar: isFamiliar(t.familiar) ? t.familiar : null,
    category: t.category,
  }));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-800">Gastos</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Entiende tu gasto prendiendo y apagando categorías
        </p>
      </div>
      <GastosClient rows={rows} mes={effectiveMes} />
    </div>
  );
}
