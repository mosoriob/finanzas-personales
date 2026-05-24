# Transaction Deletion

**Status:** Approved  
**Date:** 2026-05-25  
**Board:** finanzas-personales

## Motivation

Users cannot remove duplicate imports, test entries, or mistakes. Once a transaction exists, it's permanent. This is the most basic CRUD operation missing from the app.

## UX Design

### Desktop (Table View)
- Each transaction row gets a trash icon (🗑️ or Lucide `Trash2`) that appears **on hover**, right-aligned in the row.
- Clicking the trash icon opens a **confirmation dialog** (not a browser `confirm()` — a styled modal matching the app's design).

### Mobile (Card View)
- Each transaction card gets a small trash icon in the top-right corner, always visible (no hover on touch devices).
- Same confirmation dialog.

### Confirmation Dialog
A small centered modal:

```
┌─────────────────────────────────────┐
│  ¿Eliminar transacción?             │
│                                     │
│  "Supermercado Líder" — $45.230     │
│  Esta acción no se puede deshacer.  │
│                                     │
│        [Cancelar]  [Eliminar]       │
└─────────────────────────────────────┘
```

- Shows the transaction description and amount for confirmation
- "Eliminar" button in red (`bg-red-500`)
- "Cancelar" in ghost/secondary style
- Escape closes the dialog
- Click outside closes the dialog

### After Deletion
- Optimistic removal from the list (transaction disappears immediately)
- If server action fails, the transaction reappears and `console.error` logs the error
- `revalidatePath("/transacciones")` + `revalidatePath("/")` (dashboard totals change)

## Server Action

```typescript
// src/app/transacciones/actions.ts

export type DeleteTransactionResult =
  | { ok: true }
  | { ok: false; error: string };

export async function deleteTransaction(id: number): Promise<DeleteTransactionResult> {
  try {
    await prisma.transaction.delete({ where: { id } });
    revalidatePath("/transacciones");
    revalidatePath("/");
    return { ok: true };
  } catch {
    return { ok: false, error: "No se pudo eliminar la transacción" };
  }
}
```

## Schema Changes

None. Hard delete — no `deletedAt` column needed.

## New Files

| File | Purpose |
|------|---------|
| `src/components/DeleteConfirmDialog.tsx` | `"use client"` reusable confirmation dialog |

## Modified Files

| File | Change |
|------|--------|
| `src/app/transacciones/actions.ts` | Add `deleteTransaction` server action |
| `src/app/transacciones/TransaccionesClient.tsx` | Add trash icon per row/card, dialog state, optimistic delete in `useOptimistic` reducer |
| `src/components/transaction-card.tsx` | Add trash icon to mobile card |

## Optimistic Update Pattern

Extend the existing `OptimisticUpdate` union type:

```typescript
type OptimisticUpdate =
  | { type: "category"; ... }
  | { type: "shared"; ... }
  | { type: "note"; ... }
  | { type: "delete"; id: number };  // NEW
```

In the reducer, `"delete"` filters out the transaction by id.

## Edge Cases

- **Concurrent deletion:** If two tabs try to delete the same transaction, the second call should return `{ ok: false }` gracefully (Prisma throws `RecordNotFound`).
- **Cascade:** Transactions have no children — safe to hard delete. The `Account` → `Transaction` relation has `onDelete: Cascade`, but we're deleting the transaction, not the account.
- **Re-import:** If a deleted transaction was from bank sync, the next sync will re-import it (the deduplication in `/api/sync` matches by date+amount+description, so the re-import will create a new row). This is acceptable — user can delete again or simply not sync.
- **No bulk delete:** v1 is single-transaction deletion only.

## What NOT to Change

- Don't add soft delete / trash / undo
- Don't add bulk selection or multi-delete
- Don't modify the sync deduplication logic
- Don't add swipe-to-delete gestures (too complex for v1)

## Verification

1. Hover on desktop row → trash icon appears
2. Click trash → confirmation dialog with correct description + amount
3. Click "Eliminar" → transaction disappears immediately (optimistic)
4. Refresh page → transaction is gone (server-side confirmed)
5. Cancel / Escape / click-outside → dialog closes, no deletion
6. Mobile card shows trash icon, same dialog flow
7. Deleting the only transaction on the page → empty state shows correctly
