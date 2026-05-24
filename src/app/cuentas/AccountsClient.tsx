"use client";

import { useState } from "react";
import { formatCLP } from "@/lib/format";

type DailyBar = {
  date: string; // ISO date string "YYYY-MM-DD"
  total: number; // absolute value of spending (positive number)
};

type AccountWithStats = {
  id: number;
  name: string;
  type: string;
  bank: string;
  balance: number;
  color: string;
  monthlyExpenses: number; // sum of negative amounts this month (negative number)
  monthlyCount: number; // transaction count this month
  dailyBars: DailyBar[]; // 30 days of daily spending
  transactions: {
    id: number;
    date: string; // ISO string
    description: string;
    amount: number;
  }[];
};

function formatDate(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "short",
  });
}

function formatDateShort(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function MiniBarChart({ bars }: { bars: DailyBar[] }) {
  const max = Math.max(...bars.map((b) => b.total), 1);

  const startDate = bars[0]?.date ?? "";
  const endDate = bars[bars.length - 1]?.date ?? "";

  return (
    <div className="mt-5">
      <div className="flex items-end gap-[3px] h-16">
        {bars.map((bar, i) => {
          const heightPct = max > 0 ? (bar.total / max) * 100 : 0;
          return (
            <div
              key={i}
              className="flex-1 flex flex-col justify-end"
              title={`${bar.date}: ${formatCLP(-bar.total)}`}
            >
              <div
                className="w-full rounded-t bg-gradient-to-t from-violet-300 to-violet-200"
                style={{ height: `${Math.max(heightPct, 2)}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex justify-between mt-1.5">
        <span className="text-[11px] text-gray-400">
          {startDate ? formatDateShort(startDate + "T00:00:00") : ""}
        </span>
        <span className="text-[11px] text-gray-400">
          {endDate ? formatDateShort(endDate + "T00:00:00") : ""}
        </span>
      </div>
    </div>
  );
}

function DetailPanel({ account }: { account: AccountWithStats }) {
  return (
    <div className="bg-[#f9f9f9] rounded-[20px] p-7 mt-6">
      {/* Header */}
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-lg font-semibold text-gray-800">
          {account.name}
          <span className="text-gray-400 font-normal"> — {account.bank}</span>
        </h2>
        <span className="text-[12px] text-gray-400 whitespace-nowrap shrink-0">
          Últimos 30 días
        </span>
      </div>

      {/* Bar chart */}
      <MiniBarChart bars={account.dailyBars} />

      {/* Transaction list */}
      <div className="mt-6">
        <div className="text-[12px] font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Movimientos
        </div>
        {account.transactions.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">
            Sin movimientos en los últimos 30 días.
          </p>
        ) : (
          <div className="flex flex-col gap-1">
            {account.transactions.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-[12px] text-gray-400 shrink-0 w-16">
                    {formatDate(tx.date)}
                  </span>
                  <span className="text-[13px] text-gray-700 truncate">
                    {tx.description}
                  </span>
                </div>
                <span
                  className="text-[13px] font-medium ml-4 shrink-0"
                  style={{ color: tx.amount >= 0 ? "#38a169" : undefined }}
                >
                  {formatCLP(tx.amount)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function AccountsClient({
  accounts,
}: {
  accounts: AccountWithStats[];
}) {
  const [selectedId, setSelectedId] = useState<number | null>(
    accounts[0]?.id ?? null
  );

  const selected = accounts.find((a) => a.id === selectedId) ?? null;

  return (
    <div>
      {/* Cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
        {accounts.map((account) => {
          const isSelected = account.id === selectedId;
          return (
            <button
              key={account.id}
              onClick={() => setSelectedId(account.id)}
              className={[
                "relative overflow-hidden bg-[#f8f7ff] rounded-[20px] p-7 text-left transition-all duration-150 cursor-pointer",
                "border-2",
                isSelected
                  ? "border-indigo-500"
                  : "border-transparent hover:border-violet-300 hover:-translate-y-0.5 hover:shadow-md",
              ].join(" ")}
            >
              {/* Colored stripe */}
              <div
                className="absolute top-0 left-0 right-0 h-1"
                style={{ background: account.color }}
              />

              {/* Bank name */}
              <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mt-1 mb-2">
                {account.bank}
              </div>

              {/* Account name */}
              <div className="text-[18px] font-semibold text-gray-800 leading-tight mb-1">
                {account.name}
              </div>

              {/* Type */}
              <div className="text-[12px] text-gray-400 mb-4">
                {account.type}
              </div>

              {/* Balance */}
              <div
                className={[
                  "text-[26px] font-bold leading-none mb-5",
                  account.balance < 0 ? "text-red-500" : "text-gray-800",
                ].join(" ")}
              >
                {formatCLP(account.balance)}
              </div>

              {/* Stats row */}
              <div className="flex items-center gap-4 pt-4 border-t border-gray-100">
                <div>
                  <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-0.5">
                    Gastos del mes
                  </div>
                  <div className="text-[13px] font-semibold text-gray-700">
                    {formatCLP(account.monthlyExpenses)}
                  </div>
                </div>
                <div className="w-px h-6 bg-gray-100" />
                <div>
                  <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-0.5">
                    Movimientos
                  </div>
                  <div className="text-[13px] font-semibold text-gray-700">
                    {account.monthlyCount}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Detail panel */}
      {selected && <DetailPanel account={selected} />}
    </div>
  );
}
