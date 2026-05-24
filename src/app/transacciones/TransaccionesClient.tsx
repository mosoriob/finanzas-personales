'use client';

import {
  useState,
  useMemo,
  useOptimistic,
  useTransition,
  useEffect,
  useRef,
} from 'react';
import { useRouter } from 'next/navigation';
import { formatCLP } from '@/lib/format';
import { CategoryPicker } from '@/components/CategoryPicker';
import {
  updateTransactionCategory,
  updateSharedFlags,
  updateTransactionNote,
} from './actions';
import { TransactionCard } from '@/components/transaction-card';
import { CreateTransactionModal } from '@/components/CreateTransactionModal';

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
  note: string | null;
  amount: number;
  isShared: boolean;
  isReimbursed: boolean;
  account: Account;
  category: Category;
};

type OptimisticUpdate =
  | { type: 'category'; txId: number; category: Category }
  | { type: 'shared'; txId: number; isShared: boolean; isReimbursed: boolean }
  | { type: 'note'; txId: number; note: string | null }
  | { type: 'create'; transaction: Transaction };

const CATEGORY_EMOJI: Record<string, string> = {
  Supermercado: '🛒',
  Transporte: '🚗',
  Entretenimiento: '🎬',
  Salud: '💊',
  Restaurant: '🍕',
  Servicios: '📱',
  Hogar: '🏠',
  Educación: '📚',
  Sueldo: '💰',
  Transferencia: '🔄',
  Otro: '📌',
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function CategoryBadge({ name }: { name: string }) {
  const isSueldo = name === 'Sueldo';
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
        isSueldo
          ? 'bg-green-100 text-green-600'
          : 'bg-indigo-50 text-indigo-500'
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

function PlusIcon() {
  return (
    <svg
      className="w-5 h-5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth={2.5}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  );
}

type SharedFilter = 'todos' | 'familiares' | 'no-familiares';

interface Props {
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
}

export function TransaccionesClient({
  transactions,
  accounts,
  categories,
}: Props) {
  const router = useRouter();
  const [, startCategoryTransition] = useTransition();
  const [, startSharedTransition] = useTransition();
  const [, startNoteTransition] = useTransition();
  const [, startCreateTransition] = useTransition();

  const [search, setSearch] = useState('');
  const [accountFilter, setAccountFilter] = useState<string>('todas');
  const [categoryFilter, setCategoryFilter] = useState<string>('todas');
  const [sharedFilter, setSharedFilter] = useState<SharedFilter>('todos');
  const [openPickerForTxId, setOpenPickerForTxId] = useState<number | null>(
    null,
  );
  const [toast, setToast] = useState<string | null>(null);
  const [editingNoteForTxId, setEditingNoteForTxId] = useState<number | null>(
    null,
  );
  const [editingNoteValue, setEditingNoteValue] = useState<string>('');
  const noteInputRef = useRef<HTMLInputElement>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);

  const [optimisticTransactions, applyOptimistic] = useOptimistic(
    transactions,
    (state, update: OptimisticUpdate) => {
      if (update.type === 'create') {
        return [update.transaction, ...state];
      }
      return state.map((t) => {
        if (t.id !== update.txId) return t;
        if (update.type === 'category') {
          return { ...t, category: { ...update.category } };
        }
        if (update.type === 'note') {
          return { ...t, note: update.note };
        }
        return {
          ...t,
          isShared: update.isShared,
          isReimbursed: update.isReimbursed,
        };
      });
    },
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
    if (!current || current.category.id === newCategoryId) {
      return; // no-op
    }

    const newCategory = categories.find((c) => c.id === newCategoryId);
    if (!newCategory) return;

    startCategoryTransition(async () => {
      applyOptimistic({ type: 'category', txId, category: newCategory });
      const result = await updateTransactionCategory(txId, newCategoryId);
      if (result.ok) {
        router.refresh();
      } else {
        setToast('No se pudo cambiar la categoría');
      }
    });
  }

  function handleSharedToggle(
    txId: number,
    field: 'isShared' | 'isReimbursed',
  ) {
    const current = transactions.find((t) => t.id === txId);
    if (!current) return;

    let newIsShared = current.isShared;
    let newIsReimbursed = current.isReimbursed;

    if (field === 'isShared') {
      newIsShared = !current.isShared;
      if (!newIsShared) newIsReimbursed = false;
    } else {
      if (!current.isShared) return;
      newIsReimbursed = !current.isReimbursed;
    }

    startSharedTransition(async () => {
      applyOptimistic({
        type: 'shared',
        txId,
        isShared: newIsShared,
        isReimbursed: newIsReimbursed,
      });
      try {
        await updateSharedFlags(txId, newIsShared, newIsReimbursed);
        router.refresh();
      } catch (err) {
        console.error('No se pudo actualizar el estado compartido:', err);
        setToast('No se pudo actualizar');
      }
    });
  }

  function openNoteEditor(txId: number, currentNote: string | null) {
    setEditingNoteForTxId(txId);
    setEditingNoteValue(currentNote ?? '');
  }

  function saveNote(txId: number) {
    const newNote = editingNoteValue.trim() || null;
    setEditingNoteForTxId(null);

    const current = transactions.find((t) => t.id === txId);
    if (!current || (current.note ?? null) === newNote) return;

    startNoteTransition(async () => {
      applyOptimistic({ type: 'note', txId, note: newNote });
      const result = await updateTransactionNote(txId, newNote);
      if (result.ok) {
        router.refresh();
      } else {
        setToast('No se pudo guardar la nota');
      }
    });
  }

  useEffect(() => {
    if (editingNoteForTxId !== null) {
      noteInputRef.current?.focus();
    }
  }, [editingNoteForTxId]);

  function handleTransactionCreated(newTransaction: Transaction) {
    startCreateTransition(async () => {
      applyOptimistic({ type: 'create', transaction: newTransaction });
      router.refresh();
    });
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return optimisticTransactions.filter((t) => {
      if (q) {
        const matchesDesc = t.description.toLowerCase().includes(q);
        const matchesAccount = t.account.name.toLowerCase().includes(q);
        const matchesNote = t.note?.toLowerCase().includes(q) ?? false;
        if (!matchesDesc && !matchesAccount && !matchesNote) return false;
      }
      if (accountFilter !== 'todas' && t.account.name !== accountFilter)
        return false;
      if (categoryFilter !== 'todas' && t.category.name !== categoryFilter)
        return false;
      if (sharedFilter === 'familiares' && !t.isShared) return false;
      if (sharedFilter === 'no-familiares' && t.isShared) return false;
      return true;
    });
  }, [
    optimisticTransactions,
    search,
    accountFilter,
    categoryFilter,
    sharedFilter,
  ]);

  const totalCount = filtered.length;
  const totalExpenses = filtered
    .filter((t) => t.amount < 0)
    .reduce((acc, t) => acc + t.amount, 0);
  const totalIncome = filtered
    .filter((t) => t.amount > 0)
    .reduce((acc, t) => acc + t.amount, 0);
  const totalPendingReimbursement = filtered
    .filter((t) => t.isShared && !t.isReimbursed && t.amount < 0)
    .reduce((acc, t) => acc + Math.abs(t.amount), 0);

  const hasActiveFilters =
    search.trim() !== '' ||
    accountFilter !== 'todas' ||
    categoryFilter !== 'todas' ||
    sharedFilter !== 'todos';

  return (
    <div className="flex flex-col gap-6">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-[100] bg-gray-800 text-white text-sm px-4 py-2 rounded-full shadow-lg">
          {toast}
        </div>
      )}

      {/* Create transaction modal */}
      {showCreateModal && (
        <CreateTransactionModal
          accounts={accounts}
          categories={categories}
          onClose={() => setShowCreateModal(false)}
          onCreated={handleTransactionCreated}
        />
      )}

      {/* FAB — mobile only, above bottom nav */}
      <button
        type="button"
        onClick={() => setShowCreateModal(true)}
        className="md:hidden fixed bottom-20 right-4 z-40 w-14 h-14 min-w-[44px] min-h-[44px] rounded-full bg-violet-600 text-white shadow-lg hover:bg-violet-700 active:bg-violet-800 transition-colors flex items-center justify-center"
        aria-label="Nueva Transacción"
      >
        <PlusIcon />
      </button>

      {/* Summary bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <div className="bg-[#f9f9f9] rounded-[20px] p-4 md:p-7">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">
            Transacciones
          </p>
          <p className="text-2xl md:text-3xl font-semibold text-gray-800">
            {totalCount}
          </p>
        </div>
        <div className="bg-[#f9f9f9] rounded-[20px] p-4 md:p-7">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">
            Gastos
          </p>
          <p className="text-2xl md:text-3xl font-semibold text-gray-800">
            {formatCLP(totalExpenses)}
          </p>
        </div>
        <div className="bg-[#f9f9f9] rounded-[20px] p-4 md:p-7">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">
            Ingresos
          </p>
          <p className="text-2xl md:text-3xl font-semibold text-green-500">
            {formatCLP(totalIncome)}
          </p>
        </div>
        <div className="bg-[#f9f9f9] rounded-[20px] p-4 md:p-7">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">
            Pendiente Devolución
          </p>
          <p className="text-2xl md:text-3xl font-semibold text-orange-500">
            {formatCLP(totalPendingReimbursement)}
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row md:flex-wrap md:items-center gap-3">
        {/* Search */}
        <div className="flex items-center gap-2 px-3 py-2 bg-white border border-indigo-100 rounded-xl w-full md:flex-1 md:min-w-[200px] md:max-w-sm focus-within:border-violet-400 transition-colors">
          <SearchIcon />
          <input
            type="text"
            placeholder="Buscar por descripción, nota o cuenta..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 text-sm text-gray-700 placeholder-gray-400 bg-transparent outline-none"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
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
          className={`border rounded-full text-sm px-4 py-2.5 md:py-2 outline-none cursor-pointer transition-colors w-full md:w-auto min-h-[44px] md:min-h-0 ${
            accountFilter !== 'todas'
              ? 'bg-indigo-50 border-violet-300 text-indigo-500'
              : 'bg-white border-indigo-100 text-gray-500 hover:border-indigo-200'
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
          className={`border rounded-full text-sm px-4 py-2.5 md:py-2 outline-none cursor-pointer transition-colors w-full md:w-auto min-h-[44px] md:min-h-0 ${
            categoryFilter !== 'todas'
              ? 'bg-indigo-50 border-violet-300 text-indigo-500'
              : 'bg-white border-indigo-100 text-gray-500 hover:border-indigo-200'
          }`}
        >
          <option value="todas">Todas las categorías</option>
          {categories.map((c) => (
            <option key={c.id} value={c.name}>
              {c.emoji} {c.name}
            </option>
          ))}
        </select>

        {/* Shared filter */}
        <select
          value={sharedFilter}
          onChange={(e) => setSharedFilter(e.target.value as SharedFilter)}
          className={`border rounded-full text-sm px-4 py-2.5 md:py-2 outline-none cursor-pointer transition-colors w-full md:w-auto min-h-[44px] md:min-h-0 ${
            sharedFilter !== 'todos'
              ? 'bg-indigo-50 border-violet-300 text-indigo-500'
              : 'bg-white border-indigo-100 text-gray-500 hover:border-indigo-200'
          }`}
        >
          <option value="todos">Todos los gastos</option>
          <option value="familiares">Familiares</option>
          <option value="no-familiares">No familiares</option>
        </select>

        {/* Nueva Transacción — desktop only */}
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="hidden md:flex items-center gap-2 rounded-full bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 active:bg-violet-800 transition-colors"
        >
          <PlusIcon />
          Nueva Transacción
        </button>

        {/* Active filter pills */}
        {hasActiveFilters && (
          <div className="flex flex-wrap gap-2">
            {search.trim() && (
              <span className="flex items-center gap-1.5 bg-indigo-50 border border-violet-300 text-indigo-500 rounded-full text-sm px-3 py-1">
                &ldquo;{search.trim()}&rdquo;
                <button
                  onClick={() => setSearch('')}
                  className="hover:text-indigo-700 transition-colors leading-none"
                >
                  ✕
                </button>
              </span>
            )}
            {accountFilter !== 'todas' && (
              <span className="flex items-center gap-1.5 bg-indigo-50 border border-violet-300 text-indigo-500 rounded-full text-sm px-3 py-1">
                {accountFilter}
                <button
                  onClick={() => setAccountFilter('todas')}
                  className="hover:text-indigo-700 transition-colors leading-none"
                >
                  ✕
                </button>
              </span>
            )}
            {categoryFilter !== 'todas' && (
              <span className="flex items-center gap-1.5 bg-indigo-50 border border-violet-300 text-indigo-500 rounded-full text-sm px-3 py-1">
                {categoryFilter}
                <button
                  onClick={() => setCategoryFilter('todas')}
                  className="hover:text-indigo-700 transition-colors leading-none"
                >
                  ✕
                </button>
              </span>
            )}
            {sharedFilter !== 'todos' && (
              <span className="flex items-center gap-1.5 bg-indigo-50 border border-violet-300 text-indigo-500 rounded-full text-sm px-3 py-1">
                {sharedFilter === 'familiares' ? 'Familiares' : 'No familiares'}
                <button
                  onClick={() => setSharedFilter('todos')}
                  className="hover:text-indigo-700 transition-colors leading-none"
                >
                  ✕
                </button>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Transaction table — desktop only */}
      <div className="hidden md:block bg-[#f9f9f9] rounded-[20px] p-7">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
            <span className="text-4xl">🔍</span>
            <p className="text-sm font-medium">
              No se encontraron transacciones
            </p>
            {hasActiveFilters && (
              <button
                onClick={() => {
                  setSearch('');
                  setAccountFilter('todas');
                  setCategoryFilter('todas');
                  setSharedFilter('todos');
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
                <th className="text-center text-xs font-medium text-gray-400 uppercase tracking-wider pb-3 pr-4 w-[80px]">
                  Familiar
                </th>
                <th className="text-center text-xs font-medium text-gray-400 uppercase tracking-wider pb-3 pr-4 w-[80px]">
                  Devuelto
                </th>
                <th className="text-right text-xs font-medium text-gray-400 uppercase tracking-wider pb-3 w-[140px]">
                  Monto
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => {
                const emoji =
                  CATEGORY_EMOJI[t.category.name] ?? t.category.emoji ?? '📌';
                const isPositive = t.amount >= 0;
                return (
                  <tr
                    key={t.id}
                    className="group border-b border-gray-100 last:border-0 hover:bg-white/70 transition-colors"
                  >
                    <td className="py-3 pr-4 text-sm text-gray-400 tabular-nums">
                      {formatDate(t.date)}
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2.5">
                        <span className="text-base leading-none">{emoji}</span>
                        <div className="flex flex-col flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-medium text-gray-700">
                              {t.description}
                            </span>
                            <button
                              type="button"
                              onClick={() => openNoteEditor(t.id, t.note)}
                              className="text-gray-300 hover:text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                              title="Agregar nota"
                            >
                              ✏️
                            </button>
                          </div>
                          <span className="text-xs text-gray-400">
                            {t.account.name}
                          </span>
                          {editingNoteForTxId === t.id ? (
                            <input
                              ref={noteInputRef}
                              type="text"
                              value={editingNoteValue}
                              onChange={(e) =>
                                setEditingNoteValue(e.target.value)
                              }
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveNote(t.id);
                                if (e.key === 'Escape')
                                  setEditingNoteForTxId(null);
                              }}
                              onBlur={() => saveNote(t.id)}
                              placeholder="Agregar nota..."
                              className="text-xs text-gray-700 bg-white border border-indigo-200 rounded px-1.5 py-0.5 outline-none focus:border-violet-400 w-full mt-0.5"
                            />
                          ) : (
                            t.note && (
                              <span className="text-xs text-indigo-400 italic">
                                {t.note}
                              </span>
                            )
                          )}
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
                    <td className="py-3 pr-4 text-center">
                      <input
                        type="checkbox"
                        checked={t.isShared}
                        onChange={() => handleSharedToggle(t.id, 'isShared')}
                        className="h-4 w-4 cursor-pointer accent-indigo-500"
                      />
                    </td>
                    <td className="py-3 pr-4 text-center">
                      <input
                        type="checkbox"
                        checked={t.isReimbursed}
                        onChange={() =>
                          handleSharedToggle(t.id, 'isReimbursed')
                        }
                        disabled={!t.isShared}
                        className="h-4 w-4 cursor-pointer accent-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed"
                      />
                    </td>
                    <td className="py-3 text-right text-sm font-semibold tabular-nums">
                      <span
                        style={{
                          color: isPositive ? '#38a169' : '#1a202c',
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

      {/* Transaction cards — mobile only */}
      <div className="md:hidden bg-[#f9f9f9] rounded-[20px] p-4">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
            <span className="text-4xl">🔍</span>
            <p className="text-sm font-medium">
              No se encontraron transacciones
            </p>
            {hasActiveFilters && (
              <button
                onClick={() => {
                  setSearch('');
                  setAccountFilter('todas');
                  setCategoryFilter('todas');
                  setSharedFilter('todos');
                }}
                className="text-xs text-indigo-400 hover:text-indigo-600 transition-colors underline underline-offset-2"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        ) : (
          <div>
            {filtered.map((t) => (
              <TransactionCard
                key={t.id}
                transaction={t}
                onCategoryClick={() => setOpenPickerForTxId(t.id)}
              />
            ))}
            {/* Category pickers for mobile */}
            {filtered.map((t) =>
              openPickerForTxId === t.id ? (
                <div key={`picker-${t.id}`} className="relative">
                  <CategoryPicker
                    currentCategoryId={t.category.id}
                    categories={categories}
                    onSelect={(newCategoryId) =>
                      handleSelect(t.id, newCategoryId)
                    }
                    onClose={() => setOpenPickerForTxId(null)}
                  />
                </div>
              ) : null,
            )}
          </div>
        )}
      </div>
    </div>
  );
}
