# Change transaction category — design

**Status**: approved
**Date**: 2026-05-23
**Scope**: UI feature; no schema change (`Transaction.categoryId` already exists).

## 1. Summary

Allow the user to change a transaction's category from the `/transacciones` page by clicking the category badge in a row. Clicking opens an inline popover with the list of categories. Picking one updates the row immediately (optimistic) and persists in the background. On failure, the row reverts and a toast appears.

## 2. Goals & non-goals

### Goals
- Re-categorize one transaction at a time directly from the transactions table.
- Instant visual feedback (optimistic UI).
- Persist via a server action; reconcile with server state on success.
- Match the existing Airy Pastel visual language (rounded, soft borders, indigo/violet accents).

### Non-goals (v1)
- Bulk re-categorization.
- Creating a new category from inside the picker.
- Undo.
- Editing other fields (description, amount, account) — separate future work.
- Adding a test suite to the project.

## 3. User flow

1. User is on `/transacciones`.
2. Each row's category badge is now a button (the badge styling is unchanged visually until hover).
3. User clicks the badge → a popover anchored under the badge opens, listing all categories (`emoji` + `name`). The current category is highlighted.
4. User clicks a category in the popover:
   - Popover closes.
   - Badge updates instantly to the new category (optimistic).
   - Server action persists the change.
5. On success: `router.refresh()` reconciles server state. No further UI change visible to the user.
6. On failure: badge reverts to the previous category and a toast `"No se pudo cambiar la categoría"` appears top-right and auto-dismisses after ~3s.
7. If the user picks the same category that is already set: popover closes, no server call, no UI change.

## 4. Architecture

### 4.1 New server action
**File**: `src/app/transacciones/actions.ts` (new file)

```ts
"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export type UpdateCategoryResult =
  | { ok: true }
  | { ok: false; error: string };

export async function updateTransactionCategory(
  transactionId: number,
  categoryId: number,
): Promise<UpdateCategoryResult> {
  if (!Number.isInteger(transactionId) || transactionId <= 0) {
    return { ok: false, error: "Datos inválidos" };
  }
  if (!Number.isInteger(categoryId) || categoryId <= 0) {
    return { ok: false, error: "Datos inválidos" };
  }

  try {
    await prisma.transaction.update({
      where: { id: transactionId },
      data: { categoryId },
    });
  } catch {
    return { ok: false, error: "No se pudo actualizar" };
  }

  revalidatePath("/transacciones");
  revalidatePath("/"); // dashboard donut depends on categories
  return { ok: true };
}
```

Notes:
- Returns a discriminated result rather than throwing, so the client can drive the optimistic revert without a try/catch around the action call site.
- No auth check: this app runs 100% locally for a single user.
- Prisma will throw on a non-existent `categoryId` (FK violation) or non-existent `transactionId`; both are caught.

### 4.2 New client component
**File**: `src/components/CategoryPicker.tsx` (new file)

Props:

```ts
type CategoryOption = { id: number; name: string; emoji: string };

interface CategoryPickerProps {
  currentCategoryId: number;
  categories: CategoryOption[];
  onSelect: (categoryId: number) => void;
  onClose: () => void;
}
```

Behavior:
- Renders an absolutely-positioned popover (anchored to a wrapping `<span>` provided by the parent — no portal).
- Lists `<button>` rows: `<emoji> <name>`. The current category gets a checkmark or accent background.
- Closes on:
  - clicking outside (mousedown listener on `document`),
  - pressing `Escape`,
  - selecting an item (parent's `onSelect` triggers `onClose`).
- Width ~220px, max-height ~280px, internal scroll if needed.
- Uses existing Tailwind tokens: `bg-white`, `border-indigo-100`, `rounded-xl`, `shadow-lg`, hover `bg-indigo-50`.

### 4.3 Changes to `TransaccionesClient.tsx`

- Add state: `const [openPickerForTxId, setOpenPickerForTxId] = useState<number | null>(null);`
- Add `useOptimistic`:
  ```ts
  const [optimisticTransactions, applyOptimistic] = useOptimistic(
    transactions,
    (state, update: { txId: number; category: CategoryOption }) =>
      state.map((t) =>
        t.id === update.txId ? { ...t, category: { ...update.category } } : t,
      ),
  );
  ```
  Use `optimisticTransactions` (instead of `transactions`) inside the existing `filtered` `useMemo`. This means the active category filter and the summary numbers reflect the optimistic value too.
- Add `const router = useRouter()` and `const [isPending, startTransition] = useTransition()`.
- Replace the row's category cell with:
  ```tsx
  <td className="py-3 pr-4">
    <span className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpenPickerForTxId(t.id)}
        className="..."
      >
        <CategoryBadge name={t.category.name} />
      </button>
      {openPickerForTxId === t.id && (
        <CategoryPicker
          currentCategoryId={t.category.id}
          categories={categories}
          onSelect={(newCategoryId) => handleSelect(t.id, newCategoryId)}
          onClose={() => setOpenPickerForTxId(null)}
        />
      )}
    </span>
  </td>
  ```
- `handleSelect`:
  ```ts
  function handleSelect(txId: number, newCategoryId: number) {
    setOpenPickerForTxId(null);
    const current = transactions.find((t) => t.id === txId);
    if (!current || current.category.id === newCategoryId) return; // no-op

    const newCategory = categories.find((c) => c.id === newCategoryId);
    if (!newCategory) return;

    startTransition(async () => {
      applyOptimistic({ txId, category: newCategory });
      const result = await updateTransactionCategory(txId, newCategoryId);
      if (result.ok) {
        router.refresh();
      } else {
        setToast("No se pudo cambiar la categoría");
      }
    });
  }
  ```
- Add a minimal toast: `const [toast, setToast] = useState<string | null>(null)` plus a `useEffect` that auto-dismisses after 3000ms. Rendered absolutely at top-right of the page container.

### 4.4 No prop changes needed from `page.tsx`
The page already loads `categories` (with `id`, `name`, `emoji`) and includes `category.id` in the serialized transaction, so no server-side changes are needed beyond adding the new action file.

## 5. Data flow

```
[badge click]
    -> setOpenPickerForTxId(t.id)
        -> CategoryPicker renders

[pick a category]
    -> onSelect(newCategoryId)
        -> setOpenPickerForTxId(null)
        -> short-circuit if currentCategoryId === newCategoryId
        -> startTransition:
             applyOptimistic({ txId, category: newCategoryObj })   // row updates instantly
             await updateTransactionCategory(txId, newCategoryId)  // server persists
             if ok: router.refresh()                               // reconcile
             else:  setToast("No se pudo cambiar la categoría")    // useOptimistic reverts
```

The filtering and summary `useMemo`s read from `optimisticTransactions`, so they reflect the change immediately — including the case where the active category filter no longer matches the row (the row disappears as expected).

## 6. Error handling & edge cases

| Case | Behavior |
|---|---|
| Server action throws (DB error, FK violation, etc.) | Caught in action, returns `{ ok: false }`. Optimistic value drops, badge reverts, toast shown. |
| Category was deleted between page load and click | FK violation → same as above. User can refresh page to update the picker list. |
| Transaction was deleted concurrently | Same — caught, reverted, toast shown. |
| User clicks the same category | No-op short-circuit; popover closes. |
| User opens picker A, then clicks badge B | Picker A closes; Picker B opens (single `openPickerForTxId` state guarantees this). |
| Escape pressed while picker open | Picker closes. No selection made. |
| Click outside picker | Picker closes. No selection made. |
| Invalid `transactionId` or `categoryId` (defense in depth) | Action returns `{ ok: false, error: "Datos inválidos" }` before hitting Prisma. |
| Active category filter excludes the new category | Row disappears optimistically (correct). |

## 7. Visual / UX notes

- Badge gets a subtle hover state to signal interactivity: existing `bg-indigo-50` becomes slightly darker on `hover:bg-indigo-100`, plus `cursor-pointer`. The "Sueldo" green badge gets the analogous treatment.
- Popover styling mirrors existing toolbar inputs: `bg-white border border-indigo-100 rounded-xl shadow-lg`.
- Toast: small pill, `bg-gray-800 text-white text-sm px-4 py-2 rounded-full`, top-right, slide-in / fade-out.
- No layout shift in the row when picker opens (popover is absolutely positioned).

## 8. Testing & verification

This project has no test suite and adding one for a single UI feature is out of scope. Verification is manual against the running app:

1. Open `/transacciones`, click a badge → popover anchors under the badge, lists all categories, current one is highlighted.
2. Pick a different category → badge updates instantly, emoji updates, row stays in place.
3. Refresh the page → the change persists.
4. Pick the same category → popover closes, no network request (check DevTools Network tab), no flicker.
5. Open picker, press Escape → closes.
6. Open picker, click outside → closes.
7. Open picker A, click badge B → A closes, B opens.
8. Apply an active category filter that *excludes* the new category, then change a row to it → row disappears.
9. Simulate failure (temporarily throw inside the action, or stop the dev server mid-click) → badge reverts and toast appears.

## 9. Files touched

| File | Change |
|---|---|
| `src/app/transacciones/actions.ts` | **new** — `updateTransactionCategory` server action. |
| `src/components/CategoryPicker.tsx` | **new** — popover component. |
| `src/app/transacciones/TransaccionesClient.tsx` | edits — clickable badge, optimistic state, toast, action wiring. |
| `src/app/transacciones/page.tsx` | no change. |
| `prisma/schema.prisma` | no change. |

## 10. Open questions

None. All open decisions resolved during brainstorming:
- Edit trigger: click the badge.
- Picker style: inline popover anchored to the badge.
- Save: auto-save, optimistic.
- Bulk edit: not in v1.
