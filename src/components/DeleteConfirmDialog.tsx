'use client';

import { useEffect } from 'react';
import { formatMoney } from '@/lib/currency';

interface DeleteConfirmDialogProps {
  description: string;
  amount: number;
  currency?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteConfirmDialog({
  description,
  amount,
  currency,
  onConfirm,
  onCancel,
}: DeleteConfirmDialogProps) {
  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onCancel();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  return (
    <div
      data-testid="dialog-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        data-testid="dialog-panel"
        className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-gray-800">
          ¿Eliminar transacción?
        </h2>

        <p className="text-sm text-gray-600">
          &ldquo;{description}&rdquo; &mdash; {formatMoney(amount, currency)}
        </p>

        <p className="text-xs text-gray-400">
          Esta acción no se puede deshacer.
        </p>

        <div className="flex justify-end gap-3 pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full px-4 py-2 text-sm font-medium text-gray-500 border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-full px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 transition-colors"
          >
            Eliminar
          </button>
        </div>
      </div>
    </div>
  );
}
