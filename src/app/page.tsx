import { prisma } from "@/lib/db";
import { formatCLP } from "@/lib/format";
import { SpendingHeatmap, DailySpend } from "@/components/spending-heatmap";

export const dynamic = "force-dynamic";

// ─── helpers ───────────────────────────────────────────────────────────────

const MONTH_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

const PILL_BORDERS = ["border-indigo-300", "border-blue-300", "border-green-300"];

// ─── data fetching ─────────────────────────────────────────────────────────

async function getDashboardData() {
  const now = new Date();
  // Use UTC year/month consistently with the seeded data (dates are UTC midnight)
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth(); // 0-indexed

  const currentMonthStart = new Date(Date.UTC(year, month, 1));
  const currentMonthEnd = new Date(Date.UTC(year, month + 1, 1));

  const prevMonthStart = new Date(Date.UTC(year, month - 1, 1));
  const prevMonthEnd = currentMonthStart;

  const yearStart = new Date(Date.UTC(year, 0, 1));

  // All queries in parallel
  const [
    accounts,
    currentMonthTx,
    prevMonthTx,
    recentTx,
    yearTx,
  ] = await Promise.all([
    prisma.account.findMany({ orderBy: { id: "asc" } }),

    prisma.transaction.findMany({
      where: { date: { gte: currentMonthStart, lt: currentMonthEnd } },
      include: { category: true, account: true },
    }),

    prisma.transaction.findMany({
      where: { date: { gte: prevMonthStart, lt: prevMonthEnd }, amount: { lt: 0 } },
      select: { amount: true },
    }),

    prisma.transaction.findMany({
      orderBy: { date: "desc" },
      take: 5,
      include: { category: true, account: true },
    }),

    prisma.transaction.findMany({
      where: { date: { gte: yearStart, lt: currentMonthEnd }, amount: { lt: 0 } },
      select: { date: true, amount: true },
    }),
  ]);

  // ── Hero stats ───────────────────────────────────────────────
  const currentExpenses = currentMonthTx
    .filter((t) => t.amount < 0)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const prevExpenses = prevMonthTx.reduce((sum, t) => sum + Math.abs(t.amount), 0);

  let comparisonText = "";
  if (prevExpenses > 0) {
    const pct = Math.round(((currentExpenses - prevExpenses) / prevExpenses) * 100);
    const prevMonthName = MONTH_ES[month === 0 ? 11 : month - 1];
    comparisonText =
      pct >= 0
        ? `${pct}% más que en ${prevMonthName}`
        : `${Math.abs(pct)}% menos que en ${prevMonthName}`;
    // no prefix sign — text already says "más" or "menos"
  }

  const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);

  // ── Account pills ─────────────────────────────────────────────
  // Spent this month per account
  const spentByAccount = new Map<number, number>();
  for (const t of currentMonthTx) {
    if (t.amount < 0) {
      spentByAccount.set(t.accountId, (spentByAccount.get(t.accountId) ?? 0) + Math.abs(t.amount));
    }
  }

  // ── Category donut ────────────────────────────────────────────
  const categoryMap = new Map<string, { emoji: string; total: number }>();
  for (const t of currentMonthTx) {
    if (t.amount < 0) {
      const key = t.category.name;
      const prev = categoryMap.get(key) ?? { emoji: t.category.emoji, total: 0 };
      categoryMap.set(key, { emoji: prev.emoji, total: prev.total + Math.abs(t.amount) });
    }
  }
  const categoryBreakdown = Array.from(categoryMap.entries())
    .map(([name, v]) => ({ name, emoji: v.emoji, total: v.total }))
    .sort((a, b) => b.total - a.total);

  // ── Heatmap daily data ────────────────────────────────────────
  const dailyMap = new Map<string, number>();
  for (const t of yearTx) {
    const dateStr = new Date(t.date).toISOString().slice(0, 10);
    dailyMap.set(dateStr, (dailyMap.get(dateStr) ?? 0) + Math.abs(t.amount));
  }
  const heatmapData: DailySpend[] = Array.from(dailyMap.entries()).map(([date, amount]) => ({
    date,
    amount,
  }));

  const todayStr = now.toISOString().slice(0, 10);

  return {
    year,
    month,
    currentExpenses,
    comparisonText,
    totalBalance,
    accounts,
    spentByAccount,
    categoryBreakdown,
    recentTx,
    heatmapData,
    todayStr,
  };
}

// ─── donut chart ───────────────────────────────────────────────────────────

const DONUT_PALETTE = [
  "#6366f1", "#a78bfa", "#c4b5fd", "#818cf8", "#4f46e5",
  "#7c3aed", "#8b5cf6", "#ddd6fe", "#e0e7ff", "#c7d2fe",
];

function DonutChart({ segments }: { segments: { name: string; emoji: string; total: number; pct: number }[] }) {
  if (segments.length === 0) return <p className="text-sm text-gray-400">Sin datos</p>;

  // Build conic-gradient stops using prefix sums (no post-render mutation)
  const stops = segments.map((s, i) => {
    const start = segments.slice(0, i).reduce((acc, seg) => acc + seg.pct, 0);
    const end = start + s.pct;
    return `${DONUT_PALETTE[i % DONUT_PALETTE.length]} ${start.toFixed(2)}% ${end.toFixed(2)}%`;
  });
  const gradient = `conic-gradient(${stops.join(", ")})`;

  return (
    <div className="flex flex-col gap-5">
      {/* Donut */}
      <div className="flex justify-center">
        <div
          style={{
            width: 140,
            height: 140,
            borderRadius: "50%",
            background: gradient,
            mask: "radial-gradient(circle, transparent 48px, black 48px)",
            WebkitMask: "radial-gradient(circle, transparent 48px, black 48px)",
          }}
        />
      </div>

      {/* Legend rows */}
      <div className="flex flex-col gap-2">
        {segments.map((s, i) => (
          <div key={s.name} className="flex items-center gap-2.5">
            <div
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ background: DONUT_PALETTE[i % DONUT_PALETTE.length] }}
            />
            <span className="text-sm text-gray-600 flex-1 min-w-0 truncate">
              {s.emoji} {s.name}
            </span>
            <span className="text-xs text-gray-400 tabular-nums">{s.pct.toFixed(0)}%</span>
            <span className="text-sm font-medium text-gray-800 tabular-nums">
              ${s.total.toLocaleString("es-CL")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── page ──────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const {
    year,
    month,
    currentExpenses,
    comparisonText,
    totalBalance,
    accounts,
    spentByAccount,
    categoryBreakdown,
    recentTx,
    heatmapData,
    todayStr,
  } = await getDashboardData();

  const currentMonthName = MONTH_ES[month];

  // Category percentages
  const categoryTotal = categoryBreakdown.reduce((s, c) => s + c.total, 0);
  const categorySegments = categoryBreakdown.map((c) => ({
    ...c,
    pct: categoryTotal > 0 ? (c.total / categoryTotal) * 100 : 0,
  }));

  // Comparison sign
  const isMore = comparisonText.startsWith("+");

  return (
    <div className="flex flex-col gap-6">
      {/* ── Hero ───────────────────────────────────────────────── */}
      <section className="flex flex-col items-center text-center gap-2 pt-4 pb-2">
        <p className="text-sm text-gray-400 tracking-wide uppercase font-medium">
          Gastado en {currentMonthName}
        </p>
        <p
          className="text-4xl md:text-5xl font-bold tracking-tight"
          style={{ color: "#333" }}
        >
          ${currentExpenses.toLocaleString("es-CL")}
        </p>
        {comparisonText && (
          <p
            className="text-sm font-medium"
            style={{ color: isMore ? "#ef4444" : "#22c55e" }}
          >
            {comparisonText}
          </p>
        )}
        <p className="text-xs text-gray-400 mt-1">
          Balance total:{" "}
          <span className="font-medium text-gray-600">{formatCLP(totalBalance)}</span>{" "}
          en {accounts.length} cuenta{accounts.length !== 1 ? "s" : ""}
        </p>
      </section>

      {/* ── Account pills ──────────────────────────────────────── */}
      <section className="flex flex-wrap justify-center gap-3">
        {accounts.map((account, idx) => {
          const borderClass = PILL_BORDERS[idx] ?? "border-gray-200";
          const spent = spentByAccount.get(account.id) ?? 0;
          return (
            <div
              key={account.id}
              className={`flex flex-col gap-0.5 rounded-2xl border-2 ${borderClass} bg-[#f9f9f9] px-5 py-3.5 min-w-[160px]`}
            >
              <p className="text-[13px] font-semibold text-gray-700 truncate">{account.name}</p>
              <p className="text-lg font-bold text-gray-900 tabular-nums">
                {formatCLP(account.balance)}
              </p>
              <p className="text-[11px] text-gray-400 tabular-nums">
                ${spent.toLocaleString("es-CL")} gastados este mes
              </p>
            </div>
          );
        })}
      </section>

      {/* ── Heatmap ────────────────────────────────────────────── */}
      <section
        className="rounded-[20px] p-7"
        style={{ background: "#f9f9f9" }}
      >
        <h2 className="text-[13px] font-semibold text-gray-500 uppercase tracking-wide mb-5">
          Actividad de gastos {year}
        </h2>
        <div className="relative">
          <SpendingHeatmap data={heatmapData} year={year} today={todayStr} />
        </div>
      </section>

      {/* ── Two-column grid ────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left: Category donut */}
        <section
          className="rounded-[20px] p-7"
          style={{ background: "#f9f9f9" }}
        >
          <h2 className="text-[13px] font-semibold text-gray-500 uppercase tracking-wide mb-5">
            Gastos por categoría
          </h2>
          <DonutChart segments={categorySegments} />
        </section>

        {/* Right: Recent transactions */}
        <section
          className="rounded-[20px] p-7"
          style={{ background: "#f9f9f9" }}
        >
          <h2 className="text-[13px] font-semibold text-gray-500 uppercase tracking-wide mb-5">
            Últimas transacciones
          </h2>
          <div className="flex flex-col gap-1">
            {recentTx.map((tx) => {
              const txDate = new Date(tx.date);
              const day = txDate.getUTCDate();
              const mon = MONTH_ES[txDate.getUTCMonth()].slice(0, 3);
              const isExpense = tx.amount < 0;
              return (
                <div
                  key={tx.id}
                  className="flex items-center gap-3 rounded-[14px] px-3 py-2.5 hover:bg-white transition-colors"
                >
                  {/* Emoji icon */}
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                    style={{ background: "#ede9fe" }}
                  >
                    {tx.category.emoji}
                  </div>

                  {/* Description + meta */}
                  <div className="flex flex-col min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {tx.description}
                    </p>
                    <p className="text-[11px] text-gray-400 truncate">
                      {day} {mon} · {tx.account.name}
                    </p>
                  </div>

                  {/* Amount */}
                  <p
                    className="text-sm font-semibold tabular-nums flex-shrink-0"
                    style={{ color: isExpense ? "#ef4444" : "#22c55e" }}
                  >
                    {isExpense ? "" : "+"}
                    {formatCLP(tx.amount)}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
