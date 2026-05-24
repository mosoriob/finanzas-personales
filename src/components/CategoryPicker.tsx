"use client";

import { useEffect, useRef } from "react";

type CategoryOption = { id: number; name: string; emoji: string };

interface CategoryPickerProps {
  currentCategoryId: number;
  categories: CategoryOption[];
  onSelect: (categoryId: number) => void;
  onClose: () => void;
}

export function CategoryPicker({
  currentCategoryId,
  categories,
  onSelect,
  onClose,
}: CategoryPickerProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      const target = e.target as Element | null;
      if (target && !target.closest("[data-category-picker]")) {
        onClose();
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      data-category-picker
      className="absolute left-0 top-full z-50 mt-1 w-[220px] max-h-[280px] overflow-y-auto rounded-xl border border-indigo-100 bg-white shadow-lg"
    >
      {categories.map((c) => {
        const isCurrent = c.id === currentCategoryId;
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => {
              onSelect(c.id);
              onClose();
            }}
            className={`flex w-full items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${
              isCurrent
                ? "bg-indigo-50 text-indigo-600 font-medium"
                : "text-gray-700 hover:bg-indigo-50"
            }`}
          >
            <span>{c.emoji}</span>
            <span>{c.name}</span>
          </button>
        );
      })}
    </div>
  );
}
