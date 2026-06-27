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
