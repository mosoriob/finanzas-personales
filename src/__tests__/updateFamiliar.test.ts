/**
 * Tests for the updateFamiliar server action.
 *
 * Mirrors src/__tests__/deleteTransaction.test.ts: prisma + next/cache are
 * mocked; we assert on the payload written to the database and that the
 * transactions path gets revalidated.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    transaction: {
      update: vi.fn(),
    },
  },
}));

import { updateFamiliar } from '@/app/transacciones/actions';
import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';

const mockUpdate = prisma.transaction.update as ReturnType<typeof vi.fn>;
const mockRevalidate = revalidatePath as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockUpdate.mockResolvedValue({ id: 1 });
});

describe('updateFamiliar', () => {
  it('persists VINA with isReimbursed=false', async () => {
    await updateFamiliar(1, 'VINA', false);
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { familiar: 'VINA', isReimbursed: false },
    });
  });

  it('persists MELIPILLA preserving isReimbursed=true', async () => {
    await updateFamiliar(7, 'MELIPILLA', true);
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { familiar: 'MELIPILLA', isReimbursed: true },
    });
  });

  it('forces isReimbursed=false when switching to Personal (null), even if true is passed', async () => {
    await updateFamiliar(3, null, true);
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 3 },
      data: { familiar: null, isReimbursed: false },
    });
  });

  it('revalidates /transacciones', async () => {
    await updateFamiliar(1, 'VINA', false);
    expect(mockRevalidate).toHaveBeenCalledWith('/transacciones');
  });
});
