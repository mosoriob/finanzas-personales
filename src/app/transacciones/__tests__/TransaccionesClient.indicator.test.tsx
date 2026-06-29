/**
 * Behavioral coverage for the USD integrity indicator on the transactions
 * screen (issue #44, parent PRD #37).
 *
 * The peso totals exclude USD rows so they never silently undercount. This
 * screen must therefore show one honest indicator — "N cargo(s) en US$ no
 * incluido(s) en los totales" — alongside the summary, conditional on the
 * currently-filtered set actually containing one or more USD rows. The
 * summarize/label logic is unit-tested separately; these tests guard the
 * render site itself (the conditional, the count and the wording a user sees).
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TransaccionesClient } from '../TransaccionesClient';

// The component and its MonthPicker child call useRouter; the row actions are
// server actions. Neither is exercised by these render-only assertions.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock('../actions', () => ({
  updateTransactionCategory: vi.fn(),
  updateFamiliar: vi.fn(),
  updateTransactionNote: vi.fn(),
  deleteTransaction: vi.fn(),
}));

const account = { id: 1, name: 'BCI Crédito' };
const category = { id: 1, name: 'Servicios', emoji: '📱', excluded: false };

function tx(over: Partial<{ id: number; amount: number; currency: string | null }>) {
  return {
    id: over.id ?? 1,
    date: '2026-06-15T00:00:00.000Z',
    description: 'Cargo',
    note: null,
    amount: over.amount ?? -45230,
    currency: over.currency ?? null,
    familiar: null,
    isReimbursed: false,
    account,
    category,
  };
}

function renderClient(transactions: ReturnType<typeof tx>[]) {
  return render(
    <TransaccionesClient
      transactions={transactions}
      accounts={[account]}
      categories={[category]}
      mes="2026-06"
    />,
  );
}

describe('TransaccionesClient USD integrity indicator', () => {
  it('shows the indicator with the singular count when one USD row is present', () => {
    renderClient([
      tx({ id: 1, amount: -45230, currency: null }),
      tx({ id: 2, amount: -119, currency: 'USD' }),
    ]);
    expect(
      screen.getByText('1 cargo en US$ no incluido en los totales'),
    ).toBeInTheDocument();
  });

  it('pluralizes the count when several USD rows are present', () => {
    renderClient([
      tx({ id: 1, amount: -45230, currency: null }),
      tx({ id: 2, amount: -119, currency: 'USD' }),
      tx({ id: 3, amount: -50, currency: 'USD' }),
      tx({ id: 4, amount: -12, currency: 'USD' }),
    ]);
    expect(
      screen.getByText('3 cargos en US$ no incluidos en los totales'),
    ).toBeInTheDocument();
  });

  it('hides the indicator entirely when the filtered set is all pesos', () => {
    renderClient([
      tx({ id: 1, amount: -45230, currency: null }),
      tx({ id: 2, amount: 1000, currency: null }),
    ]);
    expect(screen.queryByText(/no incluido/)).not.toBeInTheDocument();
  });

  it('still renders the USD row in the list while excluding it from totals', () => {
    renderClient([tx({ id: 1, amount: -119, currency: 'USD' })]);
    // Excluded from totals, but the charge itself stays visible. The card
    // renders the amount in both its mobile and desktop layouts, so the
    // string appears more than once.
    expect(screen.getAllByText('-US$119').length).toBeGreaterThan(0);
    expect(
      screen.getByText('1 cargo en US$ no incluido en los totales'),
    ).toBeInTheDocument();
  });
});
