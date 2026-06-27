/**
 * Tests for deleteTransaction server action.
 * Uses a mocked prisma client and revalidatePath.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock next/cache
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

// Mock prisma
vi.mock('@/lib/db', () => ({
  prisma: {
    transaction: {
      delete: vi.fn(),
    },
  },
}));

import { deleteTransaction } from '@/app/transacciones/actions';
import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';

const mockDelete = prisma.transaction.delete as ReturnType<typeof vi.fn>;
const mockRevalidate = revalidatePath as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('deleteTransaction', () => {
  it('returns ok:true and revalidates paths on successful deletion', async () => {
    mockDelete.mockResolvedValueOnce({ id: 42 });

    const result = await deleteTransaction(42);

    expect(result).toEqual({ ok: true });
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: 42 } });
    expect(mockRevalidate).toHaveBeenCalledWith('/transacciones');
    expect(mockRevalidate).toHaveBeenCalledWith('/');
  });

  it('returns ok:false with Spanish error message when prisma throws', async () => {
    mockDelete.mockRejectedValueOnce(new Error('Record not found'));

    const result = await deleteTransaction(99);

    expect(result).toEqual({
      ok: false,
      error: 'No se pudo eliminar la transacción',
    });
    expect(mockRevalidate).not.toHaveBeenCalled();
  });

  it('calls prisma.transaction.delete with the correct id', async () => {
    mockDelete.mockResolvedValueOnce({ id: 7 });

    await deleteTransaction(7);

    expect(mockDelete).toHaveBeenCalledOnce();
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: 7 } });
  });
});
