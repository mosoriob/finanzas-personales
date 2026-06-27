/**
 * Per-household classification for transactions.
 *
 * A transaction belongs to one of three states:
 *   - Personal (null)       — not a family movement (the default)
 *   - "VINA"                — Viña household (Pamela y Max)
 *   - "MELIPILLA"           — Melipilla household (Padres)
 *
 * Stored on Transaction.familiar as a nullable text column (SQLite has no
 * native Prisma enums). The allowed values are enforced in the app layer
 * via the union below.
 */

export type Familiar = "VINA" | "MELIPILLA";

export const FAMILIAR_VALUES: readonly Familiar[] = ["VINA", "MELIPILLA"] as const;

export function isFamiliar(value: unknown): value is Familiar {
  return value === "VINA" || value === "MELIPILLA";
}

/** Long labels — used by the transactions dropdown and the household filter. */
export const FAMILIAR_LONG_LABEL: Record<Familiar, string> = {
  VINA: "Viña (Pamela y Max)",
  MELIPILLA: "Melipilla (Padres)",
};

/** Short labels — used by the mobile card badge and the active-filter pill. */
export const FAMILIAR_SHORT_LABEL: Record<Familiar, string> = {
  VINA: "🏠 Viña",
  MELIPILLA: "👴 Melipilla",
};

export const PERSONAL_LABEL = "Personal";

/**
 * The household dropdowns model "Personal" as an explicit option, since a
 * <select> cannot carry a null value. `dropdownValueToFamiliar` converts back
 * to the nullable form persisted on the transaction.
 */
export type FamiliarDropdownValue = "PERSONAL" | Familiar;

export function familiarToDropdownValue(
  familiar: Familiar | null,
): FamiliarDropdownValue {
  return familiar ?? "PERSONAL";
}

export function dropdownValueToFamiliar(
  value: FamiliarDropdownValue,
): Familiar | null {
  return value === "PERSONAL" ? null : value;
}

/** Options for the household <select>, in display order. */
export const FAMILIAR_DROPDOWN_OPTIONS: {
  value: FamiliarDropdownValue;
  label: string;
}[] = [
  { value: "PERSONAL", label: PERSONAL_LABEL },
  ...FAMILIAR_VALUES.map((value) => ({
    value,
    label: FAMILIAR_LONG_LABEL[value],
  })),
];

/**
 * The transactions list household filter. "todos" applies no constraint; the
 * remaining values reuse the dropdown encoding (VINA / MELIPILLA / PERSONAL,
 * where PERSONAL means "no household").
 */
export type HouseholdFilter = "todos" | FamiliarDropdownValue;

/** Options for the household filter <select>, in display order. */
export const HOUSEHOLD_FILTER_OPTIONS: {
  value: HouseholdFilter;
  label: string;
}[] = [
  { value: "todos", label: "Todos los gastos" },
  ...FAMILIAR_VALUES.map((value) => ({
    value,
    label: FAMILIAR_LONG_LABEL[value],
  })),
  { value: "PERSONAL", label: PERSONAL_LABEL },
];

/** True when a row's household passes the active filter. */
export function matchesHouseholdFilter(
  familiar: Familiar | null,
  filter: HouseholdFilter,
): boolean {
  return filter === "todos" || familiar === dropdownValueToFamiliar(filter);
}

/**
 * Pending reimbursement, broken down per household.
 *
 * Counts only real money owed: unreimbursed expenses (negative amounts) that
 * belong to a household. Personal rows and income are ignored. The result is
 * a positive magnitude per household (Viña vs Melipilla pay me back
 * separately), naturally yielding 0 for a household with no pending rows —
 * including when a household filter has already excluded it from the input.
 */
export function householdPendingTotals(
  transactions: readonly {
    familiar: Familiar | null;
    isReimbursed: boolean;
    amount: number;
  }[],
): Record<Familiar, number> {
  const totals: Record<Familiar, number> = { VINA: 0, MELIPILLA: 0 };
  for (const t of transactions) {
    if (t.familiar === null || t.isReimbursed || t.amount >= 0) continue;
    totals[t.familiar] += Math.abs(t.amount);
  }
  return totals;
}

/** Short label for the active-filter pill (filter must not be "todos"). */
export function householdFilterLabel(filter: HouseholdFilter): string {
  if (filter === "todos") return "";
  const familiar = dropdownValueToFamiliar(filter);
  return familiar === null ? PERSONAL_LABEL : FAMILIAR_SHORT_LABEL[familiar];
}
