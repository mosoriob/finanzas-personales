"use client";

import { formatCLP } from "@/lib/format";

const MONTH_ES = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

const CATEGORY_EMOJI: Record<string, string> = {
  Supermercado: "🛒",
  Transporte: "🚗",
  Entretenimiento: "🎬",
  Salud: "💊",
  Restaurant: "🍕",
  Servicios: "📱",
  Hogar: "🏠",
  Educación: "📚",
  Sueldo: "💰",
  Transferencia: "🔄",
  Otro: "📌",
};

type Transaction = {
  id: number;
  date: string;
  description: string;
  note: string | null;
  amount: number;
  isShared: boolean;
  isReimbursed: boolean;
  account: { id: number; name: string };
  category: { id: number; name: string; emoji: string };
};

interface TransactionCardProps {
  transaction: Transaction;
  onCategoryClick?: () => void;
}

export function TransactionCard({
  transaction: t,
  onCategoryClick,
}: TransactionCardProps) {
  const d = new Date(t.date);
  const day = d.getUTCDate();
  const mon = MONTH_ES[d.getUTCMonth()];
  const isPositive = t.amount >= 0;
  const emoji = CATEGORY_EMOJI[t.category.name] ?? t.category.emoji ?? "📌";
  const isSueldo = t.category.name === "Sueldo";

  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-100 last:border-0">
      {/* Emoji icon */}
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 mt-0.5"
        style={{ background: "#ede9fe" }}
      >
        {emoji}
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        {/* Row 1: description + amount */}
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium text-gray-800 leading-snug">
            {t.description}
          </p>
          <p
            className="text-sm font-semibold tabular-nums flex-shrink-0"
            style={{ color: isPositive ? "#38a169" : "#1a202c" }}
          >
            {formatCLP(t.amount)}
          </p>
        </div>

        {/* Row 2: account + date */}
        <p className="text-xs text-gray-400 mt-0.5">
          {t.account.name} · {day} {mon}
        </p>

        {/* Row 3: badges */}
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          <button
            type="button"
            onClick={onCategoryClick}
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
              isSueldo
                ? "bg-green-100 text-green-600"
                : "bg-indigo-50 text-indigo-500"
            }`}
          >
            {t.category.name}
          </button>
          {t.isShared && (
            <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-orange-50 text-orange-500">
              👥 Familiar
            </span>
          )}
          {t.isReimbursed && (
            <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-green-50 text-green-600">
              ✓ Devuelto
            </span>
          )}
        </div>

        {/* Note */}
        {t.note && (
          <p className="text-xs text-indigo-400 italic mt-1">{t.note}</p>
        )}
      </div>
    </div>
  );
}
