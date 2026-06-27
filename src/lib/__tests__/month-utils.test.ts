import { describe, it, expect } from 'vitest';
import {
  parseMesParam,
  getDateFilterForMonth,
  formatMonthLabel,
  navigateMonth,
  buildMonthUrl,
  totalPages,
  parsePageParam,
} from '@/lib/month-utils';

describe('parseMesParam', () => {
  it('returns current month DateInfo when param is undefined', () => {
    const result = parseMesParam(undefined);
    const now = new Date();
    expect(result.type).toBe('month');
    if (result.type === 'month') {
      expect(result.year).toBe(now.getFullYear());
      expect(result.month).toBe(now.getMonth() + 1);
    }
  });

  it('returns all DateInfo when param is "todo"', () => {
    const result = parseMesParam('todo');
    expect(result.type).toBe('all');
  });

  it('parses a valid YYYY-MM param', () => {
    const result = parseMesParam('2026-05');
    expect(result.type).toBe('month');
    if (result.type === 'month') {
      expect(result.year).toBe(2026);
      expect(result.month).toBe(5);
    }
  });

  it('parses January correctly (month 01)', () => {
    const result = parseMesParam('2025-01');
    expect(result.type).toBe('month');
    if (result.type === 'month') {
      expect(result.year).toBe(2025);
      expect(result.month).toBe(1);
    }
  });

  it('parses December correctly (month 12)', () => {
    const result = parseMesParam('2024-12');
    expect(result.type).toBe('month');
    if (result.type === 'month') {
      expect(result.year).toBe(2024);
      expect(result.month).toBe(12);
    }
  });
});

describe('getDateFilterForMonth', () => {
  it('returns undefined for all type', () => {
    const result = getDateFilterForMonth({ type: 'all' });
    expect(result).toBeUndefined();
  });

  it('returns correct gte and lt for May 2026', () => {
    const result = getDateFilterForMonth({ type: 'month', year: 2026, month: 5 });
    expect(result).toBeDefined();
    expect(result!.gte).toEqual(new Date(2026, 4, 1)); // month is 0-indexed in Date
    expect(result!.lt).toEqual(new Date(2026, 5, 1));
  });

  it('returns correct range for January (wraps correctly)', () => {
    const result = getDateFilterForMonth({ type: 'month', year: 2026, month: 1 });
    expect(result).toBeDefined();
    expect(result!.gte).toEqual(new Date(2026, 0, 1));
    expect(result!.lt).toEqual(new Date(2026, 1, 1));
  });

  it('returns correct range for December (lt crosses into next year)', () => {
    const result = getDateFilterForMonth({ type: 'month', year: 2025, month: 12 });
    expect(result).toBeDefined();
    expect(result!.gte).toEqual(new Date(2025, 11, 1));
    expect(result!.lt).toEqual(new Date(2026, 0, 1));
  });
});

describe('formatMonthLabel', () => {
  it('formats month names in Spanish', () => {
    expect(formatMonthLabel(2026, 1)).toBe('Enero 2026');
    expect(formatMonthLabel(2026, 2)).toBe('Febrero 2026');
    expect(formatMonthLabel(2026, 3)).toBe('Marzo 2026');
    expect(formatMonthLabel(2026, 4)).toBe('Abril 2026');
    expect(formatMonthLabel(2026, 5)).toBe('Mayo 2026');
    expect(formatMonthLabel(2026, 6)).toBe('Junio 2026');
    expect(formatMonthLabel(2026, 7)).toBe('Julio 2026');
    expect(formatMonthLabel(2026, 8)).toBe('Agosto 2026');
    expect(formatMonthLabel(2026, 9)).toBe('Septiembre 2026');
    expect(formatMonthLabel(2026, 10)).toBe('Octubre 2026');
    expect(formatMonthLabel(2026, 11)).toBe('Noviembre 2026');
    expect(formatMonthLabel(2026, 12)).toBe('Diciembre 2026');
  });
});

describe('navigateMonth', () => {
  it('goes to previous month within same year', () => {
    const result = navigateMonth(2026, 5, 'prev');
    expect(result).toEqual({ year: 2026, month: 4 });
  });

  it('goes to next month within same year', () => {
    const result = navigateMonth(2026, 5, 'next');
    expect(result).toEqual({ year: 2026, month: 6 });
  });

  it('wraps from January to December of previous year', () => {
    const result = navigateMonth(2026, 1, 'prev');
    expect(result).toEqual({ year: 2025, month: 12 });
  });

  it('wraps from December to January of next year', () => {
    const result = navigateMonth(2025, 12, 'next');
    expect(result).toEqual({ year: 2026, month: 1 });
  });
});

describe('buildMonthUrl', () => {
  it('builds URL with mes and resets pagina to 1', () => {
    expect(buildMonthUrl(2026, 5)).toBe('?mes=2026-05');
  });

  it('zero-pads single-digit months', () => {
    expect(buildMonthUrl(2026, 1)).toBe('?mes=2026-01');
    expect(buildMonthUrl(2026, 9)).toBe('?mes=2026-09');
  });

  it('does not pad two-digit months', () => {
    expect(buildMonthUrl(2026, 10)).toBe('?mes=2026-10');
    expect(buildMonthUrl(2026, 12)).toBe('?mes=2026-12');
  });

  it('builds todo URL', () => {
    expect(buildMonthUrl('todo')).toBe('?mes=todo');
  });
});

describe('totalPages', () => {
  it('returns 1 when count is 0', () => {
    expect(totalPages(0, 50)).toBe(1);
  });

  it('returns 1 when count equals page size', () => {
    expect(totalPages(50, 50)).toBe(1);
  });

  it('returns 2 when count is 51', () => {
    expect(totalPages(51, 50)).toBe(2);
  });

  it('returns 3 when count is 127', () => {
    expect(totalPages(127, 50)).toBe(3);
  });

  it('returns 3 when count is exactly 150', () => {
    expect(totalPages(150, 50)).toBe(3);
  });

  it('returns 4 when count is 151', () => {
    expect(totalPages(151, 50)).toBe(4);
  });
});

describe('parsePageParam', () => {
  it('returns 1 when undefined', () => {
    expect(parsePageParam(undefined)).toBe(1);
  });

  it('returns 1 when "1"', () => {
    expect(parsePageParam('1')).toBe(1);
  });

  it('parses "2" as 2', () => {
    expect(parsePageParam('2')).toBe(2);
  });

  it('clamps NaN to 1', () => {
    expect(parsePageParam('abc')).toBe(1);
  });

  it('clamps 0 to 1', () => {
    expect(parsePageParam('0')).toBe(1);
  });

  it('clamps negative to 1', () => {
    expect(parsePageParam('-1')).toBe(1);
  });
});
