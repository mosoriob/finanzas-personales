/**
 * Tests for the EmojiPicker component.
 */

import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EmojiPicker } from '@/components/EmojiPicker';

/** Controlled harness mirroring real usage, so typed input accumulates. */
function ControlledPicker({ initial = '' }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <EmojiPicker value={value} onChange={setValue} />
      <span data-testid="value">{value}</span>
    </>
  );
}

describe('EmojiPicker', () => {
  it('shows the current value on the trigger button', () => {
    render(<EmojiPicker value="🍔" onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: /elegir emoji/i })).toHaveTextContent('🍔');
  });

  it('falls back to 📌 when there is no value', () => {
    render(<EmojiPicker value="" onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: /elegir emoji/i })).toHaveTextContent('📌');
  });

  it('opens the picker popover when the trigger is clicked', async () => {
    render(<EmojiPicker value="" onChange={vi.fn()} />);
    expect(screen.queryByTestId('emoji-popover')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /elegir emoji/i }));
    expect(screen.getByTestId('emoji-popover')).toBeInTheDocument();
  });

  it('calls onChange and closes the popover when an emoji is selected', async () => {
    const onChange = vi.fn();
    render(<EmojiPicker value="" onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: /elegir emoji/i }));
    await userEvent.click(screen.getByRole('button', { name: '🛒' }));
    expect(onChange).toHaveBeenCalledWith('🛒');
    expect(screen.queryByTestId('emoji-popover')).not.toBeInTheDocument();
  });

  it('lets the user type a custom emoji', async () => {
    render(<ControlledPicker />);
    await userEvent.click(screen.getByRole('button', { name: /elegir emoji/i }));
    await userEvent.type(screen.getByLabelText(/emoji personalizado/i), '🦄');
    expect(screen.getByTestId('value')).toHaveTextContent('🦄');
  });

  it('renders a hidden input carrying the value when a name is given', () => {
    const { container } = render(<EmojiPicker value="🏦" name="emoji" onChange={vi.fn()} />);
    const hidden = container.querySelector('input[type="hidden"][name="emoji"]');
    expect(hidden).toHaveValue('🏦');
  });

  it('closes the popover on Escape', async () => {
    render(<EmojiPicker value="" onChange={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /elegir emoji/i }));
    expect(screen.getByTestId('emoji-popover')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByTestId('emoji-popover')).not.toBeInTheDocument();
  });
});
