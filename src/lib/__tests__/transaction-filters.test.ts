import { describe, it, expect } from "vitest";
import {
  filterTransactions,
  filterAndPaginate,
  type FilterableTransaction,
} from "../transaction-filters";

const ALL_FILTERS = {
  search: "",
  accountFilter: "todas",
  categoryFilter: "todas",
  householdFilter: "todos" as const,
};

function tx(overrides: Partial<FilterableTransaction>): FilterableTransaction {
  return {
    description: "compra",
    note: null,
    familiar: null,
    account: { name: "bci" },
    category: { name: "Otro" },
    ...overrides,
  };
}

// Alimento rows scattered across the dataset so the page boundary splits them.
// Indexes 1,3,5,7,9 are Alimento (5 of them), the rest are Otro.
const SCATTERED = Array.from({ length: 10 }, (_, i) =>
  tx({
    description: `row-${i}`,
    category: { name: i % 2 === 1 ? "Alimento" : "Otro" },
  }),
);

describe("filterTransactions", () => {
  it("filters by category name", () => {
    const result = filterTransactions(SCATTERED, {
      ...ALL_FILTERS,
      categoryFilter: "Alimento",
    });
    expect(result).toHaveLength(5);
    expect(result.every((t) => t.category.name === "Alimento")).toBe(true);
  });

  it("filters by account name", () => {
    const data = [tx({ account: { name: "bci" } }), tx({ account: { name: "santander" } })];
    expect(
      filterTransactions(data, { ...ALL_FILTERS, accountFilter: "santander" }),
    ).toHaveLength(1);
  });

  it("matches search across description, note and account", () => {
    const data = [
      tx({ description: "cafe johnson" }),
      tx({ description: "x", note: "almuerzo cafe" }),
      tx({ description: "x", account: { name: "cafe card" } }),
      tx({ description: "nada" }),
    ];
    expect(filterTransactions(data, { ...ALL_FILTERS, search: "cafe" })).toHaveLength(3);
  });

  it("filters by household", () => {
    const data = [tx({ familiar: "VINA" }), tx({ familiar: null }), tx({ familiar: "MELIPILLA" })];
    expect(
      filterTransactions(data, { ...ALL_FILTERS, householdFilter: "VINA" }),
    ).toHaveLength(1);
  });
});

describe("filterAndPaginate", () => {
  it("paginates the FILTERED set, not the raw set (the reported bug)", () => {
    const page1 = filterAndPaginate(
      SCATTERED,
      { ...ALL_FILTERS, categoryFilter: "Alimento" },
      1,
      2,
    );
    // Count reflects only matches, not the 10 raw rows.
    expect(page1.filteredCount).toBe(5);
    expect(page1.totalPages).toBe(3);
    // Page 1 is FULL with matching rows, not "whatever Alimento happened to
    // land in raw rows 0-1" (which the old client-side-slice bug produced).
    expect(page1.pageItems).toHaveLength(2);
    expect(page1.pageItems.every((t) => t.category.name === "Alimento")).toBe(true);
  });

  it("returns the remainder on the last page", () => {
    const lastPage = filterAndPaginate(
      SCATTERED,
      { ...ALL_FILTERS, categoryFilter: "Alimento" },
      3,
      2,
    );
    expect(lastPage.pageItems).toHaveLength(1);
  });

  it("clamps an out-of-range page to the last available page", () => {
    const result = filterAndPaginate(
      SCATTERED,
      { ...ALL_FILTERS, categoryFilter: "Alimento" },
      99,
      2,
    );
    expect(result.pageItems).toHaveLength(1);
  });

  it("yields one empty page when nothing matches", () => {
    const result = filterAndPaginate(
      SCATTERED,
      { ...ALL_FILTERS, categoryFilter: "Inexistente" },
      1,
      2,
    );
    expect(result.filteredCount).toBe(0);
    expect(result.totalPages).toBe(1);
    expect(result.pageItems).toHaveLength(0);
  });
});
