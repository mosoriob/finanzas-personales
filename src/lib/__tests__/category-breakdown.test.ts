import { describe, it, expect } from "vitest";
import { summarizeByCategory } from "@/lib/category-breakdown";

type Row = {
  amount: number;
  currency?: string | null;
  name: string;
  emoji?: string;
  excluded?: boolean;
};

function rows(...rs: Row[]) {
  return rs.map(({ name, emoji = "📌", excluded = false, currency = null, amount }) => ({
    amount,
    currency,
    category: { name, emoji, excluded },
  }));
}

describe("summarizeByCategory", () => {
  it("groups expenses by category name and sums absolute amounts", () => {
    const result = summarizeByCategory(
      rows(
        { amount: -1000, name: "Supermercado", emoji: "🛒" },
        { amount: -500, name: "Supermercado", emoji: "🛒" },
        { amount: -2000, name: "Transporte", emoji: "🚗" },
      ),
    );
    expect(result).toEqual([
      { name: "Transporte", emoji: "🚗", total: 2000 },
      { name: "Supermercado", emoji: "🛒", total: 1500 },
    ]);
  });

  it("sorts categories by total descending", () => {
    const result = summarizeByCategory(
      rows(
        { amount: -100, name: "A" },
        { amount: -900, name: "B" },
      ),
    );
    expect(result.map((c) => c.name)).toEqual(["B", "A"]);
  });

  it("ignores income (positive amounts)", () => {
    const result = summarizeByCategory(
      rows(
        { amount: -1000, name: "Supermercado" },
        { amount: 500000, name: "Sueldo" },
      ),
    );
    expect(result.map((c) => c.name)).toEqual(["Supermercado"]);
  });

  it("ignores USD rows", () => {
    const result = summarizeByCategory(
      rows(
        { amount: -1000, name: "Supermercado" },
        { amount: -119, currency: "USD", name: "Viajes" },
      ),
    );
    expect(result.map((c) => c.name)).toEqual(["Supermercado"]);
  });

  it("excludes categories flagged as excluded", () => {
    const result = summarizeByCategory(
      rows(
        { amount: -1000, name: "Supermercado" },
        { amount: -7813060, name: "Movimiento interno", excluded: true },
      ),
    );
    expect(result.map((c) => c.name)).toEqual(["Supermercado"]);
  });

  it("returns an empty list when there are no countable expenses", () => {
    expect(summarizeByCategory(rows({ amount: 1000, name: "Sueldo" }))).toEqual([]);
  });
});
