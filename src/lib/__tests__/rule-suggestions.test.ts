import { describe, it, expect } from "vitest";
import {
  computeSuggestions,
  isManualByInference,
  type SuggestionTransaction,
  type DismissedSuggestion,
} from "../rule-suggestions";
import type { Rule } from "../rules";

const OTRO = 99;

const tx = (
  description: string,
  categoryId: number,
  manuallySet = true
): SuggestionTransaction => ({ description, categoryId, manuallySet });

const rule = (id: number, match: string, categoryId: number): Rule => ({
  id,
  match,
  categoryId,
});

describe("computeSuggestions", () => {
  it("produces no suggestion from a single one-off categorization (N=1)", () => {
    const txs = [tx("MARIA COOKS SPA VALPARAISO", 10)];
    const { suggestions } = computeSuggestions(txs, [], [], OTRO);
    expect(suggestions).toEqual([]);
  });

  it("suggests a rule when two transactions share a merchant token (N>=2)", () => {
    const txs = [
      tx("MARIA COOKS SPA VALPARAISO", 10),
      tx("MARIA COOKS LTDA", 10),
    ];
    const { suggestions } = computeSuggestions(txs, [], [], OTRO);
    expect(suggestions).toEqual([
      { match: "MARIA COOKS", categoryId: 10, count: 2 },
    ]);
  });

  it("strips trailing numeric/punctuation noise from the guessed match", () => {
    const txs = [
      tx("Haulmer*vmv servici tasa int. 0,00%", 20),
      tx("Haulmer*vmv pago mensual", 20),
    ];
    const { suggestions } = computeSuggestions(txs, [], [], OTRO);
    expect(suggestions).toEqual([
      { match: "Haulmer*vmv", categoryId: 20, count: 2 },
    ]);
  });

  it("rejects a too-short candidate (e.g. a bare 'SPA')", () => {
    const txs = [
      tx("X SPA 1", 10),
      tx("Y SPA 2", 10),
    ];
    // Longest common substring is " SPA " → cleaned "SPA" (3 chars) → rejected.
    const { suggestions } = computeSuggestions(txs, [], [], OTRO);
    expect(suggestions).toEqual([]);
  });

  it("rejects a pure numeric/punctuation candidate", () => {
    const txs = [
      tx("AB 0,00% CD", 10),
      tx("EF 0,00% GH", 10),
    ];
    // Shared substring " 0,00% " cleans to "" → rejected (no alpha token).
    const { suggestions } = computeSuggestions(txs, [], [], OTRO);
    expect(suggestions).toEqual([]);
  });

  it("excludes manual categorizations to 'Otro' as evidence", () => {
    const txs = [
      tx("MARIA COOKS SPA VALPARAISO", OTRO),
      tx("MARIA COOKS LTDA", OTRO),
    ];
    const { suggestions } = computeSuggestions(txs, [], [], OTRO);
    expect(suggestions).toEqual([]);
  });

  it("ignores non-manual transactions as evidence", () => {
    const txs = [
      tx("MARIA COOKS SPA VALPARAISO", 10, false),
      tx("MARIA COOKS LTDA", 10, false),
    ];
    const { suggestions } = computeSuggestions(txs, [], [], OTRO);
    expect(suggestions).toEqual([]);
  });

  it("drops a candidate already covered by an existing rule", () => {
    const txs = [
      tx("COMPRA JUMBO MAIPU", 10),
      tx("COMPRA JUMBO ÑUÑOA", 10),
    ];
    const rules = [rule(1, "JUMBO", 10)];
    const { suggestions } = computeSuggestions(txs, rules, [], OTRO);
    expect(suggestions).toEqual([]);
  });

  it("drops an ambiguous merchant spanning >=2 non-'Otro' categories", () => {
    const txs = [
      tx("MERCADOLIBRE*ABC", 30),
      tx("MERCADOLIBRE*DEF", 30),
      tx("MERCADOLIBRE*GHI", 40), // same merchant, different category
    ];
    const { suggestions, ambiguous } = computeSuggestions(txs, [], [], OTRO);
    expect(suggestions).toEqual([]);
    expect(ambiguous).toEqual([{ match: "MERCADOLIBRE" }]);
  });

  it("does not let an 'Otro' transaction trigger the ambiguity drop", () => {
    const txs = [
      tx("MARIA COOKS SPA VALPARAISO", 10),
      tx("MARIA COOKS LTDA", 10),
      tx("MARIA COOKS TO-DO", OTRO), // not-yet-categorized; must not count
    ];
    const { suggestions } = computeSuggestions(txs, [], [], OTRO);
    expect(suggestions).toEqual([
      { match: "MARIA COOKS", categoryId: 10, count: 2 },
    ]);
  });

  it("drops a dismissed candidate and keeps a non-dismissed one with its count", () => {
    const txs = [
      tx("MARIA COOKS SPA VALPARAISO", 10),
      tx("MARIA COOKS LTDA", 10),
      tx("MARIA COOKS CENTRO", 10),
      tx("Haulmer*vmv servici tasa int. 0,00%", 20),
      tx("Haulmer*vmv pago mensual", 20),
    ];
    const dismissals: DismissedSuggestion[] = [
      { match: "MARIA COOKS", categoryId: 10 },
    ];
    const { suggestions } = computeSuggestions(txs, [], dismissals, OTRO);
    expect(suggestions).toEqual([
      { match: "Haulmer*vmv", categoryId: 20, count: 2 },
    ]);
  });
});

describe("isManualByInference", () => {
  const rules = [rule(1, "JUMBO", 10)];

  it("flags a non-'Otro' transaction that matches no rule", () => {
    expect(isManualByInference("MARIA COOKS LTDA", 10, rules, OTRO)).toBe(true);
  });

  it("does not flag a transaction whose description matches a rule", () => {
    expect(isManualByInference("COMPRA JUMBO MAIPU", 10, rules, OTRO)).toBe(false);
  });

  it("does not flag a transaction sitting in 'Otro'", () => {
    expect(isManualByInference("MARIA COOKS LTDA", OTRO, rules, OTRO)).toBe(false);
  });
});
