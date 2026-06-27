/**
 * Tests for createTransaction server action.
 *
 * We mock the Prisma client and revalidatePath to avoid hitting a real DB.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock next/cache before importing the action
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

// Mock prisma — factory cannot reference outer variables (vi.mock is hoisted)
vi.mock('@/lib/db', () => ({
  prisma: {
    transaction: {
      create: vi.fn(),
    },
  },
}));

import { createTransaction } from '@/app/transacciones/actions';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';

// Cast so TypeScript knows these are mocks
const mockCreate = prisma.transaction.create as ReturnType<typeof vi.fn>;

const BASE_EXPENSE = {
  amount: 5000,
  type: 'expense' as const,
  description: 'Almuerzo',
  date: '2026-01-15',
  accountId: 1,
  categoryId: 2,
};

const BASE_INCOME = {
  amount: 100000,
  type: 'income' as const,
  description: 'Sueldo',
  date: '2026-01-01',
  accountId: 1,
  categoryId: 3,
};

function makeFakeTransaction(overrides: Record<string, unknown> = {}) {
  const now = new Date();
  return {
    id: 42,
    amount: -5000,
    description: 'Almuerzo',
    note: null,
    date: now,
    accountId: 1,
    categoryId: 2,
    isShared: false,
    isReimbursed: false,
    createdAt: now,
    ...overrides,
  };
}

describe('createTransaction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('stores expense as negative amount', async () => {
    const fake = makeFakeTransaction({ amount: -5000 });
    mockCreate.mockResolvedValue(fake);

    const result = await createTransaction(BASE_EXPENSE);

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ amount: -5000 }),
      }),
    );
    expect(result).toMatchObject({ ok: true });
    if (result.ok) {
      expect(result.transaction.amount).toBe(-5000);
    }
  });

  it('stores income as positive amount', async () => {
    const fake = makeFakeTransaction({ amount: 100000 });
    mockCreate.mockResolvedValue(fake);

    const result = await createTransaction(BASE_INCOME);

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ amount: 100000 }),
      }),
    );
    expect(result).toMatchObject({ ok: true });
    if (result.ok) {
      expect(result.transaction.amount).toBe(100000);
    }
  });

  it('trims whitespace from description', async () => {
    const fake = makeFakeTransaction({ description: 'Almuerzo' });
    mockCreate.mockResolvedValue(fake);

    await createTransaction({ ...BASE_EXPENSE, description: '  Almuerzo  ' });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ description: 'Almuerzo' }),
      }),
    );
  });

  it('stores optional note as null when empty', async () => {
    const fake = makeFakeTransaction({ note: null });
    mockCreate.mockResolvedValue(fake);

    await createTransaction({ ...BASE_EXPENSE, note: '   ' });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ note: null }),
      }),
    );
  });

  it('stores non-empty note trimmed', async () => {
    const fake = makeFakeTransaction({ note: 'Con descuento' });
    mockCreate.mockResolvedValue(fake);

    await createTransaction({ ...BASE_EXPENSE, note: '  Con descuento  ' });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ note: 'Con descuento' }),
      }),
    );
  });

  it('defaults isShared and isReimbursed to false', async () => {
    const fake = makeFakeTransaction({ isShared: false, isReimbursed: false });
    mockCreate.mockResolvedValue(fake);

    await createTransaction(BASE_EXPENSE);

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isShared: false, isReimbursed: false }),
      }),
    );
  });

  it('passes isShared and isReimbursed flags when provided', async () => {
    const fake = makeFakeTransaction({ isShared: true, isReimbursed: true });
    mockCreate.mockResolvedValue(fake);

    await createTransaction({
      ...BASE_EXPENSE,
      isShared: true,
      isReimbursed: true,
    });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isShared: true, isReimbursed: true }),
      }),
    );
  });

  it('calls revalidatePath for /transacciones and /', async () => {
    mockCreate.mockResolvedValue(makeFakeTransaction());

    await createTransaction(BASE_EXPENSE);

    expect(revalidatePath).toHaveBeenCalledWith('/transacciones');
    expect(revalidatePath).toHaveBeenCalledWith('/');
  });

  it('returns serialized date strings in result', async () => {
    const date = new Date('2026-01-15T00:00:00.000Z');
    const createdAt = new Date('2026-01-15T10:00:00.000Z');
    const fake = makeFakeTransaction({ date, createdAt });
    mockCreate.mockResolvedValue(fake);

    const result = await createTransaction(BASE_EXPENSE);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(typeof result.transaction.date).toBe('string');
      expect(typeof result.transaction.createdAt).toBe('string');
    }
  });

  it('force-negates positive amount for expense type', async () => {
    // Even if somehow a negative number is passed, expense should be negative
    const fake = makeFakeTransaction({ amount: -1000 });
    mockCreate.mockResolvedValue(fake);

    await createTransaction({ ...BASE_EXPENSE, amount: 1000 });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ amount: -1000 }),
      }),
    );
  });
});
