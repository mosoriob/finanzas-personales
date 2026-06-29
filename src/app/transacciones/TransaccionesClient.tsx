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
import { formatMoney } from '@/lib/currency';
import { summarizeTransactions, excludedUsdLabel } from '@/lib/transaction-summary';
import { CategoryPicker } from '@/components/CategoryPicker';
import { MonthPicker } from '@/components/MonthPicker';
import { Pagination } from '@/components/Pagination';
import { filterAndPaginate } from '@/lib/transaction-filters';
import {
  updateTransactionCategory,
  updateFamiliar,
  updateTransactionNote,
  deleteTransaction,
} from './actions';
import { TransactionCard } from '@/components/transaction-card';
import { CreateTransactionModal } from '@/components/CreateTransactionModal';
import { DeleteConfirmDialog } from '@/components/DeleteConfirmDialog';
import {
  FAMILIAR_DROPDOWN_OPTIONS,
  HOUSEHOLD_FILTER_OPTIONS,
  familiarToDropdownValue,
  dropdownValueToFamiliar,
  householdFilterLabel,
  FAMILIAR_SHORT_LABEL,
  FAMILIAR_VALUES,
  type Familiar,
  type FamiliarDropdownValue,
  type HouseholdFilter,
} from '@/lib/familiar';

type Account = {
  id: number;
  name: string;
};

type Category = {
  id: number;
  name: string;
  emoji: string;
  excluded: boolean;
};

type Transaction = {
  id: number;
  date: string; // ISO string (serialized from Date)
  description: string;
  note: string | null;
  amount: number;
  currency: string | null;
  familiar: Familiar | null;
  isReimbursed: boolean;
  account: Account;
  category: Category;
};

type OptimisticUpdate =
  | { type: 'category'; txId: number; category: Category }
  | { type: 'familiar'; txId: number; familiar: Familiar | null; isReimbursed: boolean }
  | { type: 'note'; txId: number; note: string | null }
  | { type: 'create'; transaction: Transaction }
  | { type: 'delete'; id: number };

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

interface Props {
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
  mes: string; // "YYYY-MM" | "todo"
}

const PAGE_SIZE = 50;

export function TransaccionesClient({
  transactions,
  accounts,
  categories,
  mes,
}: Props) {
  const router = useRouter();
  const [, startCategoryTransition] = useTransition();
  const [, startSharedTransition] = useTransition();
  const [, startNoteTransition] = useTransition();
  const [, startCreateTransition] = useTransition();
  const [, startDeleteTransition] = useTransition();

  const [search, setSearch] = useState('');
  const [accountFilter, setAccountFilter] = useState<string>('todas');
  const [categoryFilter, setCategoryFilter] = useState<string>('todas');
  const [householdFilter, setHouseholdFilter] =
    useState<HouseholdFilter>('todos');
  const [page, setPage] = useState(1);
  const [openPickerForTxId, setOpenPickerForTxId] = useState<number | null>(
    null,
  );
  const [toast, setToast] = useState<string | null>(null);
  const [editingNoteForTxId, setEditingNoteForTxId] = useState<number | null>(
    null,
  );
  const [editingNoteValue, setEditingNoteValue] = useState<string>('');
  const noteInputRef = useRef<HTMLInputElement>(null);
  const [deletingTx, setDeletingTx] = useState<Transaction | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);

  const [optimisticTransactions, applyOptimistic] = useOptimistic(
    transactions,
    (state, update: OptimisticUpdate) => {
      if (update.type === 'create') {
        return [update.transaction, ...state];
      }
      if (update.type === 'delete') {
        return state.filter((t) => t.id !== update.id);
      }
      // update is one of category | familiar | note here
      const nonDeleteUpdate = update;
      return state.map((t) => {
        if (t.id !== nonDeleteUpdate.txId) return t;
        if (nonDeleteUpdate.type === 'category') {
          return { ...t, category: { ...nonDeleteUpdate.category } };
        }
        if (nonDeleteUpdate.type === 'note') {
          return { ...t, note: nonDeleteUpdate.note };
        }
        return {
          ...t,
          familiar: nonDeleteUpdate.familiar,
          isReimbursed: nonDeleteUpdate.isReimbursed,
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

  function handleSearchChange(value: string) {
    setSearch(value);
    setPage(1);
  }

  function handleAccountFilterChange(value: string) {
    setAccountFilter(value);
    setPage(1);
  }

  function handleCategoryFilterChange(value: string) {
    setCategoryFilter(value);
    setPage(1);
  }

  function handleHouseholdFilterChange(value: HouseholdFilter) {
    setHouseholdFilter(value);
    setPage(1);
  }

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

  function handleFamiliarChange(txId: number, newFamiliar: Familiar | null) {
    const current = transactions.find((t) => t.id === txId);
    if (!current) return;
    if (current.familiar === newFamiliar) return;

    const newIsReimbursed = newFamiliar !== null ? current.isReimbursed : false;

    startSharedTransition(async () => {
      applyOptimistic({
        type: 'familiar',
        txId,
        familiar: newFamiliar,
        isReimbursed: newIsReimbursed,
      });
      try {
        await updateFamiliar(txId, newFamiliar, newIsReimbursed);
        router.refresh();
      } catch (err) {
        console.error('No se pudo actualizar el estado familiar:', err);
        setToast('No se pudo actualizar');
      }
    });
  }

  function handleReimbursedToggle(txId: number) {
    const current = transactions.find((t) => t.id === txId);
    if (!current || current.familiar === null) return;

    const newIsReimbursed = !current.isReimbursed;

    startSharedTransition(async () => {
      applyOptimistic({
        type: 'familiar',
        txId,
        familiar: current.familiar,
        isReimbursed: newIsReimbursed,
      });
      try {
        await updateFamiliar(txId, current.familiar, newIsReimbursed);
        router.refresh();
      } catch (err) {
        console.error('No se pudo actualizar el estado de devolución:', err);
        setToast('No se pudo actualizar');
      }
    });
  }

  function openNoteEditor(txId: number, currentNote: string | null) {
    setEditingNoteForTxId(txId);
    setEditingNoteValue(currentNote ?? '');
  }

  function handleDeleteRequest(tx: Transaction) {
    setDeletingTx(tx);
  }

  function handleDeleteCancel() {
    setDeletingTx(null);
  }

  function handleDeleteConfirm() {
    if (!deletingTx) return;
    const txToDelete = deletingTx;
    setDeletingTx(null);

    startDeleteTransition(async () => {
      applyOptimistic({ type: 'delete', id: txToDelete.id });
      const result = await deleteTransaction(txToDelete.id);
      if (result.ok) {
        router.refresh();
      } else {
        setToast('No se pudo eliminar la transacción');
      }
    });
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

  // Filter the full in-memory set, then paginate the result so counts and
  // page sizes reflect the filtered set (not the raw month).
  const filtered = useMemo(
    () =>
      filterAndPaginate(
        optimisticTransactions,
        { search, accountFilter, categoryFilter, householdFilter },
        page,
        PAGE_SIZE,
      ),
    [
      optimisticTransactions,
      search,
      accountFilter,
      categoryFilter,
      householdFilter,
      page,
    ],
  );
  const pageItems = filtered.pageItems;
  const filteredCount = filtered.filteredCount;
  // The helper clamps the slice internally; clamp the displayed page too so the
  // pager highlights a valid page when the filtered set shrinks.
  const currentPage = Math.min(page, filtered.totalPages);

  // Summary bar reflects the whole filtered set, not just the current page.
  const filteredAll = useMemo(
    () =>
      filterAndPaginate(
        optimisticTransactions,
        { search, accountFilter, categoryFilter, householdFilter },
        1,
        Number.MAX_SAFE_INTEGER,
      ).pageItems,
    [optimisticTransactions, search, accountFilter, categoryFilter, householdFilter],
  );
  // Peso-only totals: USD rows are excluded so the totals never silently
  // undercount. excludedUsdCount drives the integrity indicator below.
  const {
    expenses: summaryExpenses,
    income: summaryIncome,
    pendingByHousehold,
    excludedUsdCount,
  } = summarizeTransactions(filteredAll);

  const hasActiveFilters =
    search.trim() !== '' ||
    accountFilter !== 'todas' ||
    categoryFilter !== 'todas' ||
    householdFilter !== 'todos';

  return (
    <div className="flex flex-col gap-6">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-[100] bg-gray-800 text-white text-sm px-4 py-2 rounded-full shadow-lg">
          {toast}
        </div>
      )}

      {/* Month Picker */}
      <div className="bg-[#f9f9f9] rounded-[20px] px-5 py-3 flex items-center">
        <MonthPicker mes={mes} />
      </div>

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
            {filteredCount}
          </p>
        </div>
        <div className="bg-[#f9f9f9] rounded-[20px] p-4 md:p-7">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">
            Gastos
          </p>
          <p className="text-2xl md:text-3xl font-semibold text-gray-800">
            {formatCLP(summaryExpenses)}
          </p>
        </div>
        <div className="bg-[#f9f9f9] rounded-[20px] p-4 md:p-7">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">
            Ingresos
          </p>
          <p className="text-2xl md:text-3xl font-semibold text-green-500">
            {formatCLP(summaryIncome)}
          </p>
        </div>
        <div className="bg-[#f9f9f9] rounded-[20px] p-4 md:p-7">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
            Pendiente Devolución
          </p>
          <div className="flex flex-col gap-1">
            {FAMILIAR_VALUES.map((household) => (
              <div
                key={household}
                className="flex items-center justify-between gap-2"
              >
                <span className="text-xs font-medium text-gray-500">
                  {FAMILIAR_SHORT_LABEL[household]}
                </span>
                <span className="text-base md:text-lg font-semibold text-orange-500">
                  {formatCLP(pendingByHousehold[household])}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Integrity indicator: USD charges are excluded from the peso totals
          above. Shown only when the filtered set actually contains USD rows. */}
      {excludedUsdCount > 0 && (
        <p className="-mt-3 text-xs text-gray-400">
          {excludedUsdLabel(excludedUsdCount)}
        </p>
      )}

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row md:flex-wrap md:items-center gap-3">
        {/* Search */}
        <div className="flex items-center gap-2 px-3 py-2 bg-white border border-indigo-100 rounded-xl w-full md:flex-1 md:min-w-[200px] md:max-w-sm focus-within:border-violet-400 transition-colors">
          <SearchIcon />
          <input
            type="text"
            placeholder="Buscar por descripción, nota o cuenta..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="flex-1 text-sm text-gray-700 placeholder-gray-400 bg-transparent outline-none"
          />
          {search && (
            <button
              onClick={() => handleSearchChange('')}
              className="text-gray-300 hover:text-gray-500 transition-colors text-base leading-none"
            >
              ✕
            </button>
          )}
        </div>

        {/* Account filter */}
        <select
          value={accountFilter}
          onChange={(e) => handleAccountFilterChange(e.target.value)}
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
          onChange={(e) => handleCategoryFilterChange(e.target.value)}
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

        {/* Household filter */}
        <select
          value={householdFilter}
          onChange={(e) =>
            handleHouseholdFilterChange(e.target.value as HouseholdFilter)
          }
          className={`border rounded-full text-sm px-4 py-2.5 md:py-2 outline-none cursor-pointer transition-colors w-full md:w-auto min-h-[44px] md:min-h-0 ${
            householdFilter !== 'todos'
              ? 'bg-indigo-50 border-violet-300 text-indigo-500'
              : 'bg-white border-indigo-100 text-gray-500 hover:border-indigo-200'
          }`}
        >
          {HOUSEHOLD_FILTER_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
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
                  onClick={() => handleSearchChange('')}
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
                  onClick={() => handleAccountFilterChange('todas')}
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
                  onClick={() => handleCategoryFilterChange('todas')}
                  className="hover:text-indigo-700 transition-colors leading-none"
                >
                  ✕
                </button>
              </span>
            )}
            {householdFilter !== 'todos' && (
              <span className="flex items-center gap-1.5 bg-indigo-50 border border-violet-300 text-indigo-500 rounded-full text-sm px-3 py-1">
                {householdFilterLabel(householdFilter)}
                <button
                  onClick={() => handleHouseholdFilterChange('todos')}
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
        {pageItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
            <span className="text-4xl">🔍</span>
            <p className="text-sm font-medium">
              No hay transacciones en este período
            </p>
            {hasActiveFilters && (
              <button
                onClick={() => {
                  handleSearchChange('');
                  handleAccountFilterChange('todas');
                  handleCategoryFilterChange('todas');
                  handleHouseholdFilterChange('todos');
                }}
                className="text-xs text-indigo-400 hover:text-indigo-600 transition-colors underline underline-offset-2"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        ) : (
          <>
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
                {pageItems.map((t) => {
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
                        <select
                          value={familiarToDropdownValue(t.familiar)}
                          onChange={(e) =>
                            handleFamiliarChange(
                              t.id,
                              dropdownValueToFamiliar(
                                e.target.value as FamiliarDropdownValue,
                              ),
                            )
                          }
                          className="text-xs border border-indigo-100 rounded-full px-2 py-1 outline-none cursor-pointer bg-white hover:border-indigo-200 focus:border-violet-400 transition-colors"
                        >
                          {FAMILIAR_DROPDOWN_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3 pr-4 text-center">
                        <input
                          type="checkbox"
                          checked={t.isReimbursed}
                          onChange={() => handleReimbursedToggle(t.id)}
                          disabled={t.familiar === null}
                          className="h-4 w-4 cursor-pointer accent-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed"
                        />
                      </td>
                      <td className="py-3 text-right text-sm font-semibold tabular-nums">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleDeleteRequest(t)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-300 hover:text-red-500 flex-shrink-0"
                            title="Eliminar transacción"
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
                          <span
                            style={{
                              color: isPositive ? '#38a169' : '#1a202c',
                            }}
                          >
                            {formatMoney(t.amount, t.currency)}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Desktop pagination */}
            <Pagination
              currentPage={currentPage}
              totalCount={filteredCount}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
            />
          </>
        )}
      </div>

      {/* Transaction cards — mobile only */}
      <div className="md:hidden bg-[#f9f9f9] rounded-[20px] p-4">
        {pageItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
            <span className="text-4xl">🔍</span>
            <p className="text-sm font-medium">
              No hay transacciones en este período
            </p>
            {hasActiveFilters && (
              <button
                onClick={() => {
                  handleSearchChange('');
                  handleAccountFilterChange('todas');
                  handleCategoryFilterChange('todas');
                  handleHouseholdFilterChange('todos');
                }}
                className="text-xs text-indigo-400 hover:text-indigo-600 transition-colors underline underline-offset-2"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        ) : (
          <div>
            {pageItems.map((t) => (
              <TransactionCard
                key={t.id}
                transaction={t}
                onCategoryClick={() => setOpenPickerForTxId(t.id)}
                onDelete={() => handleDeleteRequest(t)}
              />
            ))}
            {/* Category pickers for mobile */}
            {pageItems.map((t) =>
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
            <Pagination
              currentPage={currentPage}
              totalCount={filteredCount}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>
      {/* Delete confirmation dialog */}
      {deletingTx && (
        <DeleteConfirmDialog
          description={deletingTx.description}
          amount={deletingTx.amount}
          currency={deletingTx.currency}
          onConfirm={handleDeleteConfirm}
          onCancel={handleDeleteCancel}
        />
      )}
    </div>
  );
}
