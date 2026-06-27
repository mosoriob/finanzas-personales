import { describe, it, expect } from "vitest";
import { matchCategory, type Rule } from "../rules";

const rule = (id: number, match: string, categoryId: number): Rule => ({
  id,
  match,
  categoryId,
});

describe("matchCategory", () => {
  it("matches case-insensitively", () => {
    const rules = [rule(1, "Jumbo", 10)];
    expect(matchCategory("COMPRA JUMBO MAIPU", rules)).toBe(10);
    expect(matchCategory("compra jumbo maipu", rules)).toBe(10);
  });

  it("matches when the description contains the match text (substring)", () => {
    const rules = [rule(1, "uber", 20)];
    expect(matchCategory("MERPAGO*UBER TRIP", rules)).toBe(20);
  });

  it("lets the longest matching rule win", () => {
    const rules = [
      rule(1, "JUMBO", 10),
      rule(2, "MERCADO LIBRE", 30),
    ];
    // Description contains both "JUMBO" and "MERCADO LIBRE" substrings.
    expect(matchCategory("PAGO MERCADO LIBRE Y JUMBO", rules)).toBe(30);
  });

  it("breaks ties on equal length by lowest id", () => {
    const rules = [
      rule(5, "abcde", 50),
      rule(2, "vwxyz", 20),
    ];
    expect(matchCategory("xx abcde vwxyz xx", rules)).toBe(20);
  });

  it("returns null when nothing matches", () => {
    const rules = [rule(1, "jumbo", 10)];
    expect(matchCategory("PAGO DESCONOCIDO", rules)).toBeNull();
  });

  it("returns null for an empty rule set", () => {
    expect(matchCategory("anything", [])).toBeNull();
  });

  it("ignores rules whose match is empty after trim", () => {
    const rules = [rule(1, "   ", 99)];
    expect(matchCategory("anything", rules)).toBeNull();
  });
});
