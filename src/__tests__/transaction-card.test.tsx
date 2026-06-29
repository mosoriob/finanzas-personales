/**
 * Tests for TransactionCard — the individual-transaction render site used across
 * the dashboard, transactions list and per-account list. Guards the USD display
 * threading for issue #42: a USD charge must show as "-US$119" (not "-$119") and
 * must still appear in the list (excluded only from totals, handled separately).
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TransactionCard } from '@/components/transaction-card';

const baseTx = {
  id: 1,
  date: '2026-06-15T00:00:00.000Z',
  description: 'Anthropic Claude',
  note: null,
  amount: -45230,
  currency: null as string | null,
  familiar: null,
  isReimbursed: false,
  account: { id: 1, name: 'BCI Crédito' },
  category: { id: 1, name: 'Servicios', emoji: '📱' },
};

describe('TransactionCard', () => {
  it('renders a peso amount with the peso formatter', () => {
    render(<TransactionCard transaction={baseTx} />);
    // formatMoney(-45230, null) delegates to formatCLP => "-$45.230"
    expect(screen.getByText(/-\$45\.?230/)).toBeInTheDocument();
  });

  it('renders a USD charge as dollars, not pesos', () => {
    render(
      <TransactionCard transaction={{ ...baseTx, amount: -119, currency: 'USD' }} />,
    );
    // formatMoney(-119, "USD") => "-US$119" — honest dollar sign, sign inside the string.
    expect(screen.getByText('-US$119')).toBeInTheDocument();
  });

  it('still shows the USD charge in the list (description visible)', () => {
    render(
      <TransactionCard transaction={{ ...baseTx, amount: -119, currency: 'USD' }} />,
    );
    // Excluded only from totals — the row itself must remain visible.
    expect(screen.getByText('Anthropic Claude')).toBeInTheDocument();
  });
});
