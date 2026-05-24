# Category Editing & Deletion

**Status:** Approved  
**Date:** 2026-05-25  
**Board:** finanzas-personales

## Motivation

Categories can be created but never edited or deleted. A typo in a category name or an unused category is permanent. Users need basic CRUD for categories.

## UX Design

### Config → Categorías Tab

The existing category list in the Config page currently shows each category with emoji, name, and transaction count. Add edit and delete actions:

```
  🛒 Supermercado (23)     ✏️  🗑️
  🚗 Transporte (15)       ✏️  🗑️
  🎬 Entretenimiento (8)   ✏️  🗑️
  📌 Prueba (0)             ✏️  🗑️
```

### Edit Flow
1. Click pencil icon → category row transforms into inline edit mode
2. Name becomes a text input (pre-filled), emoji becomes a text input (pre-filled)
3. "Guardar" and "Cancelar" buttons replace the edit/delete icons
4. Enter key saves, Escape cancels
5. Validation: name must be non-empty and unique (excluding current category)

### Delete Flow
1. Click trash icon → confirmation dialog opens

**If category has 0 transactions:**
```
┌────────────────────────────────────┐
│  ¿Eliminar categoría?              │
│                                    │
│  🎬 "Entretenimiento"              │
│  Esta categoría no tiene           │
│  transacciones.                    │
│                                    │
│       [Cancelar]  [Eliminar]       │
└────────────────────────────────────┘
```

**If category has transactions (Option C — replacement picker):**
```
┌──────────────────────────────────────────┐
│  ¿Eliminar categoría?                    │
│                                          │
│  🛒 "Supermercado" tiene 23              │
│  transacciones.                          │
│                                          │
│  Mover transacciones a:                  │
│  ┌──────────────────────────┐            │
│  │ 📌 Sin Categoría       ▾ │            │
│  └──────────────────────────┘            │
│                                          │
│         [Cancelar]  [Eliminar]           │
└──────────────────────────────────────────┘
```

- Dropdown lists all OTHER categories (not the one being deleted)
- Default selection: first category alphabetically (or "Sin Categoría" if it exists)
- "Eliminar" button is red

**If category is used by auto-categorization — additional warning:**
```
┌──────────────────────────────────────────┐
│  ⚠️ Categoría usada por                  │
│  auto-categorización                     │
│                                          │
│  🛒 "Supermercado" es asignada           │
│  automáticamente durante la              │
│  sincronización bancaria. Si la          │
│  eliminas, esas transacciones se         │
│  asignarán a la categoría por defecto.   │
│                                          │
│  Tiene 23 transacciones.                 │
│  Mover transacciones a:                  │
│  ┌──────────────────────────┐            │
│  │ 📌 Sin Categoría       ▾ │            │
│  └──────────────────────────┘            │
│                                          │
│        [Cancelar]  [Eliminar]            │
└──────────────────────────────────────────┘
```

### Auto-Categorization Protected Categories

The following category names are referenced by regex rules in `src/app/api/sync/route.ts` (`CATEGORY_RULES`):

| Category Name | Regex Pattern |
|--------------|---------------|
| Supermercado | `/supermercado\|lider\|jumbo.../i` |
| Transporte | `/uber\|cabify\|metro.../i` |
| Entretenimiento | `/netflix\|spotify.../i` |
| Salud | `/farmacia\|isapre.../i` |
| Restaurantes | `/restaurant\|mcdonald.../i` |
| Servicios | `/luz\|agua\|gas.../i` |
| Hogar | `/sodimac\|easy.../i` |
| Educación | `/universidad\|colegio.../i` |
| Sueldo | `/sueldo\|remuneración.../i` |
| Transferencias | `/transferencia.../i` |

These categories show the ⚠️ warning before deletion. Deletion is still **allowed** — the warning is informational. If deleted, the sync route's `guessCategory()` will fail to match the name and fall back to "Otros" (or the first available category).

## Server Actions

```typescript
// src/app/config/actions.ts

export type UpdateCategoryResult =
  | { ok: true }
  | { ok: false; error: string };

export async function updateCategory(
  id: number,
  data: { name: string; emoji: string }
): Promise<UpdateCategoryResult> {
  const trimmedName = data.name.trim();
  if (!trimmedName) return { ok: false, error: "El nombre no puede estar vacío" };

  // Check uniqueness (excluding self)
  const existing = await prisma.category.findFirst({
    where: { name: trimmedName, NOT: { id } },
  });
  if (existing) return { ok: false, error: "Ya existe una categoría con ese nombre" };

  await prisma.category.update({
    where: { id },
    data: { name: trimmedName, emoji: data.emoji.trim() || "📌" },
  });

  revalidatePath("/config");
  revalidatePath("/transacciones"); // category names appear in transaction list
  return { ok: true };
}

export type DeleteCategoryResult =
  | { ok: true }
  | { ok: false; error: string };

export async function deleteCategory(
  id: number,
  replacementCategoryId: number
): Promise<DeleteCategoryResult> {
  // Don't allow deleting into self
  if (id === replacementCategoryId) {
    return { ok: false, error: "La categoría de reemplazo no puede ser la misma" };
  }

  // Verify both categories exist
  const [target, replacement] = await Promise.all([
    prisma.category.findUnique({ where: { id } }),
    prisma.category.findUnique({ where: { id: replacementCategoryId } }),
  ]);
  if (!target) return { ok: false, error: "Categoría no encontrada" };
  if (!replacement) return { ok: false, error: "Categoría de reemplazo no encontrada" };

  // Reassign transactions, then delete
  await prisma.$transaction([
    prisma.transaction.updateMany({
      where: { categoryId: id },
      data: { categoryId: replacementCategoryId },
    }),
    prisma.category.delete({ where: { id } }),
  ]);

  revalidatePath("/config");
  revalidatePath("/transacciones");
  revalidatePath("/");
  return { ok: true };
}
```

## Schema Changes

None. The existing `Category` model and `Transaction.categoryId` FK are sufficient.

## New Files

| File | Purpose |
|------|---------|
| `src/components/DeleteCategoryDialog.tsx` | `"use client"` confirmation dialog with replacement picker and auto-cat warning |

## Modified Files

| File | Change |
|------|--------|
| `src/app/config/actions.ts` | Add `updateCategory` and `deleteCategory` server actions |
| `src/app/config/ConfigClient.tsx` | Add edit/delete icons to category rows, inline edit mode, wire up delete dialog |

## Constants

Add a list of auto-categorization category names so the UI can show warnings:

```typescript
// src/lib/constants.ts (new file, or inline in ConfigClient)

export const AUTO_CATEGORIZATION_NAMES = [
  "Supermercado", "Transporte", "Entretenimiento", "Salud",
  "Restaurantes", "Servicios", "Hogar", "Educación",
  "Sueldo", "Transferencias",
];
```

## Edge Cases

- **Last category standing:** Don't allow deletion if only 1 category remains (there must always be at least one for new transactions and the replacement picker).
- **Category referenced by name in sync:** The `CATEGORY_RULES` in `sync/route.ts` reference categories by NAME (e.g., `"Supermercado"`). If the user renames "Supermercado" to "Mercado", auto-categorization will fail to find "Supermercado" and fall back to default. This is acceptable — the user made a conscious choice. The auto-cat warning covers this for deletion; no warning is needed for rename (lower risk).
- **Concurrent edit:** Two tabs editing the same category — last write wins (acceptable for personal finance app).
- **Name uniqueness:** Enforced server-side. The UI should also check client-side for immediate feedback.

## What NOT to Change

- Don't modify the `CATEGORY_RULES` in `sync/route.ts` — they remain hardcoded
- Don't add category merging (combine two categories into one)
- Don't add category ordering or drag-and-drop
- Don't add category colors or icons beyond emoji
- Don't modify the CategoryPicker in TransaccionesClient (it reads from props, auto-updates)

## Verification

1. Click pencil icon → row enters edit mode with pre-filled name + emoji
2. Edit name → save → name updates in category list and transaction table
3. Edit emoji → save → emoji updates everywhere
4. Try saving empty name → error shown
5. Try saving duplicate name → error shown
6. Delete category with 0 transactions → simple confirmation, deleted
7. Delete category with transactions → replacement picker shown, transactions reassigned
8. Delete auto-categorization category → ⚠️ warning shown before picker
9. After deletion, affected transactions show new category in `/transacciones`
10. Cannot delete the last remaining category
