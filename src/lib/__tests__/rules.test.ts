import { describe, it, expect } from 'vitest';
import { matchCategory, type MatchableRule } from '@/lib/rules';

const rule = (id: number, match: string, categoryId: number): MatchableRule => ({
  id,
  match,
  categoryId,
});

describe('matchCategory', () => {
  it('matches case-insensitively', () => {
    const rules = [rule(1, 'netflix', 10)];
    expect(matchCategory('PAGO NETFLIX.COM', rules)).toBe(10);
    expect(matchCategory('netflix', rules)).toBe(10);
    expect(matchCategory('NeTfLiX', rules)).toBe(10);
  });

  it('matches when the description contains the rule text (substring)', () => {
    const rules = [rule(1, 'jumbo', 5)];
    expect(matchCategory('COMPRA JUMBO KENNEDY 1234', rules)).toBe(5);
  });

  it('lets the longest match win when multiple rules match', () => {
    const rules = [
      rule(1, 'jumbo', 5),
      rule(2, 'mercado libre', 7),
      rule(3, 'mercado', 9),
    ];
    expect(matchCategory('COMPRA MERCADO LIBRE JUMBO', rules)).toBe(7);
  });

  it('breaks ties on equal length by lowest id', () => {
    // Two rules with equal-length match texts both hit the description;
    // the lower id (2) must win deterministically.
    const equalLen = [rule(5, 'aaaa', 50), rule(2, 'bbbb', 20)];
    expect(matchCategory('xx aaaa bbbb yy', equalLen)).toBe(20);
  });

  it('returns null when no rule matches', () => {
    const rules = [rule(1, 'netflix', 10)];
    expect(matchCategory('SUPERMERCADO DESCONOCIDO', rules)).toBeNull();
  });

  it('returns null for an empty rule set', () => {
    expect(matchCategory('anything at all', [])).toBeNull();
  });
});
