'use client';

import { useEffect, useRef, useState } from 'react';
import { createTransaction, CreateTransactionResult } from '@/app/transacciones/actions';
import {
  FAMILIAR_DROPDOWN_OPTIONS,
  dropdownValueToFamiliar,
  type Familiar,
  type FamiliarDropdownValue,
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

type TransactionRow = {
  id: number;
  date: string;
  description: string;
  note: string | null;
  amount: number;
  currency: string | null;
  accountId: number;
  categoryId: number;
  familiar: Familiar | null;
  isReimbursed: boolean;
  account: Account;
  category: Category;
};

interface Props {
  accounts: Account[];
  categories: Category[];
  onClose: () => void;
  onCreated: (transaction: TransactionRow) => void;
}

type TransactionType = 'expense' | 'income';

interface FormErrors {
  amount?: string;
  description?: string;
  date?: string;
  accountId?: string;
  categoryId?: string;
}

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function CreateTransactionModal({
  accounts,
  categories,
  onClose,
  onCreated,
}: Props) {
  const [type, setType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(todayISO());
  const [accountId, setAccountId] = useState<string>(
    accounts.length > 0 ? String(accounts[0].id) : '',
  );
  const [categoryId, setCategoryId] = useState<string>(
    categories.length > 0 ? String(categories[0].id) : '',
  );
  const [note, setNote] = useState('');
  const [familiarValue, setFamiliarValue] = useState<FamiliarDropdownValue>('PERSONAL');
  const [isReimbursed, setIsReimbursed] = useState(false);
  const familiar = dropdownValueToFamiliar(familiarValue);
  const isShared = familiar !== null;
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const isDirty =
    amount !== '' ||
    description !== '' ||
    date !== todayISO() ||
    note !== '' ||
    isShared ||
    isReimbursed;

  const overlayRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Close on outside click (only if pristine)
  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === overlayRef.current && !isDirty) {
      onClose();
    }
  }

  function validate(): FormErrors {
    const errs: FormErrors = {};

    const amountNum = parseInt(amount, 10);
    if (!amount || isNaN(amountNum) || amountNum <= 0) {
      errs.amount = 'El monto debe ser mayor a 0';
    }

    if (!description.trim()) {
      errs.description = 'La descripción es obligatoria';
    }

    if (!date) {
      errs.date = 'La fecha es obligatoria';
    } else {
      const today = todayISO();
      if (date > today) {
        errs.date = 'La fecha no puede ser futura';
      }
    }

    if (!accountId) {
      errs.accountId = 'Selecciona una cuenta';
    }

    if (!categoryId) {
      errs.categoryId = 'Selecciona una categoría';
    }

    return errs;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    setSubmitting(true);

    const result: CreateTransactionResult = await createTransaction({
      amount: parseInt(amount, 10),
      type,
      description,
      date,
      accountId: parseInt(accountId, 10),
      categoryId: parseInt(categoryId, 10),
      note: note || undefined,
      familiar,
      isReimbursed: isShared ? isReimbursed : false,
    });

    setSubmitting(false);

    if (!result.ok) {
      console.error('No se pudo crear la transacción:', result.error);
      return;
    }

    // Build full row for optimistic update
    const account = accounts.find((a) => a.id === parseInt(accountId, 10))!;
    const category = categories.find((c) => c.id === parseInt(categoryId, 10))!;

    const newRow: TransactionRow = {
      ...result.transaction,
      // Manually-created transactions are always pesos (no USD entry path).
      currency: null,
      account,
      category,
    };

    onCreated(newRow);
    onClose();
  }

  const noAccounts = accounts.length === 0;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={handleOverlayClick}
    >
      <div className="relative w-full max-w-md bg-white rounded-[20px] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800">
            Nueva Transacción
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors text-xl leading-none"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        {noAccounts ? (
          <div className="px-6 py-10 text-center">
            <p className="text-sm text-gray-500">
              Primero crea una cuenta en{' '}
              <a
                href="/config"
                className="text-violet-600 underline underline-offset-2 hover:text-violet-700"
              >
                Configuración
              </a>
              .
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <div className="px-6 py-4 flex flex-col gap-4 max-h-[70vh] overflow-y-auto">
              {/* Type toggle */}
              <div>
                <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1.5">
                  Tipo
                </label>
                <div className="flex rounded-full border border-indigo-100 overflow-hidden w-fit">
                  <button
                    type="button"
                    onClick={() => setType('expense')}
                    className={`px-5 py-2 text-sm font-medium transition-colors ${
                      type === 'expense'
                        ? 'bg-violet-600 text-white'
                        : 'bg-white text-gray-500 hover:bg-indigo-50'
                    }`}
                  >
                    Gasto
                  </button>
                  <button
                    type="button"
                    onClick={() => setType('income')}
                    className={`px-5 py-2 text-sm font-medium transition-colors ${
                      type === 'income'
                        ? 'bg-green-500 text-white'
                        : 'bg-white text-gray-500 hover:bg-indigo-50'
                    }`}
                  >
                    Ingreso
                  </button>
                </div>
              </div>

              {/* Amount */}
              <div>
                <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1.5">
                  Monto
                </label>
                <div className="flex items-center gap-2 border border-indigo-100 rounded-xl px-3 py-2.5 focus-within:border-violet-400 transition-colors">
                  <span className="text-sm text-gray-400">$</span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0"
                    className="flex-1 text-sm text-gray-700 placeholder-gray-300 bg-transparent outline-none"
                  />
                </div>
                {errors.amount && (
                  <p className="text-xs text-red-500 mt-1">{errors.amount}</p>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1.5">
                  Descripción
                </label>
                <input
                  type="text"
                  maxLength={200}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ej: Almuerzo en restaurante"
                  className="w-full border border-indigo-100 rounded-xl px-3 py-2.5 text-sm text-gray-700 placeholder-gray-300 outline-none focus:border-violet-400 transition-colors"
                />
                {errors.description && (
                  <p className="text-xs text-red-500 mt-1">
                    {errors.description}
                  </p>
                )}
              </div>

              {/* Date */}
              <div>
                <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1.5">
                  Fecha
                </label>
                <input
                  type="date"
                  max={todayISO()}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full border border-indigo-100 rounded-xl px-3 py-2.5 text-sm text-gray-700 outline-none focus:border-violet-400 transition-colors"
                />
                {errors.date && (
                  <p className="text-xs text-red-500 mt-1">{errors.date}</p>
                )}
              </div>

              {/* Account */}
              <div>
                <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1.5">
                  Cuenta
                </label>
                <select
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  className="w-full border border-indigo-100 rounded-xl px-3 py-2.5 text-sm text-gray-700 outline-none focus:border-violet-400 transition-colors bg-white cursor-pointer"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
                {errors.accountId && (
                  <p className="text-xs text-red-500 mt-1">
                    {errors.accountId}
                  </p>
                )}
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1.5">
                  Categoría
                </label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full border border-indigo-100 rounded-xl px-3 py-2.5 text-sm text-gray-700 outline-none focus:border-violet-400 transition-colors bg-white cursor-pointer"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.emoji} {c.name}
                    </option>
                  ))}
                </select>
                {errors.categoryId && (
                  <p className="text-xs text-red-500 mt-1">
                    {errors.categoryId}
                  </p>
                )}
              </div>

              {/* Note */}
              <div>
                <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1.5">
                  Nota{' '}
                  <span className="normal-case font-normal text-gray-300">
                    (opcional)
                  </span>
                </label>
                <input
                  type="text"
                  maxLength={500}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Nota adicional..."
                  className="w-full border border-indigo-100 rounded-xl px-3 py-2.5 text-sm text-gray-700 placeholder-gray-300 outline-none focus:border-violet-400 transition-colors"
                />
              </div>

              {/* Familiar (household) */}
              <div>
                <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1.5">
                  Familiar
                </label>
                <select
                  value={familiarValue}
                  onChange={(e) => {
                    const next = e.target.value as FamiliarDropdownValue;
                    setFamiliarValue(next);
                    if (next === 'PERSONAL') setIsReimbursed(false);
                  }}
                  className="w-full border border-indigo-100 rounded-xl px-3 py-2.5 text-sm text-gray-700 outline-none focus:border-violet-400 transition-colors bg-white cursor-pointer"
                >
                  {FAMILIAR_DROPDOWN_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Devuelto */}
              <div className="flex flex-col gap-2.5">
                <label
                  className={`flex items-center gap-3 ${isShared ? 'cursor-pointer' : 'cursor-not-allowed opacity-40'}`}
                >
                  <input
                    type="checkbox"
                    checked={isReimbursed}
                    onChange={(e) => setIsReimbursed(e.target.checked)}
                    disabled={!isShared}
                    className="h-4 w-4 accent-indigo-500 disabled:cursor-not-allowed"
                  />
                  <span className="text-sm text-gray-700">Devuelto</span>
                </label>
              </div>
            </div>

            {/* Footer buttons */}
            <div className="flex items-center gap-3 px-6 py-4 border-t border-gray-100">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-full border border-indigo-100 py-2.5 text-sm font-medium text-gray-500 hover:bg-indigo-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 rounded-full bg-violet-600 py-2.5 text-sm font-medium text-white hover:bg-violet-700 active:bg-violet-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
