'use client';

import { useEffect, useRef, useState } from 'react';

// Curated set of emoji that suit personal-finance categories. The custom-text
// field inside the popover lets users enter anything not listed here.
const EMOJI_OPTIONS = [
  '🛒', '🍔', '☕', '🍷', '🍺', '🍎',
  '🏠', '💡', '💧', '🔥', '📱', '🌐',
  '🚗', '⛽', '🚌', '✈️', '🏨', '🚕',
  '🎬', '🎮', '🎵', '📚', '🎓', '⚽',
  '👕', '👟', '💄', '💊', '🏥', '💪',
  '🎁', '🐶', '👶', '🧸', '🔧', '📦',
  '💰', '💵', '💳', '🏦', '📈', '🧾',
  '☀️', '❤️', '⭐', '🎉', '🍽️', '📌',
];

interface EmojiPickerProps {
  value: string;
  onChange: (emoji: string) => void;
  /** When set, renders a hidden input so the value posts as part of a form. */
  name?: string;
  disabled?: boolean;
  /** Override the trigger button styling (size/border) for different layouts. */
  buttonClassName?: string;
}

export function EmojiPicker({
  value,
  onChange,
  name,
  disabled,
  buttonClassName,
}: EmojiPickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close the popover on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    function handlePointer(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  function select(emoji: string) {
    onChange(emoji);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      {name && <input type="hidden" name={name} value={value} />}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        aria-label="Elegir emoji"
        aria-expanded={open}
        className={
          buttonClassName ??
          'w-full border border-indigo-100 rounded-xl p-2.5 text-lg text-center hover:border-violet-400 focus:outline-none focus:border-violet-400 transition-colors disabled:opacity-60'
        }
      >
        {value || '📌'}
      </button>

      {open && (
        <div
          data-testid="emoji-popover"
          className="absolute left-0 top-full z-50 mt-2 w-60 bg-white rounded-xl border border-gray-100 shadow-xl p-3 flex flex-col gap-2"
        >
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Escribe un emoji"
            aria-label="Emoji personalizado"
            className="border border-indigo-100 rounded-lg p-2 text-sm text-center focus:outline-none focus:border-violet-400 transition-colors"
          />
          <div className="grid grid-cols-6 gap-1">
            {EMOJI_OPTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => select(emoji)}
                className={`text-xl rounded-lg p-1.5 hover:bg-indigo-50 transition-colors ${
                  value === emoji ? 'bg-indigo-100' : ''
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
