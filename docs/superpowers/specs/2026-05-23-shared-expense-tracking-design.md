# Shared Expense Tracking — Design

**Date:** 2026-05-23
**Status:** Approved (pre-implementation)
**Scope:** Single feature, single implementation plan.

## Goal

Let the user mark a transaction as a shared (family) expense and track whether it has been reimbursed. Surface a running total of pending reimbursements on the transactions page.

## Non-goals

- Tracking *who* shares the expense or *who* reimburses it (single counterparty assumed).
- Recording the date of reimbursement.
- Splitting an amount across people (the full transaction is either shared or not).
- Touching the dashboard / heatmap / category breakdown.
- Reflecting shared status in the bank-sync importer.

## Schema

Add two boolean columns to `Transaction`, both default `false`:

```prisma
model Transaction {
  id            Int      @id @default(autoincrement())
  date          DateTime
  description   String
  amount        Int
  accountId     Int
  categoryId   Int
  isShared      Boolean  @default(false)
  isReimbursed  Boolean  @default(false)
  account       Account  @relation(fields: [accountId], references: [id], onDelete: Cascade)
  category      Category @relation(fields: [categoryId], references: [id])
  createdAt     DateTime @default(now())

  @@index([accountId])
  @@index([categoryId])
  @@index([date])
}
```

- Migration name: `add_shared_expense_flags`
- No new indexes — dataset is small and filtering happens client-side.
- No DB-level CHECK constraint enforcing "isReimbursed only when isShared". The invariant is enforced in the server action.
- No data backfill — existing rows pick up the default `false` automatically.

### Invariant

> `isReimbursed = true` is only valid when `isShared = true`.

Enforced in:
- **Server action** — normalizes incoming payloads.
- **UI** — Devuelto checkbox is disabled when Familiar is unchecked.

## Server Action

New file: `src/app/transacciones/actions.ts`

```ts
"use server";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function updateSharedFlags(
  id: number,
  isShared: boolean,
  isReimbursed: boolean,
) {
  const normalizedReimbursed = isShared ? isReimbursed : false;

  await prisma.transaction.update({
    where: { id },
    data: { isShared, isReimbursed: normalizedReimbursed },
  });

  revalidatePath("/transacciones");
}
```

Design notes:
- **Single action, full state per call.** Client always sends the intended state of both flags. Avoids two round-trips when both flags change together (e.g., unchecking Familiar must also clear Devuelto).
- **Server normalizes.** Defense in depth alongside the disabled-checkbox UX.
- **No auth check.** Consistent with the existing single-user local app.
- **`revalidatePath`** ensures a hard reload reflects truth.

## UI Changes

All UI labels remain in Spanish to match the existing app. Field names in code remain English to match the existing schema.

### File: `src/app/transacciones/page.tsx`

Include the two new fields in the serialization mapper:

```ts
const serializedTransactions = transactions.map((t) => ({
  id: t.id,
  date: t.date.toISOString(),
  description: t.description,
  amount: t.amount,
  isShared: t.isShared,
  isReimbursed: t.isReimbursed,
  account: { id: t.account.id, name: t.account.name },
  category: { id: t.category.id, name: t.category.name, emoji: t.category.emoji },
}));
```

### File: `src/app/transacciones/TransaccionesClient.tsx`

#### Type update

```ts
type Transaction = {
  id: number;
  date: string;
  description: string;
  amount: number;
  isShared: boolean;
  isReimbursed: boolean;
  account: Account;
  category: Category;
};
```

#### 1. Two new table columns

Inserted between **Categoría** and **Monto**:

| Header     | Width | Cell                                                              |
| ---------- | ----- | ----------------------------------------------------------------- |
| `Familiar` | ~80px | Checkbox bound to `isShared`                                      |
| `Devuelto` | ~80px | Checkbox bound to `isReimbursed`, `disabled={!isShared}`          |

- Checkboxes are centered in their cell.
- Disabled checkbox uses Tailwind `disabled:opacity-30 disabled:cursor-not-allowed`.
- Unchecking Familiar visually clears Devuelto in the same render (state derives from `isShared`).

#### 2. Filter dropdown (3-state)

Added to the toolbar alongside the existing account and category filters.

```
[ Todos los gastos ▾ ]
   Todos
   Familiares
   No familiares
```

- State key: `sharedFilter: "todos" | "familiares" | "no-familiares"`.
- Uses the same pill styling as the existing filters (`bg-indigo-50 border-violet-300 text-indigo-500` when active).
- Shows as an active-filter pill in the existing pill row when not "todos".
- Included in the existing `hasActiveFilters` check and the "Limpiar filtros" reset.

Filter predicate:
```ts
if (sharedFilter === "familiares" && !t.isShared) return false;
if (sharedFilter === "no-familiares" && t.isShared) return false;
```

#### 3. Fourth summary card

Grid changes from `grid-cols-3` to `grid-cols-4`. New card on the right:

```
┌──────────────────────────┐
│ PENDIENTE DEVOLUCIÓN     │
│ $XX.XXX                  │
└──────────────────────────┘
```

Value computation (over the filtered set):
```ts
const totalPendingReimbursement = filtered
  .filter((t) => t.isShared && !t.isReimbursed && t.amount < 0)
  .reduce((acc, t) => acc + Math.abs(t.amount), 0);
```

- Only counts expenses (`amount < 0`). Income (positive amounts) is excluded — you don't get reimbursed for income.
- Displayed as a positive number via `Math.abs` + `formatCLP`.
- Uses existing card styling (`bg-[#f9f9f9] rounded-[20px] p-7`).

#### Interaction flow (optimistic update)

When a checkbox is toggled:

1. **Optimistic update**: local state for that row's `isShared` / `isReimbursed` flips immediately. If `isShared` was just unchecked, `isReimbursed` is forced to `false` in the same state update.
2. **Server call**: `startTransition(() => updateSharedFlags(id, isShared, isReimbursed))`.
3. **On error**: revert local state for that row to the prior value; `console.error` the failure. (No toast system exists in the app.)
4. **On success**: `revalidatePath` re-fetches on next navigation; in-memory state remains correct from the optimistic update.

State management approach:
- Hold transactions in local React state initialized from props (`useState(transactions)`), so optimistic edits and re-renders are local.
- Use `useTransition` for the server call.

## Files Touched

| File                                                              | Change                  |
| ----------------------------------------------------------------- | ----------------------- |
| `prisma/schema.prisma`                                            | Add 2 boolean fields    |
| `prisma/migrations/<timestamp>_add_shared_expense_flags/*`        | Generated migration     |
| `src/app/transacciones/actions.ts`                                | New file: server action |
| `src/app/transacciones/page.tsx`                                  | Include new fields in serialization |
| `src/app/transacciones/TransaccionesClient.tsx`                   | Columns + filter + card + optimistic update |

No changes to:
- `src/app/page.tsx` (dashboard)
- `src/app/cuentas/*`
- `src/app/config/*`
- `src/app/api/sync/route.ts` (importer leaves both flags at their defaults)

## Verification

Project has no automated tests. Verify manually after implementation:

1. Run `npx prisma migrate dev` — migration applies cleanly, dev DB gets the new columns.
2. Open `/transacciones`:
   - Two new columns render with all checkboxes unchecked.
   - Devuelto checkboxes are visibly disabled.
3. Check **Familiar** on a row:
   - Devuelto becomes enabled.
   - "Pendiente devolución" card increases by `|amount|` (if expense).
4. Check **Devuelto** on the same row:
   - "Pendiente devolución" card decreases by `|amount|`.
5. Uncheck **Familiar** on a row where Devuelto was checked:
   - Devuelto visually clears and becomes disabled.
   - "Pendiente devolución" reflects the change.
   - Reload the page → both server-side values are `false`.
6. Filter dropdown:
   - "Familiares" shows only shared rows; "No familiares" shows the rest.
   - Active filter pill appears; "Limpiar filtros" clears it.
   - Summary cards recalculate against filtered set.
7. Income transaction (`amount > 0`) marked as shared + not-reimbursed does **not** increment "Pendiente devolución".
