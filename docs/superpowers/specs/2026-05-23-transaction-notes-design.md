# Transaction Notes ("Nota") — Design Spec

**Date:** 2026-05-23
**Status:** Approved
**Author:** maxiosorio + fp-orchestrator

## Motivation

Transactions imported from bank CSV files have auto-generated descriptions that can be cryptic (e.g., "COMPRA 13-05 UBER *TRIP"). Users want a way to add their own context — a personal note — without losing the original description.

## Design

### Schema

Add a nullable `note` field to the `Transaction` model:

```prisma
model Transaction {
  id           Int      @id @default(autoincrement())
  date         DateTime
  description  String
  note         String?              // ← NEW: user-added note
  amount       Int
  accountId    Int
  categoryId   Int
  isShared     Boolean  @default(false)
  isReimbursed Boolean  @default(false)
  account      Account  @relation(fields: [accountId], references: [id], onDelete: Cascade)
  category     Category @relation(fields: [categoryId], references: [id])
  createdAt    DateTime @default(now())

  @@index([accountId])
  @@index([categoryId])
  @@index([date])
}
```

- `note String?` — nullable because most transactions won't have a user note.
- Migration name: `add_transaction_note`
- No default value needed (null means "no note").

### Server Action

Add `updateTransactionNote(id: number, note: string | null)` to `src/app/transacciones/actions.ts`:

```typescript
export async function updateTransactionNote(
  id: number,
  note: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!Number.isInteger(id) || id <= 0) {
    return { ok: false, error: "Datos inválidos" };
  }

  // Trim + normalize: empty string → null (remove note)
  const normalizedNote = note?.trim() || null;

  try {
    await prisma.transaction.update({
      where: { id },
      data: { note: normalizedNote },
    });
  } catch {
    return { ok: false, error: "No se pudo actualizar la nota" };
  }

  revalidatePath("/transacciones");
  return { ok: true };
}
```

### Serialization

In `src/app/transacciones/page.tsx`, include `note` in the serialized transaction:

```typescript
const serializedTransactions = transactions.map((t) => ({
  // ... existing fields ...
  note: t.note,  // ← NEW
  // ...
}));
```

### UI Changes in `TransaccionesClient.tsx`

#### Type Update

```typescript
type Transaction = {
  id: number;
  date: string;
  description: string;
  note: string | null;     // ← NEW
  amount: number;
  isShared: boolean;
  isReimbursed: boolean;
  account: Account;
  category: Category;
};
```

#### Optimistic Update

Add a new optimistic update type:

```typescript
type OptimisticUpdate =
  | { type: "category"; txId: number; category: Category }
  | { type: "shared"; txId: number; isShared: boolean; isReimbursed: boolean }
  | { type: "note"; txId: number; note: string | null };  // ← NEW
```

#### Description Cell — Inline Note Display + Edit

In the description `<td>`, show the note below the description and account name. Interaction:

1. **Display mode (default)**: Show description (read-only, bold), account name (gray, small), and note (italic, small, muted) if present. A small pencil icon (✏️) appears on hover next to the description area to indicate editability.
2. **Edit mode (on pencil click)**: Replace the note area with a text input. The input:
   - Pre-fills with the existing note (or empty if null)
   - Has placeholder "Agregar nota..."
   - Auto-focuses on open
   - Saves on Enter or blur
   - Cancels on Escape (reverts to previous value)
   - Empty input → sets note to null (removes the note)
3. **Optimistic update**: Same pattern as category/shared — local state update + server action in `useTransition`, revert on error.

Visual layout of the description cell:

```
┌─────────────────────────────┐
│ 🛒  COMPRA UBER *TRIP    ✏️ │  ← description (read-only) + pencil
│     Cuenta Corriente        │  ← account name
│     Uber al aeropuerto      │  ← note (italic, muted, only if present)
└─────────────────────────────┘
```

When editing:

```
┌─────────────────────────────┐
│ 🛒  COMPRA UBER *TRIP       │
│     Cuenta Corriente        │
│     [Uber al aeropuerto___] │  ← text input with existing note
└─────────────────────────────┘
```

Styling:
- Note text: `text-xs text-indigo-400 italic` (distinguishable from the gray account name)
- Edit input: `text-xs text-gray-700 bg-white border border-indigo-200 rounded px-1.5 py-0.5 outline-none focus:border-violet-400 w-full`
- Pencil icon: `text-gray-300 hover:text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity` (only visible on row hover)

#### Search Enhancement

Extend the search filter to also match notes:

```typescript
const matchesNote = t.note?.toLowerCase().includes(q) ?? false;
if (!matchesDesc && !matchesAccount && !matchesNote) return false;
```

Update the search placeholder: `"Buscar por descripción, nota o cuenta..."`

### Files Touched

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `note String?` |
| `prisma/migrations/<ts>_add_transaction_note/*` | Generated migration |
| `src/app/transacciones/actions.ts` | Add `updateTransactionNote` server action |
| `src/app/transacciones/page.tsx` | Include `note` in serialization |
| `src/app/transacciones/TransaccionesClient.tsx` | Type update, optimistic update, inline note editor, search enhancement |

### What NOT to Change

- The `description` field remains read-only — it is the bank-imported text.
- No new table column — the note is shown inside the existing description cell.
- No new summary card — notes are informational, not aggregatable.
- Dashboard, cuentas, config, and sync routes are untouched.
