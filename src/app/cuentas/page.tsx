import { prisma } from "@/lib/db";
import { isCLP } from "@/lib/currency";
import { AccountsClient } from "./AccountsClient";

export const dynamic = "force-dynamic";

function getDateRange() {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  const start = new Date(now);
  start.setDate(start.getDate() - 29); // last 30 days (today + 29 previous)
  start.setHours(0, 0, 0, 0);

  return { start, end };
}

function getMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

function toISODateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export default async function CuentasPage() {
  const { start: last30Start, end: last30End } = getDateRange();
  const { start: monthStart, end: monthEnd } = getMonthRange();

  // Fetch all accounts with their last-30-day transactions
  const accounts = await prisma.account.findMany({
    where: { hidden: false },
    orderBy: { id: "asc" },
    include: {
      transactions: {
        where: {
          date: {
            gte: last30Start,
            lte: last30End,
          },
        },
        orderBy: { date: "desc" },
      },
    },
  });

  // Compute per-account stats and daily bars
  const accountsWithStats = accounts.map((account) => {
    // Monthly expenses and count
    let monthlyExpenses = 0;
    let monthlyCount = 0;
    for (const tx of account.transactions) {
      if (tx.date >= monthStart && tx.date <= monthEnd) {
        monthlyCount++;
        // Peso-only: USD charges aren't summed into the peso expense figure.
        if (tx.amount < 0 && isCLP(tx)) {
          monthlyExpenses += tx.amount;
        }
      }
    }

    // Build daily bars map (last 30 days, keyed by "YYYY-MM-DD")
    const dailyMap = new Map<string, number>();

    // Seed all 30 days with 0 so empty days still appear
    for (let i = 29; i >= 0; i--) {
      const d = new Date(last30End);
      d.setDate(d.getDate() - i);
      dailyMap.set(toISODateString(d), 0);
    }

    // Accumulate spending (negative amounts) into daily buckets
    for (const tx of account.transactions) {
      if (tx.amount < 0 && isCLP(tx)) {
        const key = toISODateString(tx.date);
        if (dailyMap.has(key)) {
          dailyMap.set(key, (dailyMap.get(key) ?? 0) + Math.abs(tx.amount));
        }
      }
    }

    const dailyBars = Array.from(dailyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, total]) => ({ date, total }));

    return {
      id: account.id,
      name: account.name,
      type: account.type,
      bank: account.bank,
      balance: account.balance,
      color: account.color,
      monthlyExpenses,
      monthlyCount,
      dailyBars,
      transactions: account.transactions.map((tx) => ({
        id: tx.id,
        date: tx.date.toISOString(),
        description: tx.description,
        amount: tx.amount,
        currency: tx.currency,
      })),
    };
  });

  return (
    <div>
      <div className="mb-7">
        <h1 className="text-[22px] font-semibold text-gray-800">Cuentas</h1>
        <p className="text-[13px] text-gray-400 mt-0.5">
          Selecciona una cuenta para ver sus movimientos recientes.
        </p>
      </div>
      <AccountsClient accounts={accountsWithStats} />
    </div>
  );
}
