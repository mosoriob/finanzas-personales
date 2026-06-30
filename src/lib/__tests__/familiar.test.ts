import { describe, it, expect } from "vitest";
import {
  matchesHouseholdFilter,
  householdFilterLabel,
  HOUSEHOLD_FILTER_OPTIONS,
  householdPendingTotals,
} from "../familiar";

describe("matchesHouseholdFilter", () => {
  it("'todos' matches every household", () => {
    expect(matchesHouseholdFilter(null, "todos")).toBe(true);
    expect(matchesHouseholdFilter("VINA", "todos")).toBe(true);
    expect(matchesHouseholdFilter("MELIPILLA", "todos")).toBe(true);
  });

  it("'PERSONAL' matches only rows with no household", () => {
    expect(matchesHouseholdFilter(null, "PERSONAL")).toBe(true);
    expect(matchesHouseholdFilter("VINA", "PERSONAL")).toBe(false);
    expect(matchesHouseholdFilter("MELIPILLA", "PERSONAL")).toBe(false);
  });

  it("'VINA' matches only Viña rows", () => {
    expect(matchesHouseholdFilter("VINA", "VINA")).toBe(true);
    expect(matchesHouseholdFilter(null, "VINA")).toBe(false);
    expect(matchesHouseholdFilter("MELIPILLA", "VINA")).toBe(false);
  });

  it("'MELIPILLA' matches only Melipilla rows", () => {
    expect(matchesHouseholdFilter("MELIPILLA", "MELIPILLA")).toBe(true);
    expect(matchesHouseholdFilter(null, "MELIPILLA")).toBe(false);
    expect(matchesHouseholdFilter("VINA", "MELIPILLA")).toBe(false);
  });

  it("'ANDESPATH' matches only AndesPath rows", () => {
    expect(matchesHouseholdFilter("ANDESPATH", "ANDESPATH")).toBe(true);
    expect(matchesHouseholdFilter(null, "ANDESPATH")).toBe(false);
    expect(matchesHouseholdFilter("VINA", "ANDESPATH")).toBe(false);
  });
});

describe("HOUSEHOLD_FILTER_OPTIONS", () => {
  it("offers exactly five options: Todos, Viña, Melipilla, AndesPath, Personal", () => {
    expect(HOUSEHOLD_FILTER_OPTIONS.map((o) => o.value)).toEqual([
      "todos",
      "VINA",
      "MELIPILLA",
      "ANDESPATH",
      "PERSONAL",
    ]);
  });
});

describe("householdPendingTotals", () => {
  it("sums unreimbursed expenses per household, ignoring Personal", () => {
    const totals = householdPendingTotals([
      { familiar: "VINA", isReimbursed: false, amount: -1000 },
      { familiar: "VINA", isReimbursed: false, amount: -500 },
      { familiar: "MELIPILLA", isReimbursed: false, amount: -2000 },
      { familiar: "ANDESPATH", isReimbursed: false, amount: -750 },
      { familiar: null, isReimbursed: false, amount: -9999 },
    ]);
    expect(totals).toEqual({ VINA: 1500, MELIPILLA: 2000, ANDESPATH: 750 });
  });

  it("excludes reimbursed rows and income (non-negative amounts)", () => {
    const totals = householdPendingTotals([
      { familiar: "VINA", isReimbursed: true, amount: -1000 },
      { familiar: "VINA", isReimbursed: false, amount: 800 },
      { familiar: "MELIPILLA", isReimbursed: false, amount: 0 },
      { familiar: "MELIPILLA", isReimbursed: false, amount: -300 },
    ]);
    expect(totals).toEqual({ VINA: 0, MELIPILLA: 300, ANDESPATH: 0 });
  });

  it("returns zeros for an empty set", () => {
    expect(householdPendingTotals([])).toEqual({
      VINA: 0,
      MELIPILLA: 0,
      ANDESPATH: 0,
    });
  });
});

describe("householdFilterLabel", () => {
  it("returns the household label for active selections", () => {
    expect(householdFilterLabel("VINA")).toBe("🏠 Viña");
    expect(householdFilterLabel("MELIPILLA")).toBe("👴 Melipilla");
    expect(householdFilterLabel("ANDESPATH")).toBe("💼 AndesPath");
    expect(householdFilterLabel("PERSONAL")).toBe("Personal");
  });
});
