import { describe, it, expect } from "vitest";
import { buildGastosBreakdown, type GastoRow } from "@/lib/gastos-breakdown";
import type { Familiar } from "@/lib/familiar";

let nextId = 1;
const idFor = new Map<string, number>();
function catId(name: string): number {
  if (!idFor.has(name)) idFor.set(name, nextId++);
  return idFor.get(name)!;
}

type Row = {
  amount: number;
  name: string;
  emoji?: string;
  isCLP?: boolean;
  familiar?: Familiar | null;
  description?: string;
};

let nextTxId = 1;

function rows(...rs: Row[]): GastoRow[] {
  return rs.map(
    ({ name, emoji = "📌", isCLP = true, familiar = null, amount, description }) => ({
      id: nextTxId++,
      date: "2026-06-01T00:00:00.000Z",
      description: description ?? name,
      note: null,
      amount,
      currency: isCLP ? "CLP" : "USD",
      isReimbursed: false,
      account: { id: 1, name: "Cuenta" },
      isCLP,
      familiar,
      category: { id: catId(name), name, emoji },
    }),
  );
}

const NONE = new Set<number>();

describe("buildGastosBreakdown", () => {
  it("groups CLP expenses by category and sorts by total descending", () => {
    const { categories, visibleTotal } = buildGastosBreakdown(
      rows(
        { amount: -1000, name: "Supermercado", emoji: "🛒" },
        { amount: -500, name: "Supermercado", emoji: "🛒" },
        { amount: -2000, name: "Transporte", emoji: "🚗" },
      ),
      "todos",
      NONE,
    );
    expect(categories.map((c) => [c.name, c.total, c.count])).toEqual([
      ["Transporte", 2000, 1],
      ["Supermercado", 1500, 2],
    ]);
    expect(visibleTotal).toBe(3500);
  });

  it("excludes off-toggled categories from visibleTotal but keeps them listed", () => {
    const meta = catId("MetaLearn SPA");
    const { categories, visibleTotal } = buildGastosBreakdown(
      rows(
        { amount: -1000, name: "Supermercado" },
        { amount: -4000, name: "MetaLearn SPA" },
      ),
      "todos",
      new Set([meta]),
    );
    // Still listed (so the user can toggle it back on)...
    expect(categories.map((c) => c.name)).toEqual(["MetaLearn SPA", "Supermercado"]);
    // ...but its 4000 is not in the visible total.
    expect(visibleTotal).toBe(1000);
  });

  it("scopes to a single household lens", () => {
    const { categories, visibleTotal } = buildGastosBreakdown(
      rows(
        { amount: -1000, name: "Supermercado", familiar: "VINA" },
        { amount: -3000, name: "Restaurant", familiar: "MELIPILLA" },
        { amount: -500, name: "Café", familiar: null },
      ),
      "VINA",
      NONE,
    );
    expect(categories.map((c) => c.name)).toEqual(["Supermercado"]);
    expect(visibleTotal).toBe(1000);
  });

  it("treats the PERSONAL lens as rows with no household", () => {
    const { categories } = buildGastosBreakdown(
      rows(
        { amount: -1000, name: "Supermercado", familiar: "VINA" },
        { amount: -500, name: "Café", familiar: null },
      ),
      "PERSONAL",
      NONE,
    );
    expect(categories.map((c) => c.name)).toEqual(["Café"]);
  });

  it("keeps USD rows out of the total but counts them, respecting the lens", () => {
    const { categories, visibleTotal, usdCount } = buildGastosBreakdown(
      rows(
        { amount: -1000, name: "Supermercado" },
        { amount: -119, name: "Viajes", isCLP: false },
        { amount: -50, name: "Software", isCLP: false, familiar: "VINA" },
      ),
      "todos",
      NONE,
    );
    expect(categories.map((c) => c.name)).toEqual(["Supermercado"]);
    expect(visibleTotal).toBe(1000);
    expect(usdCount).toBe(2);
  });

  it("attaches the category's CLP transactions, largest magnitude first", () => {
    const { categories } = buildGastosBreakdown(
      rows(
        { amount: -500, name: "Supermercado", description: "Lider" },
        { amount: -3000, name: "Supermercado", description: "Jumbo" },
        { amount: -1000, name: "Supermercado", description: "Unimarc" },
      ),
      "todos",
      NONE,
    );
    const market = categories[0];
    expect(market.count).toBe(market.transactions.length);
    expect(market.transactions.map((t) => t.description)).toEqual([
      "Jumbo",
      "Unimarc",
      "Lider",
    ]);
  });

  it("excludes USD rows from a category's attached transactions", () => {
    const { categories } = buildGastosBreakdown(
      rows(
        { amount: -1000, name: "Viajes", description: "Hotel CLP" },
        { amount: -200, name: "Viajes", description: "Hotel USD", isCLP: false },
      ),
      "todos",
      NONE,
    );
    const viajes = categories[0];
    expect(viajes.count).toBe(1);
    expect(viajes.transactions.map((t) => t.description)).toEqual(["Hotel CLP"]);
  });

  it("returns empty results when nothing is in scope", () => {
    const { categories, visibleTotal, usdCount } = buildGastosBreakdown(
      [],
      "todos",
      NONE,
    );
    expect(categories).toEqual([]);
    expect(visibleTotal).toBe(0);
    expect(usdCount).toBe(0);
  });
});
