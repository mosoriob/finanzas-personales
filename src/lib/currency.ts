/**
 * Currency-aware money handling — the single seam every display and
 * aggregation site shares so they cannot drift.
 *
 * The app has no foreign-exchange rate source, so USD amounts are never
 * converted to pesos. Instead, USD is displayed honestly (`US$`) and excluded
 * from every peso aggregate. The convention is consistent end-to-end:
 * absent/`null` currency means CLP (matching what the scraper emits), so
 * existing rows stay valid without a backfill.
 */

import { formatCLP } from "@/lib/format";

/**
 * Format a money amount with its currency.
 *
 * For USD the sign lives *inside* the string (so `{amount:-119,currency:"USD"}`
 * → `-US$119`): the transaction renderers convey sign only through the
 * formatted text (color merely marks positive vs. non-positive), so a
 * sign-less formatter would silently drop the minus on USD expenses. Any other
 * currency (null/absent/"CLP") delegates to the existing peso formatter.
 */
export function formatMoney(amount: number, currency?: string | null): string {
  if (currency === "USD") {
    const abs = Math.abs(amount).toLocaleString("es-CL");
    return amount < 0 ? `-US$${abs}` : `US$${abs}`;
  }
  return formatCLP(amount);
}

/**
 * Single source of truth for "counts as pesos". True when currency is
 * null/absent or "CLP"; false for "USD". Every peso aggregation filters
 * through this before summing.
 */
export function isCLP(transaction: { currency?: string | null }): boolean {
  return transaction.currency == null || transaction.currency === "CLP";
}

/**
 * Normalize a scraped movement's currency to the form persisted on
 * Transaction.currency. Only "USD" or null is ever written: "USD" stays,
 * everything else (absent/"CLP") becomes null (CLP). This is the storage-side
 * counterpart of the display/aggregation helpers above, keeping the whole
 * currency convention in one module.
 */
export function toStoredCurrency(currency?: string | null): "USD" | null {
  return currency === "USD" ? "USD" : null;
}
