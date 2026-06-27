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
  onDelete?: () => void;
}

export function TransactionCard({
  transaction: t,
  onCategoryClick,
  onDelete,
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
        {/* Row 1: description + amount + delete */}
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium text-gray-800 leading-snug">
            {t.description}
          </p>
          <div className="flex items-center gap-2 flex-shrink-0">
            {onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="text-gray-300 hover:text-red-500 transition-colors flex-shrink-0"
                aria-label="Eliminar transacción"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="w-4 h-4"
                >
                  <path
                    fillRule="evenodd"
                    d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            )}
            <p
              className="text-sm font-semibold tabular-nums"
              style={{ color: isPositive ? "#38a169" : "#1a202c" }}
            >
              {formatCLP(t.amount)}
            </p>
          </div>
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
