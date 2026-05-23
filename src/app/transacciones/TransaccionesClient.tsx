"use client";

import { useState, useMemo, useOptimistic, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { formatCLP } from "@/lib/format";
import { CategoryPicker } from "@/components/CategoryPicker";
import { updateTransactionCategory } from "./actions";

type Account = {
  id: number;
  name: string;
};

type Category = {
  id: number;
  name: string;
  emoji: string;
};

type Transaction = {
  id: number;
  date: string; // ISO string (serialized from Date)
  description: string;
  amount: number;
  account: Account;
  category: Category;
};

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

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function CategoryBadge({ name }: { name: string }) {
  const isSueldo = name === "Sueldo";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
        isSueldo
          ? "bg-green-100 text-green-600"
          : "bg-indigo-50 text-indigo-500"
      }`}
    >
      {name}
    </span>
  );
}

function SearchIcon() {
  return (
    <svg
      className="w-4 h-4 text-gray-400 flex-shrink-0"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth={2}
    >
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.35-4.35" strokeLinecap="round" />
    </svg>
  );
}

interface Props {
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
}

export function TransaccionesClient({ transactions, accounts, categories }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [search, setSearch] = useState("");
  const [accountFilter, setAccountFilter] = useState<string>("todas");
  const [categoryFilter, setCategoryFilter] = useState<string>("todas");
  const [openPickerForTxId, setOpenPickerForTxId] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [optimisticTransactions, applyOptimistic] = useOptimistic(
    transactions,
    (state, update: { txId: number; category: Category }) =>
      state.map((t) =>
        t.id === update.txId ? { ...t, category: { ...update.category } } : t,
      ),
  );

  // Auto-dismiss toast after 3000ms
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  function handleSelect(txId: number, newCategoryId: number) {
    setOpenPickerForTxId(null);
    const current = transactions.find((t) => t.id === txId);
    if (!current || current.category.id === newCategoryId) return; // no-op

    const newCategory = categories.find((c) => c.id === newCategoryId);
    if (!newCategory) return;

    startTransition(async () => {
      applyOptimistic({ txId, category: newCategory });
      const result = await updateTransactionCategory(txId, newCategoryId);
      if (result.ok) {
        router.refresh();
      } else {
        setToast("No se pudo cambiar la categoría");
      }
    });
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return optimisticTransactions.filter((t) => {
      if (q) {
        const matchesDesc = t.description.toLowerCase().includes(q);
        const matchesAccount = t.account.name.toLowerCase().includes(q);
        if (!matchesDesc && !matchesAccount) return false;
      }
      if (accountFilter !== "todas" && t.account.name !== accountFilter) return false;
      if (categoryFilter !== "todas" && t.category.name !== categoryFilter) return false;
      return true;
    });
  }, [optimisticTransactions, search, accountFilter, categoryFilter]);

  const totalCount = filtered.length;
  const totalExpenses = filtered
    .filter((t) => t.amount < 0)
    .reduce((acc, t) => acc + t.amount, 0);
  const totalIncome = filtered
    .filter((t) => t.amount > 0)
    .reduce((acc, t) => acc + t.amount, 0);

  const hasActiveFilters =
    search.trim() !== "" || accountFilter !== "todas" || categoryFilter !== "todas";

  return (
    <div className="flex flex-col gap-6">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-[100] bg-gray-800 text-white text-sm px-4 py-2 rounded-full shadow-lg">
          {toast}
        </div>
      )}

      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-[#f9f9f9] rounded-[20px] p-7">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">
            Transacciones
          </p>
          <p className="text-3xl font-semibold text-gray-800">{totalCount}</p>
        </div>
        <div className="bg-[#f9f9f9] rounded-[20px] p-7">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">
            Gastos
          </p>
          <p className="text-3xl font-semibold text-gray-800">
            {formatCLP(totalExpenses)}
          </p>
        </div>
        <div className="bg-[#f9f9f9] rounded-[20px] p-7">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">
            Ingresos
          </p>
          <p className="text-3xl font-semibold text-green-500">
            {formatCLP(totalIncome)}
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="flex items-center gap-2 px-3 py-2 bg-white border border-indigo-100 rounded-xl flex-1 min-w-[200px] max-w-sm focus-within:border-violet-400 transition-colors">
          <SearchIcon />
          <input
            type="text"
            placeholder="Buscar por descripción o cuenta..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 text-sm text-gray-700 placeholder-gray-400 bg-transparent outline-none"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="text-gray-300 hover:text-gray-500 transition-colors text-base leading-none"
            >
              ✕
            </button>
          )}
        </div>

        {/* Account filter */}
        <select
          value={accountFilter}
          onChange={(e) => setAccountFilter(e.target.value)}
          className={`border rounded-full text-sm px-4 py-2 outline-none cursor-pointer transition-colors ${
            accountFilter !== "todas"
              ? "bg-indigo-50 border-violet-300 text-indigo-500"
              : "bg-white border-indigo-100 text-gray-500 hover:border-indigo-200"
          }`}
        >
          <option value="todas">Todas las cuentas</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.name}>
              {a.name}
            </option>
          ))}
        </select>

        {/* Category filter */}
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className={`border rounded-full text-sm px-4 py-2 outline-none cursor-pointer transition-colors ${
            categoryFilter !== "todas"
              ? "bg-indigo-50 border-violet-300 text-indigo-500"
              : "bg-white border-indigo-100 text-gray-500 hover:border-indigo-200"
          }`}
        >
          <option value="todas">Todas las categorías</option>
          {categories.map((c) => (
            <option key={c.id} value={c.name}>
              {c.emoji} {c.name}
            </option>
          ))}
        </select>

        {/* Active filter pills */}
        {hasActiveFilters && (
          <div className="flex flex-wrap gap-2">
            {search.trim() && (
              <span className="flex items-center gap-1.5 bg-indigo-50 border border-violet-300 text-indigo-500 rounded-full text-sm px-3 py-1">
                &ldquo;{search.trim()}&rdquo;
                <button
                  onClick={() => setSearch("")}
                  className="hover:text-indigo-700 transition-colors leading-none"
                >
                  ✕
                </button>
              </span>
            )}
            {accountFilter !== "todas" && (
              <span className="flex items-center gap-1.5 bg-indigo-50 border border-violet-300 text-indigo-500 rounded-full text-sm px-3 py-1">
                {accountFilter}
                <button
                  onClick={() => setAccountFilter("todas")}
                  className="hover:text-indigo-700 transition-colors leading-none"
                >
                  ✕
                </button>
              </span>
            )}
            {categoryFilter !== "todas" && (
              <span className="flex items-center gap-1.5 bg-indigo-50 border border-violet-300 text-indigo-500 rounded-full text-sm px-3 py-1">
                {categoryFilter}
                <button
                  onClick={() => setCategoryFilter("todas")}
                  className="hover:text-indigo-700 transition-colors leading-none"
                >
                  ✕
                </button>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Transaction table */}
      <div className="bg-[#f9f9f9] rounded-[20px] p-7">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
            <span className="text-4xl">🔍</span>
            <p className="text-sm font-medium">No se encontraron transacciones</p>
            {hasActiveFilters && (
              <button
                onClick={() => {
                  setSearch("");
                  setAccountFilter("todas");
                  setCategoryFilter("todas");
                }}
                className="text-xs text-indigo-400 hover:text-indigo-600 transition-colors underline underline-offset-2"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider pb-3 pr-4 w-[110px]">
                  Fecha
                </th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider pb-3 pr-4">
                  Descripción
                </th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider pb-3 pr-4 w-[160px]">
                  Categoría
                </th>
                <th className="text-right text-xs font-medium text-gray-400 uppercase tracking-wider pb-3 w-[140px]">
                  Monto
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => {
                const emoji =
                  CATEGORY_EMOJI[t.category.name] ?? t.category.emoji ?? "📌";
                const isPositive = t.amount >= 0;
                return (
                  <tr
                    key={t.id}
                    className="border-b border-gray-100 last:border-0 hover:bg-white/70 transition-colors"
                  >
                    <td className="py-3 pr-4 text-sm text-gray-400 tabular-nums">
                      {formatDate(t.date)}
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2.5">
                        <span className="text-base leading-none">{emoji}</span>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-700">
                            {t.description}
                          </span>
                          <span className="text-xs text-gray-400">
                            {t.account.name}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      <span className="relative inline-block">
                        <button
                          type="button"
                          onClick={() => setOpenPickerForTxId(t.id)}
                          className="cursor-pointer rounded-full transition-colors"
                        >
                          <CategoryBadge name={t.category.name} />
                        </button>
                        {openPickerForTxId === t.id && (
                          <CategoryPicker
                            currentCategoryId={t.category.id}
                            categories={categories}
                            onSelect={(newCategoryId) =>
                              handleSelect(t.id, newCategoryId)
                            }
                            onClose={() => setOpenPickerForTxId(null)}
                          />
                        )}
                      </span>
                    </td>
                    <td className="py-3 text-right text-sm font-semibold tabular-nums">
                      <span
                        style={{
                          color: isPositive ? "#38a169" : "#1a202c",
                        }}
                      >
                        {formatCLP(t.amount)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
