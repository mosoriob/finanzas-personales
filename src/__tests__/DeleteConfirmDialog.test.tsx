/**
 * Tests for DeleteConfirmDialog component.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DeleteConfirmDialog } from '@/components/DeleteConfirmDialog';

const defaultProps = {
  description: 'Supermercado Líder',
  amount: -45230,
  onConfirm: vi.fn(),
  onCancel: vi.fn(),
};

describe('DeleteConfirmDialog', () => {
  it('renders the transaction description', () => {
    render(<DeleteConfirmDialog {...defaultProps} />);
    // Description is inside a <p> with quote entities — search within the panel
    const panel = screen.getByTestId('dialog-panel');
    expect(panel.textContent).toContain('Supermercado Líder');
  });

  it('renders the formatted amount', () => {
    render(<DeleteConfirmDialog {...defaultProps} />);
    // formatCLP(-45230) => "-$45.230"
    expect(screen.getByText(/-\$45\.?230/)).toBeInTheDocument();
  });

  it('renders a USD amount with the dollar sign, not pesos', () => {
    const panel = render(
      <DeleteConfirmDialog {...defaultProps} amount={-119} currency="USD" />,
    ).getByTestId('dialog-panel');
    // formatMoney(-119, "USD") => "-US$119" — confirming deletion of the right charge.
    expect(panel.textContent).toContain('-US$119');
  });

  it('renders Eliminar and Cancelar buttons', () => {
    render(<DeleteConfirmDialog {...defaultProps} />);
    expect(screen.getByRole('button', { name: /eliminar/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancelar/i })).toBeInTheDocument();
  });

  it('shows the confirmation title in Spanish', () => {
    render(<DeleteConfirmDialog {...defaultProps} />);
    expect(screen.getByText(/eliminar transacción/i)).toBeInTheDocument();
  });

  it('shows the irreversibility warning in Spanish', () => {
    render(<DeleteConfirmDialog {...defaultProps} />);
    expect(screen.getByText(/no se puede deshacer/i)).toBeInTheDocument();
  });

  it('calls onConfirm when Eliminar is clicked', async () => {
    const onConfirm = vi.fn();
    render(<DeleteConfirmDialog {...defaultProps} onConfirm={onConfirm} />);
    await userEvent.click(screen.getByRole('button', { name: /eliminar/i }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('calls onCancel when Cancelar is clicked', async () => {
    const onCancel = vi.fn();
    render(<DeleteConfirmDialog {...defaultProps} onCancel={onCancel} />);
    await userEvent.click(screen.getByRole('button', { name: /cancelar/i }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('calls onCancel when Escape key is pressed', async () => {
    const onCancel = vi.fn();
    render(<DeleteConfirmDialog {...defaultProps} onCancel={onCancel} />);
    await userEvent.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('calls onCancel when backdrop (outside dialog) is clicked', async () => {
    const onCancel = vi.fn();
    render(<DeleteConfirmDialog {...defaultProps} onCancel={onCancel} />);
    // The backdrop is the outer overlay element
    const backdrop = screen.getByTestId('dialog-backdrop');
    fireEvent.click(backdrop);
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('does not call onCancel when the dialog panel itself is clicked', async () => {
    const onCancel = vi.fn();
    render(<DeleteConfirmDialog {...defaultProps} onCancel={onCancel} />);
    const panel = screen.getByTestId('dialog-panel');
    fireEvent.click(panel);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('Eliminar button has red styling', () => {
    render(<DeleteConfirmDialog {...defaultProps} />);
    const eliminarBtn = screen.getByRole('button', { name: /eliminar/i });
    expect(eliminarBtn.className).toMatch(/red/);
  });
});
