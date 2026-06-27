"use client";

import { useState } from "react";
import { AUTO_CATEGORIZATION_NAMES } from "@/lib/constants";
import { deleteCategory } from "@/app/config/actions";

interface Category {
  id: number;
  name: string;
  emoji: string;
  _count: { transactions: number };
}

interface DeleteCategoryDialogProps {
  category: Category;
  allCategories: Category[];
  onClose: () => void;
  onDeleted: () => void;
}

export function DeleteCategoryDialog({
  category,
  allCategories,
  onClose,
  onDeleted,
}: DeleteCategoryDialogProps) {
  const otherCategories = allCategories.filter((c) => c.id !== category.id);
  const transactionCount = category._count.transactions;
  const isAutoCat = AUTO_CATEGORIZATION_NAMES.includes(category.name);
  const isLastCategory = allCategories.length <= 1;

  // Default replacement: "Sin Categoría" if it exists, otherwise first alphabetically
  const defaultReplacement =
    otherCategories.find((c) => c.name === "Sin Categoría") ??
    [...otherCategories].sort((a, b) => a.name.localeCompare(b.name))[0];

  const [replacementId, setReplacementId] = useState<number>(
    defaultReplacement?.id ?? otherCategories[0]?.id ?? 0
  );
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (isLastCategory) return;
    setIsPending(true);
    setError(null);
    try {
      const effectiveReplacementId =
        transactionCount > 0 ? replacementId : otherCategories[0]?.id ?? 0;
      const result = await deleteCategory(category.id, effectiveReplacementId);
      if (result.ok) {
        onDeleted();
      } else {
        setError(result.error);
      }
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 flex flex-col gap-4">
        {/* Header */}
        {isAutoCat ? (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="text-amber-500 text-lg">⚠️</span>
              <h2 className="text-base font-semibold text-amber-700">
                Categoría usada por auto-categorización
              </h2>
            </div>
            <p className="text-sm text-amber-600 ml-7">
              <span className="font-medium">
                {category.emoji} &ldquo;{category.name}&rdquo;
              </span>{" "}
              es asignada automáticamente durante la sincronización bancaria. Si la eliminas, esas
              transacciones se asignarán a la categoría por defecto.
            </p>
          </div>
        ) : (
          <h2 className="text-base font-semibold text-gray-800">¿Eliminar categoría?</h2>
        )}

        {/* Category identity */}
        <div className="bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-700">
          {category.emoji} &ldquo;{category.name}&rdquo;
        </div>

        {/* Last-category guard */}
        {isLastCategory && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
            No puedes eliminar la única categoría existente. Crea otra categoría primero.
          </div>
        )}

        {/* Transaction handling */}
        {!isLastCategory && transactionCount === 0 && (
          <p className="text-sm text-gray-500">Esta categoría no tiene transacciones.</p>
        )}

        {!isLastCategory && transactionCount > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-gray-600">
              Tiene{" "}
              <span className="font-medium text-gray-800">
                {transactionCount} {transactionCount === 1 ? "transacción" : "transacciones"}
              </span>
              .
            </p>
            <label className="text-sm font-medium text-gray-700">Mover transacciones a:</label>
            <div className="relative">
              <select
                value={replacementId}
                onChange={(e) => setReplacementId(Number(e.target.value))}
                disabled={isPending}
                className="w-full border border-indigo-100 rounded-xl p-2.5 text-sm text-gray-700 focus:outline-none focus:border-violet-400 transition-colors appearance-none bg-white pr-9 disabled:opacity-60"
              >
                {otherCategories
                  .slice()
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.emoji} {cat.name}
                    </option>
                  ))}
              </select>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path
                    d="M3 5l4 4 4-4"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
        )}

        {/* Actions */}
        <div className="flex gap-2.5 justify-end pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="border border-gray-200 text-gray-500 rounded-xl px-5 py-2 text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-60"
          >
            Cancelar
          </button>
          {!isLastCategory && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={isPending}
              className="bg-red-500 text-white rounded-xl px-5 py-2 text-sm font-semibold hover:bg-red-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isPending ? "Eliminando…" : "Eliminar"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
