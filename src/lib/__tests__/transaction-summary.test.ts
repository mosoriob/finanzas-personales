import { describe, it, expect } from "vitest";
import { summarizeTransactions, excludedUsdLabel } from "@/lib/transaction-summary";

type Row = {
  amount: number;
  currency?: string | null;
  familiar?: "VINA" | "MELIPILLA" | null;
  isReimbursed?: boolean;
  excluded?: boolean;
};

function rows(...rs: Row[]) {
  return rs.map(({ excluded = false, ...r }) => ({
    familiar: null,
    isReimbursed: false,
    currency: null,
    category: { excluded },
    ...r,
  }));
}

describe("summarizeTransactions", () => {
  it("excludes USD rows from the peso expense total", () => {
    const { expenses } = summarizeTransactions(
      rows(
        { amount: -45230, currency: null },
        { amount: -119, currency: "USD" },
      ),
    );
    // USD charge is excluded — only the peso expense counts.
    expect(expenses).toBe(-45230);
  });

  it("excludes USD rows from the peso income total", () => {
    const { income } = summarizeTransactions(
      rows(
        { amount: 100000, currency: null },
        { amount: 119, currency: "USD" },
      ),
    );
    expect(income).toBe(100000);
  });

  it("counts how many USD rows were excluded", () => {
    const { excludedUsdCount } = summarizeTransactions(
      rows(
        { amount: -45230, currency: null },
        { amount: -119, currency: "USD" },
        { amount: -50, currency: "USD" },
      ),
    );
    expect(excludedUsdCount).toBe(2);
  });

  it("reports zero excluded when the set is all pesos", () => {
    const { excludedUsdCount } = summarizeTransactions(
      rows({ amount: -45230 }, { amount: 1000 }),
    );
    expect(excludedUsdCount).toBe(0);
  });

  it("excludes USD rows from the per-household pending totals", () => {
    const { pendingByHousehold } = summarizeTransactions(
      rows(
        { amount: -1000, currency: null, familiar: "VINA" },
        { amount: -119, currency: "USD", familiar: "VINA" },
      ),
    );
    expect(pendingByHousehold.VINA).toBe(1000);
  });

  it("excludes rows whose category is excluded from the expense total", () => {
    const { expenses } = summarizeTransactions(
      rows(
        { amount: -45230 },
        { amount: -7813060, excluded: true },
      ),
    );
    expect(expenses).toBe(-45230);
  });

  it("excludes rows whose category is excluded from the income total", () => {
    const { income } = summarizeTransactions(
      rows(
        { amount: 100000 },
        { amount: 7813060, excluded: true },
      ),
    );
    expect(income).toBe(100000);
  });

  it("excludes rows whose category is excluded from the per-household pending totals", () => {
    const { pendingByHousehold } = summarizeTransactions(
      rows(
        { amount: -1000, familiar: "VINA" },
        { amount: -5000, familiar: "VINA", excluded: true },
      ),
    );
    expect(pendingByHousehold.VINA).toBe(1000);
  });

  it("does not count an excluded USD row as an excluded-USD charge", () => {
    const { excludedUsdCount } = summarizeTransactions(
      rows(
        { amount: -45230 },
        { amount: -119, currency: "USD", excluded: true },
      ),
    );
    expect(excludedUsdCount).toBe(0);
  });
});

describe("excludedUsdLabel", () => {
  it("uses the singular form for one excluded charge", () => {
    expect(excludedUsdLabel(1)).toBe("1 cargo en US$ no incluido en los totales");
  });

  it("uses the plural form for several excluded charges", () => {
    expect(excludedUsdLabel(3)).toBe("3 cargos en US$ no incluidos en los totales");
  });
});
