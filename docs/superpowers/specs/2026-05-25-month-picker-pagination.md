# Month Picker & Pagination

**Status:** Approved  
**Date:** 2026-05-25  
**Board:** finanzas-personales

## Motivation

`/transacciones` currently fetches ALL transactions in a single query with no date filtering or pagination. As the user accumulates months of bank sync data, this page will slow down significantly. A month picker and pagination provide both performance and usability benefits.

## UX Design

### Month Picker

A horizontal bar at the top of the transactions page (above the existing search/filter bar):

```
       ◀  Mayo 2026  ▶        [Todo]
```

- Left/right arrows navigate months
- Current month name + year displayed in center (Spanish: Enero, Febrero, ..., Diciembre)
- "Todo" button at the right shows all transactions (removes date filter)
- Default: current month
- Navigation via URL search params: `?mes=2026-05` (ISO year-month format)
- Going beyond the earliest/latest transaction month disables the arrow

### Pagination (Desktop)

At the bottom of the transaction list:

```
  Mostrando 1-50 de 127 transacciones

  ◀  1  2  3  ▶
```

- 50 transactions per page
- Page number in URL: `?pagina=2`
- Combined with month: `?mes=2026-05&pagina=2`
- Changing month resets to page 1
- Changing filters resets to page 1

### Infinite Scroll (Mobile)

- First 50 transactions load initially
- Scroll near bottom → load next 50 (append, don't replace)
- "Cargando más..." spinner at bottom while fetching
- Stop when all transactions for the selected month are loaded

### Summary Bar Update

The existing summary bar (count, total expenses, total income, pending reimbursement) should reflect the **filtered view** — i.e., totals for the selected month + active filters, not all-time totals.

## Server Component Changes

The server component (`page.tsx`) reads search params and passes them to both the Prisma query and the client component:

```typescript
// src/app/transacciones/page.tsx

export default async function TransaccionesPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; pagina?: string }>;
}) {
  const params = await searchParams;
  const mes = params.mes; // "2026-05" or undefined (= current month)
  const pagina = parseInt(params.pagina || "1", 10);
  const PAGE_SIZE = 50;

  // Date range for the selected month
  let dateFilter: { gte?: Date; lt?: Date } | undefined;
  if (mes) {
    const [year, month] = mes.split("-").map(Number);
    dateFilter = {
      gte: new Date(year, month - 1, 1),
      lt: new Date(year, month, 1),
    };
  } else {
    // Default: current month
    const now = new Date();
    dateFilter = {
      gte: new Date(now.getFullYear(), now.getMonth(), 1),
      lt: new Date(now.getFullYear(), now.getMonth() + 1, 1),
    };
  }

  // "Todo" mode: mes=todo → no date filter
  if (mes === "todo") {
    dateFilter = undefined;
  }

  const [transactions, totalCount, accounts, categories] = await Promise.all([
    prisma.transaction.findMany({
      where: { date: dateFilter },
      include: { account: true, category: true },
      orderBy: { date: "desc" },
      skip: (pagina - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.transaction.count({
      where: { date: dateFilter },
    }),
    prisma.account.findMany(),
    prisma.category.findMany(),
  ]);

  // ... serialize and pass to client
}
```

## New Files

| File | Purpose |
|------|---------|
| `src/components/MonthPicker.tsx` | `"use client"` month navigation component |
| `src/components/Pagination.tsx` | `"use client"` page navigation component (desktop) |

## Modified Files

| File | Change |
|------|--------|
| `src/app/transacciones/page.tsx` | Read `mes` and `pagina` from searchParams, add date filter + pagination to Prisma query, pass `totalCount` and `currentPage` to client |
| `src/app/transacciones/TransaccionesClient.tsx` | Add MonthPicker above filters, Pagination below table (desktop), infinite scroll logic (mobile), update summary bar to use filtered totals |

## Schema Changes

None. The `Transaction` model already has a `date` index (`@@index([date])`).

## URL Design

| State | URL |
|-------|-----|
| Current month, page 1 | `/transacciones` (default) |
| Specific month | `/transacciones?mes=2026-05` |
| Specific month + page | `/transacciones?mes=2026-05&pagina=2` |
| All transactions | `/transacciones?mes=todo` |
| All + page | `/transacciones?mes=todo&pagina=3` |

Navigation uses `router.push()` with shallow routing to update search params without full page reload.

## Edge Cases

- **Empty month:** Show "No hay transacciones en [month name]" with a suggestion to navigate to another month.
- **Month with no transactions before/after:** Arrows should still work (navigate to empty months). Don't skip months — it's confusing.
- **Filter interaction:** Text search, account filter, category filter, and shared filter all apply WITHIN the selected month. Changing any filter resets to page 1.
- **Deep linking:** URL with `?mes=2026-05&pagina=2` should work on direct navigation (server-side rendered).
- **Optimistic updates:** When creating or deleting a transaction (from features #1 and #2), the optimistic update works within the current page. The total count may be stale until revalidation.
- **Mobile infinite scroll reset:** Changing month or filters resets the loaded items and scroll position.

## What NOT to Change

- Don't add custom date ranges (start date – end date picker)
- Don't add "last 3 months" or "last year" presets
- Don't modify the dashboard queries (dashboard always shows current month)
- Don't add server-side caching or ISR — keep `force-dynamic`
- Don't change the transaction sort order (desc by date)

## Verification

1. Default view shows current month's transactions only
2. Left arrow navigates to previous month, right arrow to next
3. "Todo" shows all transactions across all months
4. Page numbers appear when >50 transactions in selected view
5. Clicking page 2 loads the next 50, URL updates
6. Summary bar totals match the filtered view (not all-time)
7. Mobile: scrolling near bottom loads more transactions
8. Changing month resets to page 1
9. Direct navigation to `?mes=2026-03&pagina=2` works
10. Empty month shows appropriate message
