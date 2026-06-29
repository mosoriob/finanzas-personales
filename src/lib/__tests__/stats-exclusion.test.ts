import { describe, it, expect } from "vitest";
import { countsInStats } from "@/lib/stats-exclusion";

describe("countsInStats", () => {
  it("counts a transaction whose category is not excluded", () => {
    expect(countsInStats({ category: { excluded: false } })).toBe(true);
  });

  it("drops a transaction whose category is excluded", () => {
    expect(countsInStats({ category: { excluded: true } })).toBe(false);
  });
});
