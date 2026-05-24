# Manual Transaction Entry

**Status:** Approved  
**Date:** 2026-05-25  
**Board:** finanzas-personales

## Motivation

The only way to add transactions is bank sync. Cash purchases, Mercado Pago transfers, payments from unsupported banks, and any expense made outside the 9 supported Chilean banks are invisible. Users need a way to manually log transactions.

## UX Design

### Entry Point
- **Desktop:** "Nueva Transacción" button in the transactions page header (next to existing filters).
- **Mobile:** Floating Action Button (FAB) — a violet `+` circle fixed at bottom-right, above the bottom nav bar (`bottom-20 right-4 z-40`). 44×44px minimum.

### Modal Dialog
A centered modal overlay (`fixed inset-0 z-50`) with backdrop blur. Same violet palette as the rest of the app.

**Fields (top to bottom):**

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| Tipo | Toggle: Gasto / Ingreso | Yes | Gasto | Toggles amount sign. "Gasto" → negative, "Ingreso" → positive |
| Monto | Number input | Yes | — | Integer only (CLP has no decimals). Display with `$` prefix. Store as negative for expenses, positive for income |
| Descripción | Text input | Yes | — | Max 200 chars |
| Fecha | Date picker | Yes | Today | Native `<input type="date">`, max = today |
| Cuenta | Select dropdown | Yes | First account | Populated from accounts (exclude hidden) |
| Categoría | Select dropdown | Yes | First category | Populated from all categories, show emoji + name |
| Nota | Text input | No | — | Max 500 chars |
| Familiar | Checkbox | No | false | `isShared` flag |
| Devuelto | Checkbox | No | false | `isReimbursed` flag, disabled unless Familiar is checked |

**Buttons:**
- "Guardar" (primary, violet) — submits the form
- "Cancelar" (secondary, ghost) — closes modal
- Close `×` button in top-right corner
- Escape key closes modal
- Click outside modal closes it (only if form is pristine; if dirty, no-op)

### Validation
- Amount must be > 0 (the sign is determined by the Gasto/Ingreso toggle)
- Description must be non-empty after trim
- Date must be ≤ today
- Account and Category must be selected
- Show inline error messages below each field in red

### After Submit
- Optimistic insert into the transaction list (prepend to top)
- Close modal
- If server action fails, remove the optimistic row and show a `console.error` (no toast system yet)
- `revalidatePath("/transacciones")` + `revalidatePath("/")` (dashboard totals change)

## Server Action

```typescript
// src/app/transacciones/actions.ts

export type CreateTransactionResult =
  | { ok: true; transaction: { id: number; date: string; description: string; note: string | null; amount: number; accountId: number; categoryId: number; isShared: boolean; isReimbursed: boolean; createdAt: string } }
  | { ok: false; error: string };

export async function createTransaction(data: {
  amount: number;       // always positive — sign applied server-side
  type: "expense" | "income";
  description: string;
  date: string;         // ISO date string (YYYY-MM-DD)
  accountId: number;
  categoryId: number;
  note?: string;
  isShared?: boolean;
  isReimbursed?: boolean;
}): Promise<CreateTransactionResult> {
  const finalAmount = data.type === "expense" ? -Math.abs(data.amount) : Math.abs(data.amount);
  
  const transaction = await prisma.transaction.create({
    data: {
      amount: finalAmount,
      description: data.description.trim(),
      date: new Date(data.date),
      accountId: data.accountId,
      categoryId: data.categoryId,
      note: data.note?.trim() || null,
      isShared: data.isShared ?? false,
      isReimbursed: data.isReimbursed ?? false,
    },
  });
  
  revalidatePath("/transacciones");
  revalidatePath("/");
  
  return { ok: true, transaction: { ...transaction, date: transaction.date.toISOString(), createdAt: transaction.createdAt.toISOString() } };
}
```

## Schema Changes

None. The existing `Transaction` model already has all needed fields.

## New Files

| File | Purpose |
|------|---------|
| `src/components/CreateTransactionModal.tsx` | `"use client"` modal component with form |

## Modified Files

| File | Change |
|------|--------|
| `src/app/transacciones/actions.ts` | Add `createTransaction` server action |
| `src/app/transacciones/TransaccionesClient.tsx` | Add FAB button (mobile) + header button (desktop), modal state, optimistic insert into `useOptimistic` reducer |

## Optimistic Update Pattern

Extend the existing `OptimisticUpdate` union type:

```typescript
type OptimisticUpdate =
  | { type: "category"; id: number; categoryId: number; category: { id: number; name: string; emoji: string } }
  | { type: "shared"; id: number; isShared: boolean; isReimbursed: boolean }
  | { type: "note"; id: number; note: string | null }
  | { type: "create"; transaction: Transaction };  // NEW
```

In the reducer, `"create"` prepends the new transaction to the list.

## Edge Cases

- **Duplicate guard:** No deduplication for manual entries (unlike sync). User can create duplicates — that's their intent.
- **Account balance:** The current app does NOT maintain a running balance from transactions (balance is set by sync). Manual transactions do NOT update `Account.balance`. This is fine for v1.
- **Hidden accounts:** The account dropdown must exclude accounts where `hidden: true`.
- **Empty state:** If no accounts exist, the FAB/button should still appear but show a message: "Primero crea una cuenta en Configuración."

## What NOT to Change

- Don't modify the dashboard, accounts page, or config page
- Don't add FormData-based actions — use typed objects (matches the pattern in `updateTransactionCategory`)
- Don't add a toast system — use `console.error` for failures like existing actions
- Don't add transaction editing (separate feature)

## Verification

1. Create an expense → appears in transaction list with negative amount
2. Create an income → appears with positive amount  
3. All fields persist correctly after page refresh
4. Modal closes on Escape, Cancel, and × button
5. Validation prevents empty description, zero amount, future date
6. FAB visible on mobile, header button on desktop
7. Hidden accounts don't appear in dropdown
