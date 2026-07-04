"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createAccount, deleteAccount, createCategory, toggleAccountVisibility, updateCategory, toggleCategoryExclusion, createRule, updateRule, deleteRule, previewApplyRules, applyRulesToExisting, exportRules, importRules, loadRuleSuggestions, dismissSuggestion, acceptSuggestion, acceptPending, rejectPending } from "./actions";
import type { ImportRulesResult } from "./actions";
import type { RuleSuggestion } from "@/lib/rule-suggestions";
import { DeleteCategoryDialog } from "@/components/DeleteCategoryDialog";
import { EmojiPicker } from "@/components/EmojiPicker";
import { TransactionCard } from "@/components/transaction-card";
import { AUTO_CATEGORIZATION_NAMES } from "@/lib/constants";

const BANKS = [
  "Banco de Chile",
  "BancoEstado",
  "Santander",
  "BCI",
  "Scotiabank",
  "Itaú",
  "Otro",
];

const ACCOUNT_TYPES = [
  "Cuenta corriente",
  "Cuenta vista / RUT",
  "Tarjeta de crédito",
];

const COLOR_SWATCHES = [
  "#6366f1",
  "#a78bfa",
  "#38a169",
  "#3b82f6",
  "#f59e0b",
  "#ef4444",
];

type Tab = "cuentas" | "categorias" | "reglas" | "bancos";

interface Account {
  id: number;
  name: string;
  bank: string;
  type: string;
  color: string;
  hidden: boolean;
}

interface Category {
  id: number;
  name: string;
  emoji: string;
  excluded: boolean;
  _count: { transactions: number };
}

interface Rule {
  id: number;
  match: string;
  categoryId: number;
  category: { id: number; name: string; emoji: string };
}

// A transaction shaped for TransactionCard (dates as ISO strings). Used for both
// the staged suspect and the existing candidate it might duplicate.
interface SuspectTransaction {
  id: number;
  date: string;
  description: string;
  amount: number;
  currency: string | null;
  account: { id: number; name: string };
  category: { id: number; name: string; emoji: string };
}

export interface PendingSuspect extends SuspectTransaction {
  // The existing transaction this movement might duplicate, or null when that
  // candidate was deleted after the suspect was queued (still acceptable alone).
  candidate: SuspectTransaction | null;
}

interface Props {
  accounts: Account[];
  categories: Category[];
  rules: Rule[];
  pendingSuspects: PendingSuspect[];
}

export function ConfigClient({ accounts, categories, rules, pendingSuspects }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("bancos");
  const [selectedColor, setSelectedColor] = useState(COLOR_SWATCHES[0]);
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const accountFormRef = useRef<HTMLFormElement>(null);
  const categoryFormRef = useRef<HTMLFormElement>(null);

  async function handleCreateAccount(formData: FormData) {
    formData.set("color", selectedColor);
    setIsPending(true);
    try {
      await createAccount(formData);
      accountFormRef.current?.reset();
      setSelectedColor(COLOR_SWATCHES[0]);
      setShowAccountForm(false);
    } finally {
      setIsPending(false);
    }
  }

  async function handleDeleteAccount(id: number) {
    setIsPending(true);
    try {
      await deleteAccount(id);
    } finally {
      setIsPending(false);
    }
  }

  async function handleToggleVisibility(id: number) {
    setIsPending(true);
    try {
      await toggleAccountVisibility(id);
    } finally {
      setIsPending(false);
    }
  }

  async function handleCreateCategory(formData: FormData) {
    setIsPending(true);
    try {
      await createCategory(formData);
      categoryFormRef.current?.reset();
    } finally {
      setIsPending(false);
    }
  }

  async function handleToggleCategoryExclusion(id: number) {
    setIsPending(true);
    try {
      await toggleCategoryExclusion(id);
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Persistent review panel — shown above the tabs whenever there are
          suspected duplicates queued by a sync, on any tab. */}
      <PendingReviewPanel suspects={pendingSuspects} />

      <div className="flex flex-col md:flex-row gap-6 min-h-[500px]">
        {/* Mobile horizontal tabs — shown below md */}
        <div className="md:hidden flex gap-2 mb-1">
          {([
            { tab: "bancos" as Tab, label: "Conectar banco" },
            { tab: "cuentas" as Tab, label: "Cuentas" },
            { tab: "categorias" as Tab, label: "Categorías" },
            { tab: "reglas" as Tab, label: "Reglas" },
          ]).map(({ tab, label }) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2.5 px-3 rounded-xl text-sm font-medium transition-all min-h-[44px] ${
                activeTab === tab
                  ? "bg-indigo-50 text-indigo-500 font-semibold"
                  : "bg-white border border-gray-100 text-gray-500 hover:bg-gray-50 hover:text-gray-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Left sidebar — hidden on mobile */}
        <aside className="hidden md:block w-[220px] flex-shrink-0">
          <div className="bg-white rounded-2xl border border-gray-100 p-3 flex flex-col gap-1">
            {(["bancos", "cuentas", "categorias", "reglas"] as Tab[]).map((tab) => {
              const labels: Record<Tab, string> = { bancos: "Conectar banco", cuentas: "Cuentas", categorias: "Categorías", reglas: "Reglas" };
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    activeTab === tab
                      ? "bg-indigo-50 text-indigo-500 font-semibold"
                      : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                  }`}
                >
                  {labels[tab]}
                </button>
              );
            })}
          </div>
        </aside>

        {/* Right panel */}
        <div className="flex-1 min-w-0">
          {activeTab === "bancos" ? (
            <BancosPanel />
          ) : activeTab === "cuentas" ? (
            <CuentasPanel
              accounts={accounts}
              showForm={showAccountForm}
              setShowForm={setShowAccountForm}
              selectedColor={selectedColor}
              setSelectedColor={setSelectedColor}
              formRef={accountFormRef}
              isPending={isPending}
              onCreateAccount={handleCreateAccount}
              onDeleteAccount={handleDeleteAccount}
              onToggleVisibility={handleToggleVisibility}
            />
          ) : activeTab === "categorias" ? (
            <CategoriasPanel
              categories={categories}
              formRef={categoryFormRef}
              isPending={isPending}
              onCreateCategory={handleCreateCategory}
              onToggleExclusion={handleToggleCategoryExclusion}
            />
          ) : (
            <ReglasPanel rules={rules} categories={categories} />
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Pending duplicate-suspect review panel ─── */

// Shapes a suspect/candidate view into the object TransactionCard expects.
function toCard(t: SuspectTransaction) {
  return {
    id: t.id,
    date: t.date,
    description: t.description,
    note: null,
    amount: t.amount,
    currency: t.currency,
    familiar: null,
    isReimbursed: false,
    account: t.account,
    category: t.category,
  };
}

// Standing panel listing each suspected date-drift duplicate side-by-side with
// the existing transaction it might duplicate. Persistent: it renders whenever
// there are suspects (not only right after a sync). Aceptar imports the suspect
// as a real transaction; Rechazar discards it and durably remembers the
// rejection so the same drifted movement is silently skipped on future syncs.
// Either server action revalidates and we refresh so the panel repopulates from
// fresh props. A suspect whose candidate was deleted is still shown (alone) and
// remains both acceptable and rejectable.
function PendingReviewPanel({ suspects }: { suspects: PendingSuspect[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<{ id: number; action: "accept" | "reject" } | null>(null);

  if (suspects.length === 0) return null;

  async function handleAccept(id: number) {
    setBusy({ id, action: "accept" });
    try {
      await acceptPending(id);
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function handleReject(id: number) {
    setBusy({ id, action: "reject" });
    try {
      await rejectPending(id);
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="bg-amber-50/50 rounded-2xl border border-amber-200 p-5">
      <h2 className="text-base font-semibold text-amber-800">
        {suspects.length}{" "}
        {suspects.length === 1 ? "movimiento por revisar" : "movimientos por revisar"}
      </h2>
      <p className="text-sm text-amber-600 mt-0.5 mb-4">
        Posibles duplicados por desfase de fecha. Revisa cada movimiento junto a la
        transacción que podría duplicar y acéptalo para importarlo.
      </p>
      <ul className="flex flex-col gap-3">
        {suspects.map((s) => {
          const rowBusy = busy?.id === s.id;
          return (
            <li
              key={s.id}
              className="bg-white rounded-xl border border-gray-100 p-4 flex flex-col gap-3"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1">
                <div>
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                    Movimiento nuevo
                  </p>
                  <TransactionCard transaction={toCard(s)} />
                </div>
                <div className="md:border-l md:border-gray-100 md:pl-4">
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                    Posible duplicado
                  </p>
                  {s.candidate ? (
                    <TransactionCard transaction={toCard(s.candidate)} />
                  ) : (
                    <p className="text-sm text-gray-400 py-3">
                      La transacción original fue eliminada.
                    </p>
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => handleReject(s.id)}
                  disabled={rowBusy}
                  className="text-sm bg-white text-red-600 border border-red-200 rounded-xl px-5 py-2 font-semibold hover:bg-red-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {rowBusy && busy?.action === "reject" ? "Descartando…" : "Rechazar (es duplicado)"}
                </button>
                <button
                  type="button"
                  onClick={() => handleAccept(s.id)}
                  disabled={rowBusy}
                  className="text-sm bg-indigo-500 text-white rounded-xl px-5 py-2 font-semibold hover:bg-indigo-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {rowBusy && busy?.action === "accept" ? "Importando…" : "Aceptar (importar)"}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ─── Cuentas Panel ─── */

interface CuentasPanelProps {
  accounts: Account[];
  showForm: boolean;
  setShowForm: (v: boolean) => void;
  selectedColor: string;
  setSelectedColor: (c: string) => void;
  formRef: React.RefObject<HTMLFormElement | null>;
  isPending: boolean;
  onCreateAccount: (formData: FormData) => Promise<void>;
  onDeleteAccount: (id: number) => Promise<void>;
  onToggleVisibility: (id: number) => Promise<void>;
}

function CuentasPanel({
  accounts,
  showForm,
  setShowForm,
  selectedColor,
  setSelectedColor,
  formRef,
  isPending,
  onCreateAccount,
  onDeleteAccount,
  onToggleVisibility,
}: CuentasPanelProps) {
  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Cuentas</h2>
          <p className="text-sm text-gray-400 mt-0.5">
            Gestiona tus cuentas bancarias y tarjetas
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="bg-indigo-500 text-white rounded-xl px-5 py-2 text-sm font-semibold hover:bg-indigo-600 transition-colors"
          >
            + Agregar cuenta
          </button>
        )}
      </div>

      {/* Add account form */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">
            Agregar cuenta
          </h3>
          <form
            ref={formRef}
            action={onCreateAccount}
            className="flex flex-col gap-3.5"
          >
            {/* Name */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Nombre
              </label>
              <input
                name="name"
                type="text"
                placeholder="Ej. Cuenta corriente personal"
                required
                className="border border-indigo-100 rounded-xl p-2.5 text-sm text-gray-700 placeholder-gray-300 focus:outline-none focus:border-violet-400 transition-colors"
              />
            </div>

            {/* Bank */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Banco
              </label>
              <div className="relative">
                <select
                  name="bank"
                  required
                  defaultValue=""
                  className="w-full border border-indigo-100 rounded-xl p-2.5 text-sm text-gray-700 focus:outline-none focus:border-violet-400 transition-colors appearance-none bg-white pr-9"
                >
                  <option value="" disabled>
                    Selecciona un banco
                  </option>
                  {BANKS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 14 14"
                    fill="none"
                  >
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

            {/* Type */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Tipo de cuenta
              </label>
              <div className="relative">
                <select
                  name="type"
                  required
                  defaultValue=""
                  className="w-full border border-indigo-100 rounded-xl p-2.5 text-sm text-gray-700 focus:outline-none focus:border-violet-400 transition-colors appearance-none bg-white pr-9"
                >
                  <option value="" disabled>
                    Selecciona el tipo
                  </option>
                  {ACCOUNT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 14 14"
                    fill="none"
                  >
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

            {/* Color picker */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Color
              </label>
              <div className="flex gap-2">
                {COLOR_SWATCHES.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setSelectedColor(color)}
                    style={{ backgroundColor: color }}
                    className={`w-8 h-8 rounded-lg cursor-pointer transition-all focus:outline-none ${
                      selectedColor === color
                        ? "ring-2 ring-offset-2 ring-gray-400 scale-110"
                        : "hover:scale-105"
                    }`}
                    aria-label={`Color ${color}`}
                  />
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2.5 pt-1">
              <button
                type="submit"
                disabled={isPending}
                className="bg-indigo-500 text-white rounded-xl px-6 py-2.5 text-sm font-semibold hover:bg-indigo-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isPending ? "Guardando…" : "Agregar cuenta"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="border border-indigo-100 text-gray-400 rounded-xl px-6 py-2.5 text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Existing accounts */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700">
            Cuentas existentes
          </h3>
        </div>
        {accounts.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-gray-400">
            No hay cuentas registradas aún.
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {accounts.map((account) => (
              <li
                key={account.id}
                className={`flex items-center gap-3 px-5 py-3.5 transition-opacity ${account.hidden ? "opacity-50" : ""}`}
              >
                {/* Color dot */}
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: account.color }}
                />
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {account.name}
                  </p>
                  <p className="text-xs text-gray-400 truncate">
                    {account.bank} · {account.type}
                    {account.hidden && " · oculta"}
                  </p>
                </div>
                {/* Actions */}
                <div className="flex gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => handleToggleVisibility(account.id)}
                    disabled={isPending}
                    title={account.hidden ? "Mostrar cuenta" : "Ocultar cuenta"}
                    className={`text-xs border rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      account.hidden
                        ? "text-gray-400 border-gray-200 hover:bg-gray-50"
                        : "text-indigo-400 border-indigo-100 hover:bg-indigo-50"
                    }`}
                  >
                    {account.hidden ? "👁️ Mostrar" : "🙈 Ocultar"}
                  </button>
                  <button
                    onClick={() => handleDeleteAccount(account.id)}
                    disabled={isPending}
                    className="text-xs text-red-400 border border-red-100 rounded-lg px-3 py-1.5 hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Eliminar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );

  async function handleDeleteAccount(id: number) {
    await onDeleteAccount(id);
  }

  async function handleToggleVisibility(id: number) {
    await onToggleVisibility(id);
  }
}

/* ─── Categorías Panel ─── */

interface CategoriasPanelProps {
  categories: Category[];
  formRef: React.RefObject<HTMLFormElement | null>;
  isPending: boolean;
  onCreateCategory: (formData: FormData) => Promise<void>;
  onToggleExclusion: (id: number) => Promise<void>;
}

function CategoriasPanel({
  categories,
  formRef,
  isPending,
  onCreateCategory,
  onToggleExclusion,
}: CategoriasPanelProps) {
  const [createEmoji, setCreateEmoji] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmoji, setEditEmoji] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [editPending, setEditPending] = useState(false);
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);

  function startEdit(cat: Category) {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditEmoji(cat.emoji);
    setEditError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditError(null);
  }

  async function handleSaveEdit(cat: Category) {
    if (!editName.trim()) {
      setEditError("El nombre no puede estar vacío");
      return;
    }
    setEditPending(true);
    setEditError(null);
    try {
      const result = await updateCategory(cat.id, { name: editName, emoji: editEmoji });
      if (result.ok) {
        setEditingId(null);
      } else {
        setEditError(result.error);
      }
    } finally {
      setEditPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-gray-800">Categorías</h2>
        <p className="text-sm text-gray-400 mt-0.5">
          Organiza tus transacciones con categorías personalizadas
        </p>
      </div>

      {/* Create category form */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">
          Crear categoría
        </h3>
        <form
          ref={formRef}
          action={async (fd) => {
            await onCreateCategory(fd);
            setCreateEmoji("");
          }}
          className="flex flex-col sm:flex-row gap-3 sm:items-end"
        >
          <div className="flex flex-col gap-1.5 flex-1">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Nombre
            </label>
            <input
              name="name"
              type="text"
              placeholder="Ej. Supermercado"
              required
              className="border border-indigo-100 rounded-xl p-2.5 text-sm text-gray-700 placeholder-gray-300 focus:outline-none focus:border-violet-400 transition-colors"
            />
          </div>
          <div className="flex flex-col gap-1.5 w-24">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Emoji
            </label>
            <EmojiPicker
              name="emoji"
              value={createEmoji}
              onChange={setCreateEmoji}
            />
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="bg-indigo-500 text-white rounded-xl px-6 py-2.5 text-sm font-semibold hover:bg-indigo-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {isPending ? "Guardando…" : "Crear categoría"}
          </button>
        </form>
      </div>

      {/* Categories list */}
      {categories.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 px-5 py-10 text-center text-sm text-gray-400">
          No hay categorías registradas aún.
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700">Categorías existentes</h3>
          </div>
          <ul className="divide-y divide-gray-100">
            {categories.map((cat) => {
              const isEditing = editingId === cat.id;
              const isAutoCat = AUTO_CATEGORIZATION_NAMES.includes(cat.name);

              if (isEditing) {
                return (
                  <li key={cat.id} className="flex flex-col gap-2 px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <EmojiPicker
                        value={editEmoji}
                        onChange={setEditEmoji}
                        disabled={editPending}
                        buttonClassName="border border-indigo-200 rounded-lg p-2 text-lg w-14 text-center hover:border-violet-400 focus:outline-none focus:border-violet-400 disabled:opacity-60"
                      />
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        disabled={editPending}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveEdit(cat);
                          if (e.key === "Escape") cancelEdit();
                        }}
                        autoFocus
                        className="flex-1 border border-indigo-200 rounded-lg p-2 text-sm text-gray-700 focus:outline-none focus:border-violet-400 disabled:opacity-60"
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveEdit(cat)}
                        disabled={editPending}
                        className="text-xs bg-indigo-500 text-white rounded-lg px-3 py-1.5 hover:bg-indigo-600 transition-colors disabled:opacity-60 whitespace-nowrap"
                      >
                        {editPending ? "Guardando…" : "Guardar"}
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        disabled={editPending}
                        className="text-xs border border-gray-200 text-gray-500 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors disabled:opacity-60 whitespace-nowrap"
                      >
                        Cancelar
                      </button>
                    </div>
                    {editError && (
                      <p className="text-xs text-red-500 pl-2">{editError}</p>
                    )}
                  </li>
                );
              }

              return (
                <li
                  key={cat.id}
                  className={`flex items-center gap-3 px-5 py-3.5 ${cat.excluded ? "opacity-60" : ""}`}
                >
                  <span className="text-xl leading-none w-7 flex-shrink-0">{cat.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-700 truncate flex items-center gap-1.5">
                      {cat.name}
                      {isAutoCat && (
                        <span title="Usada por auto-categorización" className="text-amber-400 text-xs">⚠️</span>
                      )}
                      {cat.excluded && (
                        <span className="text-[10px] font-medium text-gray-400 border border-gray-200 rounded-full px-1.5 py-0.5 whitespace-nowrap">
                          sin estadísticas
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-gray-400">
                      {cat._count.transactions}{" "}
                      {cat._count.transactions === 1 ? "transacción" : "transacciones"}
                    </p>
                  </div>
                  {/* Exclude / Edit / Delete icons */}
                  <div className="flex gap-1 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => onToggleExclusion(cat.id)}
                      disabled={isPending}
                      title={cat.excluded ? "Incluir en estadísticas" : "Excluir de estadísticas"}
                      className={`text-xs rounded-lg px-2.5 py-1.5 transition-colors disabled:opacity-60 whitespace-nowrap ${
                        cat.excluded
                          ? "text-indigo-500 hover:bg-indigo-50"
                          : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {cat.excluded ? "📊 Incluir" : "🚫 Excluir"}
                    </button>
                    <button
                      type="button"
                      onClick={() => startEdit(cat)}
                      title="Editar categoría"
                      className="text-gray-400 hover:text-indigo-500 transition-colors p-1.5 rounded-lg hover:bg-indigo-50"
                    >
                      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                        <path
                          d="M10.5 1.5L13.5 4.5L5 13H2V10L10.5 1.5Z"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingCategory(cat)}
                      title="Eliminar categoría"
                      className="text-gray-400 hover:text-red-500 transition-colors p-1.5 rounded-lg hover:bg-red-50"
                    >
                      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                        <path
                          d="M2 4H13M6 4V2.5H9V4M5 4V12H10V4"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Delete dialog */}
      {deletingCategory && (
        <DeleteCategoryDialog
          category={deletingCategory}
          allCategories={categories}
          onClose={() => setDeletingCategory(null)}
          onDeleted={() => setDeletingCategory(null)}
        />
      )}
    </div>
  );
}

/* ─── Reglas Panel ─── */

interface ReglasPanelProps {
  rules: Rule[];
  categories: Category[];
}

function CategoryPicker({
  value,
  onChange,
  disabled,
  categories,
}: {
  value: number | "";
  onChange: (id: number) => void;
  disabled?: boolean;
  categories: Category[];
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
        className="w-full border border-indigo-100 rounded-xl p-2.5 text-sm text-gray-700 focus:outline-none focus:border-violet-400 transition-colors appearance-none bg-white pr-9 disabled:opacity-60"
      >
        <option value="" disabled>
          Selecciona una categoría
        </option>
        {categories
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
          <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </div>
  );
}

// Suggested rules mined from the user's manual categorizations. Recomputed live
// each time the panel mounts (and after every accept/dismiss) so the list never
// goes stale. The guessed match is editable before accepting; accepting creates
// the rule and sweeps matching "Otro" transactions, then reports the count.
function SuggestedRules({ categories }: { categories: Category[] }) {
  const [suggestions, setSuggestions] = useState<RuleSuggestion[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [edited, setEdited] = useState<Record<string, string>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const keyOf = (s: RuleSuggestion) => `${s.categoryId}:${s.match}`;

  const reload = useCallback(async () => {
    const result = await loadRuleSuggestions();
    setSuggestions(result.suggestions);
    setEdited({});
    setLoaded(true);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  async function handleAccept(s: RuleSuggestion) {
    const key = keyOf(s);
    const match = (edited[key] ?? s.match).trim();
    if (!match) return;
    setBusyKey(key);
    setMessage(null);
    try {
      const result = await acceptSuggestion({ match, categoryId: s.categoryId });
      if (result.ok) {
        setMessage(
          `Regla creada, ${result.recategorized} ${result.recategorized === 1 ? "transacción recategorizada" : "transacciones recategorizadas"}.`
        );
        await reload();
      } else {
        setMessage(result.error);
      }
    } finally {
      setBusyKey(null);
    }
  }

  async function handleDismiss(s: RuleSuggestion) {
    const key = keyOf(s);
    setBusyKey(key);
    try {
      await dismissSuggestion({ match: s.match, categoryId: s.categoryId });
      await reload();
    } finally {
      setBusyKey(null);
    }
  }

  if (!loaded || suggestions.length === 0) {
    // Stay quiet until there is something to propose — no empty-state noise.
    return message ? (
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <p className="text-xs text-green-600 pl-1">{message}</p>
      </div>
    ) : null;
  }

  return (
    <div className="bg-white rounded-2xl border border-indigo-100 bg-indigo-50/30 p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-1">Reglas sugeridas</h3>
      <p className="text-sm text-gray-400 mb-4">
        Basadas en transacciones que categorizaste a mano. Revisa el texto, ajústalo si hace falta y acéptalo.
      </p>
      {message && <p className="text-xs text-green-600 mb-3 pl-1">{message}</p>}
      <ul className="flex flex-col gap-2">
        {suggestions.map((s) => {
          const key = keyOf(s);
          const category = categoryById.get(s.categoryId);
          const value = edited[key] ?? s.match;
          const busy = busyKey === key;
          return (
            <li
              key={key}
              className="flex flex-col sm:flex-row sm:items-center gap-2 bg-white rounded-xl border border-gray-100 px-3 py-2.5"
            >
              <input
                type="text"
                value={value}
                onChange={(e) => setEdited((m) => ({ ...m, [key]: e.target.value }))}
                disabled={busy}
                className="flex-1 border border-indigo-100 rounded-lg p-2 text-sm font-mono text-gray-700 focus:outline-none focus:border-violet-400 disabled:opacity-60"
              />
              <span className="text-sm text-gray-600 whitespace-nowrap">
                → {category ? `${category.emoji} ${category.name}` : s.categoryId}
              </span>
              <span className="text-xs text-gray-400 whitespace-nowrap">
                {s.count} {s.count === 1 ? "transacción" : "transacciones"}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleAccept(s)}
                  disabled={busy}
                  className="text-xs bg-indigo-500 text-white rounded-lg px-3 py-1.5 hover:bg-indigo-600 transition-colors disabled:opacity-60 whitespace-nowrap"
                >
                  {busy ? "…" : "Aceptar"}
                </button>
                <button
                  type="button"
                  onClick={() => handleDismiss(s)}
                  disabled={busy}
                  className="text-xs border border-gray-200 text-gray-500 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors disabled:opacity-60 whitespace-nowrap"
                >
                  Descartar
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ReglasPanel({ rules, categories }: ReglasPanelProps) {
  const [newMatch, setNewMatch] = useState("");
  const [newCategoryId, setNewCategoryId] = useState<number | "">("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [createPending, setCreatePending] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editMatch, setEditMatch] = useState("");
  const [editCategoryId, setEditCategoryId] = useState<number | "">("");
  const [editError, setEditError] = useState<string | null>(null);
  const [editPending, setEditPending] = useState(false);

  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Export rules to a portable, dated JSON file.
  const [exportPending, setExportPending] = useState(false);

  async function handleExport() {
    setExportPending(true);
    try {
      const json = await exportRules();
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const today = new Date().toISOString().slice(0, 10);
      const link = document.createElement("a");
      link.href = url;
      link.download = `rules-${today}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } finally {
      setExportPending(false);
    }
  }

  // Import rules from a portable JSON file. Non-destructive, so it runs
  // immediately on file selection (no preview/confirm step) and then renders an
  // inline report of what was created vs skipped.
  const importInputRef = useRef<HTMLInputElement>(null);
  const [importPending, setImportPending] = useState(false);
  const [importReport, setImportReport] = useState<ImportRulesResult | null>(null);

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset the input so re-picking the same file fires onChange again.
    e.target.value = "";
    if (!file) return;

    setImportPending(true);
    setImportReport(null);
    try {
      const contents = await file.text();
      const result = await importRules(contents);
      setImportReport(result);
    } finally {
      setImportPending(false);
    }
  }

  // "Apply rules to existing" two-step flow: preview a count, confirm, apply.
  const [applyPending, setApplyPending] = useState(false);
  const [applyPreview, setApplyPreview] = useState<number | null>(null);
  const [applyResult, setApplyResult] = useState<string | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);

  async function handlePreviewApply() {
    setApplyPending(true);
    setApplyError(null);
    setApplyResult(null);
    try {
      const result = await previewApplyRules();
      if (result.ok) {
        setApplyPreview(result.count);
      } else {
        setApplyError(result.error);
      }
    } finally {
      setApplyPending(false);
    }
  }

  async function handleConfirmApply() {
    setApplyPending(true);
    setApplyError(null);
    try {
      const result = await applyRulesToExisting();
      if (result.ok) {
        setApplyResult(
          `${result.updated} ${result.updated === 1 ? "transacción recategorizada" : "transacciones recategorizadas"}.`
        );
      } else {
        setApplyError(result.error);
      }
    } finally {
      setApplyPending(false);
      setApplyPreview(null);
    }
  }

  function cancelApply() {
    setApplyPreview(null);
  }

  async function handleCreate() {
    if (!newMatch.trim()) {
      setCreateError("El texto a buscar no puede estar vacío");
      return;
    }
    if (newCategoryId === "") {
      setCreateError("Selecciona una categoría");
      return;
    }
    setCreatePending(true);
    setCreateError(null);
    try {
      const result = await createRule({ match: newMatch, categoryId: newCategoryId });
      if (result.ok) {
        setNewMatch("");
        setNewCategoryId("");
      } else {
        setCreateError(result.error);
      }
    } finally {
      setCreatePending(false);
    }
  }

  function startEdit(rule: Rule) {
    setEditingId(rule.id);
    setEditMatch(rule.match);
    setEditCategoryId(rule.categoryId);
    setEditError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditError(null);
  }

  async function handleSaveEdit(rule: Rule) {
    if (!editMatch.trim()) {
      setEditError("El texto a buscar no puede estar vacío");
      return;
    }
    if (editCategoryId === "") {
      setEditError("Selecciona una categoría");
      return;
    }
    setEditPending(true);
    setEditError(null);
    try {
      const result = await updateRule(rule.id, { match: editMatch, categoryId: editCategoryId });
      if (result.ok) {
        setEditingId(null);
      } else {
        setEditError(result.error);
      }
    } finally {
      setEditPending(false);
    }
  }

  async function handleDelete(id: number) {
    setDeletingId(id);
    try {
      await deleteRule(id);
    } finally {
      setDeletingId(null);
    }
  }

  const hasCategories = categories.length > 0;

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Reglas</h2>
          <p className="text-sm text-gray-400 mt-0.5">
            Si la descripción de una transacción contiene el texto, se asigna la categoría.
            Los cambios se aplican en la próxima sincronización.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleExport}
            disabled={exportPending}
            className="border border-indigo-200 text-indigo-600 rounded-xl px-5 py-2.5 text-sm font-semibold hover:bg-indigo-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {exportPending ? "Exportando…" : "Exportar reglas"}
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleImportFile}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => importInputRef.current?.click()}
            disabled={importPending}
            className="border border-indigo-200 text-indigo-600 rounded-xl px-5 py-2.5 text-sm font-semibold hover:bg-indigo-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {importPending ? "Importando…" : "Importar reglas"}
          </button>
        </div>
      </div>

      {/* Inline import report (Spanish), shown after an import completes. */}
      {importReport && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">
            Resultado de la importación
          </h3>
          {!importReport.ok ? (
            <p className="text-sm text-red-600">
              No se importó nada: {importReport.error}
            </p>
          ) : (
            <>
              <p className="text-sm text-gray-500">
                {importReport.created.length === 0
                  ? "No se creó ninguna regla nueva."
                  : `${importReport.created.length} ${importReport.created.length === 1 ? "regla creada" : "reglas creadas"}: ${importReport.created.join(", ")}.`}
              </p>
              {importReport.createdCategories.length > 0 && (
                <p className="text-sm text-gray-500 mt-1">
                  {importReport.createdCategories.length}{" "}
                  {importReport.createdCategories.length === 1
                    ? "categoría creada automáticamente"
                    : "categorías creadas automáticamente"}
                  : {importReport.createdCategories.join(", ")}.
                </p>
              )}
              {importReport.skippedExisting.length > 0 && (
                <p className="text-sm text-gray-400 mt-1">
                  {importReport.skippedExisting.length}{" "}
                  {importReport.skippedExisting.length === 1
                    ? "regla omitida porque ya existía"
                    : "reglas omitidas porque ya existían"}
                  : {importReport.skippedExisting.join(", ")}.
                </p>
              )}
              {importReport.skippedDuplicate.length > 0 && (
                <p className="text-sm text-gray-400 mt-1">
                  {importReport.skippedDuplicate.length}{" "}
                  {importReport.skippedDuplicate.length === 1
                    ? "regla omitida por estar duplicada en el archivo"
                    : "reglas omitidas por estar duplicadas en el archivo"}
                  : {importReport.skippedDuplicate.join(", ")}.
                </p>
              )}
              {importReport.skippedInvalid.length > 0 && (
                <p className="text-sm text-gray-400 mt-1">
                  {importReport.skippedInvalid.length}{" "}
                  {importReport.skippedInvalid.length === 1
                    ? "regla omitida por ser inválida"
                    : "reglas omitidas por ser inválidas"}
                  .
                </p>
              )}
            </>
          )}
        </div>
      )}

      {/* Suggested rules (mined from manual categorizations) */}
      <SuggestedRules categories={categories} />

      {/* Create rule form */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Crear regla</h3>
        {!hasCategories ? (
          <p className="text-sm text-gray-400">
            Crea al menos una categoría antes de definir reglas.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex flex-col gap-1.5 flex-1">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Texto a buscar
                </label>
                <input
                  type="text"
                  value={newMatch}
                  onChange={(e) => setNewMatch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreate();
                  }}
                  placeholder="Ej. JUMBO"
                  disabled={createPending}
                  className="border border-indigo-100 rounded-xl p-2.5 text-sm text-gray-700 placeholder-gray-300 focus:outline-none focus:border-violet-400 transition-colors disabled:opacity-60"
                />
              </div>
              <div className="flex flex-col gap-1.5 flex-1">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Categoría
                </label>
                <CategoryPicker
                  value={newCategoryId}
                  onChange={setNewCategoryId}
                  disabled={createPending}
                  categories={categories}
                />
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={createPending}
                  className="bg-indigo-500 text-white rounded-xl px-6 py-2.5 text-sm font-semibold hover:bg-indigo-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap w-full sm:w-auto"
                >
                  {createPending ? "Guardando…" : "Crear regla"}
                </button>
              </div>
            </div>
            {createError && <p className="text-xs text-red-500 pl-1">{createError}</p>}
          </div>
        )}
      </div>

      {/* Apply rules to existing transactions */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-700">Aplicar a transacciones existentes</h3>
            <p className="text-sm text-gray-400 mt-0.5">
              Recategoriza las transacciones que están en «Otro» usando las reglas actuales. No toca las que ya categorizaste a mano.
            </p>
          </div>
          <button
            type="button"
            onClick={handlePreviewApply}
            disabled={applyPending || rules.length === 0}
            className="bg-indigo-500 text-white rounded-xl px-6 py-2.5 text-sm font-semibold hover:bg-indigo-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {applyPending ? "Procesando…" : "Aplicar reglas"}
          </button>
        </div>
        {applyResult && <p className="text-xs text-green-600 mt-3 pl-1">{applyResult}</p>}
        {applyError && <p className="text-xs text-red-500 mt-3 pl-1">{applyError}</p>}
      </div>

      {/* Confirmation dialog for "apply to existing" */}
      {applyPreview !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6">
            <h3 className="text-lg font-semibold text-gray-800">Confirmar recategorización</h3>
            <p className="text-sm text-gray-500 mt-2">
              {applyPreview === 0
                ? "Ninguna transacción en «Otro» coincide con tus reglas. No se hará ningún cambio."
                : `Se recategorizarán ${applyPreview} ${applyPreview === 1 ? "transacción" : "transacciones"} actualmente en «Otro». ¿Continuar?`}
            </p>
            <div className="flex justify-end gap-2 mt-5">
              <button
                type="button"
                onClick={cancelApply}
                disabled={applyPending}
                className="text-sm border border-gray-200 text-gray-500 rounded-xl px-4 py-2 hover:bg-gray-50 transition-colors disabled:opacity-60"
              >
                Cancelar
              </button>
              {applyPreview > 0 && (
                <button
                  type="button"
                  onClick={handleConfirmApply}
                  disabled={applyPending}
                  className="text-sm bg-indigo-500 text-white rounded-xl px-4 py-2 font-semibold hover:bg-indigo-600 transition-colors disabled:opacity-60"
                >
                  {applyPending ? "Aplicando…" : "Confirmar"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Rules list */}
      {rules.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 px-5 py-10 text-center text-sm text-gray-400">
          No hay reglas registradas aún.
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700">
              Reglas existentes ({rules.length})
            </h3>
          </div>
          <ul className="divide-y divide-gray-100">
            {rules.map((rule) => {
              const isEditing = editingId === rule.id;

              if (isEditing) {
                return (
                  <li key={rule.id} className="flex flex-col gap-2 px-5 py-3.5">
                    <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                      <input
                        type="text"
                        value={editMatch}
                        onChange={(e) => setEditMatch(e.target.value)}
                        disabled={editPending}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveEdit(rule);
                          if (e.key === "Escape") cancelEdit();
                        }}
                        autoFocus
                        className="flex-1 border border-indigo-200 rounded-lg p-2 text-sm text-gray-700 focus:outline-none focus:border-violet-400 disabled:opacity-60"
                      />
                      <div className="flex-1">
                        <CategoryPicker
                          value={editCategoryId}
                          onChange={setEditCategoryId}
                          disabled={editPending}
                          categories={categories}
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(rule)}
                          disabled={editPending}
                          className="text-xs bg-indigo-500 text-white rounded-lg px-3 py-1.5 hover:bg-indigo-600 transition-colors disabled:opacity-60 whitespace-nowrap"
                        >
                          {editPending ? "Guardando…" : "Guardar"}
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          disabled={editPending}
                          className="text-xs border border-gray-200 text-gray-500 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors disabled:opacity-60 whitespace-nowrap"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                    {editError && <p className="text-xs text-red-500 pl-1">{editError}</p>}
                  </li>
                );
              }

              return (
                <li key={rule.id} className="flex items-center gap-3 px-5 py-3.5">
                  <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-mono text-gray-700 bg-gray-50 rounded px-2 py-0.5 break-all">
                      {rule.match}
                    </span>
                    <span className="text-gray-300">→</span>
                    <span className="text-sm text-gray-600 whitespace-nowrap">
                      {rule.category.emoji} {rule.category.name}
                    </span>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => startEdit(rule)}
                      title="Editar regla"
                      className="text-gray-400 hover:text-indigo-500 transition-colors p-1.5 rounded-lg hover:bg-indigo-50"
                    >
                      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                        <path
                          d="M10.5 1.5L13.5 4.5L5 13H2V10L10.5 1.5Z"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(rule.id)}
                      disabled={deletingId === rule.id}
                      title="Eliminar regla"
                      className="text-gray-400 hover:text-red-500 transition-colors p-1.5 rounded-lg hover:bg-red-50 disabled:opacity-50"
                    >
                      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                        <path
                          d="M2 4H13M6 4V2.5H9V4M5 4V12H10V4"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ─── Bancos Panel ─── */

const SUPPORTED_BANKS = [
  { id: "bestado", name: "BancoEstado (CuentaRUT)", note: "Abrirá una ventana de Chrome" },
  { id: "bchile", name: "Banco de Chile", note: "" },
  { id: "santander", name: "Santander", note: "" },
  { id: "bci", name: "BCI", note: "Requiere BCI Pass en tu celular" },
  { id: "itau", name: "Itaú", note: "Requiere Itaú Key" },
  { id: "falabella", name: "Banco Falabella / CMR", note: "" },
  { id: "scotiabank", name: "Scotiabank", note: "" },
  { id: "bice", name: "BICE", note: "" },
  { id: "edwards", name: "Banco Edwards", note: "" },
];

function BancosPanel() {
  const router = useRouter();
  const [selectedBank, setSelectedBank] = useState("");
  const [rut, setRut] = useState("");
  const [password, setPassword] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  async function handleSync(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedBank || !rut || !password) return;
    setSyncing(true);
    setStatus(null);

    try {
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bankId: selectedBank, rut, password }),
      });

      const data = await res.json();

      if (data.success) {
        const pendingReview = data.pendingReview ?? 0;
        setStatus({
          type: "success",
          message: `Sincronización exitosa: ${data.imported} transacciones importadas${data.skipped > 0 ? `, ${data.skipped} duplicadas omitidas` : ""}${pendingReview > 0 ? `, ${pendingReview} por revisar` : ""}.`,
        });
        setPassword("");
        // Sync goes through a fetch API route (not a server action), so refresh
        // to repopulate the persistent review panel from fresh server props.
        router.refresh();
      } else {
        setStatus({ type: "error", message: data.error || "Error desconocido" });
      }
    } catch {
      setStatus({ type: "error", message: "Error de conexión. Intenta de nuevo." });
    } finally {
      setSyncing(false);
    }
  }

  const bankInfo = SUPPORTED_BANKS.find((b) => b.id === selectedBank);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-semibold text-gray-800">Conectar banco</h2>
        <p className="text-sm text-gray-400 mt-0.5">
          Sincroniza tus movimientos reales desde tu banco
        </p>
      </div>

      {/* Info box */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3">
        <span className="text-lg">🔒</span>
        <div className="text-sm text-amber-800">
          <p className="font-medium">Tus credenciales son seguras</p>
          <p className="text-amber-600 mt-0.5">
            La conexión se hace directamente desde tu computador al portal del banco.
            Tus datos nunca salen de esta máquina.
          </p>
        </div>
      </div>

      {/* Sync form */}
      <form onSubmit={handleSync} className="bg-white rounded-2xl border border-gray-100 p-5 flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-gray-700">Datos de acceso</h3>

        {/* Bank select */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Banco
          </label>
          <div className="relative">
            <select
              value={selectedBank}
              onChange={(e) => setSelectedBank(e.target.value)}
              className="w-full border border-indigo-100 rounded-xl p-2.5 text-sm text-gray-700 focus:outline-none focus:border-violet-400 transition-colors appearance-none bg-white pr-9"
            >
              <option value="">Selecciona tu banco</option>
              {SUPPORTED_BANKS.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </div>
          {bankInfo?.note && (
            <p className="text-xs text-gray-400 mt-0.5">ℹ️ {bankInfo.note}</p>
          )}
        </div>

        {/* RUT */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="rut" className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            RUT
          </label>
          <input
            id="rut"
            name="rut"
            type="text"
            autoComplete="username"
            value={rut}
            onChange={(e) => setRut(e.target.value)}
            placeholder="12.345.678-9"
            className="border border-indigo-100 rounded-xl p-2.5 text-sm text-gray-700 placeholder-gray-300 focus:outline-none focus:border-violet-400 transition-colors"
          />
        </div>

        {/* Password */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Clave internet
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Tu clave de banca en línea"
            className="border border-indigo-100 rounded-xl p-2.5 text-sm text-gray-700 placeholder-gray-300 focus:outline-none focus:border-violet-400 transition-colors"
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={syncing || !selectedBank || !rut || !password}
          className="bg-indigo-500 text-white rounded-xl px-6 py-3 text-sm font-semibold hover:bg-indigo-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-1"
        >
          {syncing ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Conectando con el banco...
            </>
          ) : (
            "Sincronizar movimientos"
          )}
        </button>

        {syncing && (
          <p className="text-xs text-gray-400 text-center">
            Esto puede tomar 30-60 segundos. Se abrirá una ventana de Chrome.
            {selectedBank === "bci" || selectedBank === "itau" ? " Aprueba la verificación en tu celular." : ""}
          </p>
        )}
      </form>

      {/* Status message */}
      {status && (
        <div
          className={`rounded-2xl p-4 text-sm flex gap-3 ${
            status.type === "success"
              ? "bg-green-50 border border-green-200 text-green-800"
              : "bg-red-50 border border-red-200 text-red-800"
          }`}
        >
          <span className="text-lg">{status.type === "success" ? "✅" : "❌"}</span>
          <span>{status.message}</span>
        </div>
      )}
    </div>
  );
}
