import { describe, it, expect } from "vitest";
import {
  matchesHouseholdFilter,
  householdFilterLabel,
  HOUSEHOLD_FILTER_OPTIONS,
  type HouseholdFilter,
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
});

describe("HOUSEHOLD_FILTER_OPTIONS", () => {
  it("offers exactly four options: Todos, Viña, Melipilla, Personal", () => {
    expect(HOUSEHOLD_FILTER_OPTIONS.map((o) => o.value)).toEqual([
      "todos",
      "VINA",
      "MELIPILLA",
      "PERSONAL",
    ]);
  });
});

describe("householdFilterLabel", () => {
  it("returns the household label for active selections", () => {
    expect(householdFilterLabel("VINA" as HouseholdFilter)).toBe("🏠 Viña");
    expect(householdFilterLabel("MELIPILLA" as HouseholdFilter)).toBe(
      "👴 Melipilla",
    );
    expect(householdFilterLabel("PERSONAL" as HouseholdFilter)).toBe("Personal");
  });
});
