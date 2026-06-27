"use client";

import { useState, useRef } from "react";
import { createAccount, deleteAccount, createCategory, toggleAccountVisibility, updateCategory, createRule, updateRule, deleteRule } from "./actions";
import { DeleteCategoryDialog } from "@/components/DeleteCategoryDialog";
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
  _count: { transactions: number };
}

interface Rule {
  id: number;
  match: string;
  categoryId: number;
  category: { id: number; name: string; emoji: string };
}

interface Props {
  accounts: Account[];
  categories: Category[];
  rules: Rule[];
}

export function ConfigClient({ accounts, categories, rules }: Props) {
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

  return (
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
          />
        ) : (
          <ReglasPanel rules={rules} categories={categories} />
        )}
      </div>
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
}

function CategoriasPanel({
  categories,
  formRef,
  isPending,
  onCreateCategory,
}: CategoriasPanelProps) {
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
          action={onCreateCategory}
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
            <input
              name="emoji"
              type="text"
              placeholder="📌"
              maxLength={4}
              className="border border-indigo-100 rounded-xl p-2.5 text-sm text-gray-700 placeholder-gray-300 focus:outline-none focus:border-violet-400 transition-colors text-center"
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
                      <input
                        type="text"
                        value={editEmoji}
                        onChange={(e) => setEditEmoji(e.target.value)}
                        maxLength={4}
                        disabled={editPending}
                        className="border border-indigo-200 rounded-lg p-2 text-sm w-14 text-center focus:outline-none focus:border-violet-400 disabled:opacity-60"
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
                  className="flex items-center gap-3 px-5 py-3.5"
                >
                  <span className="text-xl leading-none w-7 flex-shrink-0">{cat.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-700 truncate flex items-center gap-1.5">
                      {cat.name}
                      {isAutoCat && (
                        <span title="Usada por auto-categorización" className="text-amber-400 text-xs">⚠️</span>
                      )}
                    </p>
                    <p className="text-xs text-gray-400">
                      {cat._count.transactions}{" "}
                      {cat._count.transactions === 1 ? "transacción" : "transacciones"}
                    </p>
                  </div>
                  {/* Edit / Delete icons */}
                  <div className="flex gap-1 flex-shrink-0">
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
      <div>
        <h2 className="text-xl font-semibold text-gray-800">Reglas</h2>
        <p className="text-sm text-gray-400 mt-0.5">
          Si la descripción de una transacción contiene el texto, se asigna la categoría.
          Los cambios se aplican en la próxima sincronización.
        </p>
      </div>

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
  const [selectedBank, setSelectedBank] = useState("");
  const [rut, setRut] = useState("");
  const [password, setPassword] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  async function handleSync() {
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
        setStatus({
          type: "success",
          message: `Sincronización exitosa: ${data.imported} transacciones importadas${data.skipped > 0 ? `, ${data.skipped} duplicadas omitidas` : ""}.`,
        });
        setPassword("");
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
      <div className="bg-white rounded-2xl border border-gray-100 p-5 flex flex-col gap-4">
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
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            RUT
          </label>
          <input
            type="password"
            value={rut}
            onChange={(e) => setRut(e.target.value)}
            placeholder="12.345.678-9"
            className="border border-indigo-100 rounded-xl p-2.5 text-sm text-gray-700 placeholder-gray-300 focus:outline-none focus:border-violet-400 transition-colors"
          />
        </div>

        {/* Password */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Clave internet
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Tu clave de banca en línea"
            className="border border-indigo-100 rounded-xl p-2.5 text-sm text-gray-700 placeholder-gray-300 focus:outline-none focus:border-violet-400 transition-colors"
          />
        </div>

        {/* Submit */}
        <button
          onClick={handleSync}
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
      </div>

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
