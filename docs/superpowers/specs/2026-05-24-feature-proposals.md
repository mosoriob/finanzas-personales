# Feature Proposal Report — mis finanzas

**Date:** 2026-05-24  
**Status:** Draft  
**Scope:** 12 feature proposals organized by priority tier for the family finance tracker

---

## Current State Summary

The app is a Chilean personal finance tracker with four screens (Dashboard, Transacciones, Cuentas, Configuración), bank sync via `open-banking-chile`, and a Prisma+SQLite data model with three tables: `Account`, `Category`, `Transaction`. 

**Already implemented:** Dashboard with heatmap + donut chart, transaction list with search/filters, category reassignment (inline popover), transaction notes, shared expense tracking (Familiar/Devuelto flags), mobile-responsive design (bottom nav, card layout), configurable Docker port for multi-instance deployment, hide/ignore accounts (schema-level, UI toggle pending full query filtering).

**Key gaps identified:** No budgeting, no recurring transaction detection, no date-range filtering, no data export, no spending trends over time, limited auto-categorization, no manual transaction entry, hidden account queries not wired up in all pages.

---

## Tier 1 — High Impact / Low Effort

### 1. Date Range Filter on Transactions

**Description:** Add a date range filter (month picker or start/end date inputs) to the Transacciones page. Currently the page loads *all* transactions ever and lets users filter by account, category, and shared status — but not by date. For a family with months of bank sync data, scrolling through hundreds of transactions without date filtering makes the page unwieldy. A month-picker dropdown (defaulting to the current month) would immediately reduce cognitive load and make summary cards (Gastos, Ingresos, Pendiente Devolución) meaningful for a specific time window rather than the all-time aggregate.

**Effort:** S  
**Key files:**
- `src/app/transacciones/TransaccionesClient.tsx` — add month/date filter state, filter logic in the `filtered` useMemo
- `src/app/transacciones/page.tsx` — optionally move date filtering server-side for performance

**Dependencies:** None

---

### 2. Apply Hidden Account Filtering to All Queries

**Description:** The `hidden` boolean field was added to the Account schema (spec approved, migration applied), but the Dashboard, Cuentas, and Transacciones page queries do not yet filter by `hidden: false`. This means hidden accounts still appear in the balance total, account pills, account grid, and transaction lists. Wiring up `where: { hidden: false }` to all non-config queries and adding the eye toggle button in the Config panel would complete this feature. The spec is already fully written — this is pure implementation.

**Effort:** S  
**Key files:**
- `src/app/page.tsx` — add `where: { hidden: false }` to account + transaction queries
- `src/app/cuentas/page.tsx` — add `where: { hidden: false }`
- `src/app/transacciones/page.tsx` — filter accounts and transactions by hidden status
- `src/app/config/actions.ts` — add `toggleAccountVisibility` server action
- `src/app/config/ConfigClient.tsx` — add eye toggle button per account row

**Dependencies:** None

---

### 3. Manual Transaction Entry

**Description:** Allow users to add transactions manually without bank sync. This is critical for cash expenses (common in Chile — ferias, street food, colectivos), payments from bank accounts not yet supported by the scraper, and family members who prefer manual tracking. The form would include date, description, amount, account, and category — all fields that already exist in the schema. A floating "+" button on the Transacciones page or a form in Config would trigger a create dialog. The server action mirrors the existing `createAccount`/`createCategory` pattern.

**Effort:** S  
**Key files:**
- `src/app/transacciones/actions.ts` — add `createTransaction` server action
- `src/app/transacciones/TransaccionesClient.tsx` — add "Agregar" button + create form/modal
- No schema changes needed

**Dependencies:** None

---

### 4. Improved Auto-Categorization Rules

**Description:** The sync route's `guessCategory()` function has a basic regex map of ~10 categories with Chilean-specific keywords. However, it misses many common merchants (e.g., Cornershop maps to Transporte because of "Copec" in the regex; Mercado Libre maps to Hogar). Add a richer keyword list, allow user-defined category rules in the database (a new `CategoryRule` model with `pattern` and `categoryId`), and apply user rules first before falling back to defaults. This would dramatically reduce the manual re-categorization burden after each bank sync — the #1 friction point for regular users.

**Effort:** M  
**Key files:**
- `prisma/schema.prisma` — add `CategoryRule` model (pattern: String, categoryId: Int)
- `src/app/api/sync/route.ts` — load user rules, apply before defaults
- `src/app/config/ConfigClient.tsx` — add rule management UI in Categorías tab
- `src/app/config/actions.ts` — add CRUD actions for rules

**Dependencies:** None

---

## Tier 2 — High Impact / Medium Effort

### 5. Monthly Budget Targets

**Description:** Let users set a monthly spending budget per category (e.g., Supermercado: $200.000, Restaurant: $80.000) and show progress on the Dashboard. This is the #1 feature personal finance apps offer that mis finanzas lacks. The Dashboard's category donut section would gain progress bars showing actual vs. budgeted. An alert badge could appear when a category exceeds 80% or 100%. For a family use case, budgets create accountability and conversation around spending habits. Requires a new `Budget` model with `categoryId`, `amount`, and `month` fields.

**Effort:** M  
**Key files:**
- `prisma/schema.prisma` — add `Budget` model (categoryId, monthlyAmount, effectiveFrom)
- `src/app/config/ConfigClient.tsx` — add budget management UI (set amounts per category)
- `src/app/config/actions.ts` — CRUD for budgets
- `src/app/page.tsx` — fetch budgets, render progress bars alongside category donut
- New migration

**Dependencies:** None

---

### 6. Spending Trends / Monthly Comparison Chart

**Description:** Add a new section to the Dashboard (or a dedicated `/reportes` page) showing spending trends over the last 6-12 months. Render a bar chart where each bar is a month's total spending, with the current month highlighted. Optionally break each bar into category segments (stacked bar chart). This gives users the "big picture" that the current month-focused dashboard doesn't provide — are they spending more or less over time? The `comparisonText` on the hero already compares current vs. previous month, but there's no visual trend. This would use data already in the database; no schema changes needed.

**Effort:** M  
**Key files:**
- `src/app/page.tsx` — add query for last 12 months of expenses, render bar chart component
- New component: `src/components/monthly-trend-chart.tsx`
- No schema changes

**Dependencies:** None

---

### 7. Recurring Transaction Detection

**Description:** Automatically detect recurring transactions (subscriptions, fixed bills) by analyzing transaction patterns — same description + similar amount repeating monthly. Surface these on the Dashboard as a "Gastos fijos" card showing monthly committed spending (Netflix, Spotify, Entel, VTR, etc.). This helps families understand their fixed vs. discretionary spending without any manual tagging. The detection could run client-side over the loaded transaction data, or as a background analysis during sync. A `isRecurring` boolean or a separate `RecurringExpense` model could persist the detection.

**Effort:** M  
**Key files:**
- `prisma/schema.prisma` — optionally add `RecurringExpense` model or `isRecurring` flag on Transaction
- `src/app/page.tsx` — detect patterns, render "Gastos fijos" summary card
- `src/app/api/sync/route.ts` — optionally run detection after import
- New component: `src/components/recurring-expenses-card.tsx`

**Dependencies:** None

---

### 8. Data Export (CSV / PDF)

**Description:** Let users export their transaction data as CSV (for spreadsheet analysis) or a simple PDF report (for printing/archiving). Add an "Exportar" button on the Transacciones page that exports the current filtered view. For the family use case, this enables sharing data between family members who use separate instances, feeding data into external tools (Google Sheets), and keeping offline records. CSV export is straightforward (generate on the server, return as download); PDF would use a lightweight library like `jspdf` or server-rendered HTML-to-PDF.

**Effort:** M (CSV: S, PDF: M)  
**Key files:**
- `src/app/api/export/route.ts` — new API route for CSV/PDF generation
- `src/app/transacciones/TransaccionesClient.tsx` — add "Exportar" button in toolbar
- `package.json` — optionally add PDF library dependency

**Dependencies:** None

---

## Tier 3 — Nice to Have

### 9. Category Merge & Delete with Reassignment

**Description:** Currently categories can be created but not deleted or merged. If a user creates a duplicate category or wants to consolidate (e.g., merge "Restaurant" and "Comida"), there's no way to do it without direct database manipulation. Add a "merge into" action that reassigns all transactions from one category to another, then deletes the source category. Also add a simple delete with a confirmation showing how many transactions would be affected. The config Categorías panel already shows transaction counts per category, making this a natural extension.

**Effort:** S  
**Key files:**
- `src/app/config/actions.ts` — add `deleteCategory` and `mergeCategories` server actions
- `src/app/config/ConfigClient.tsx` — add delete button + merge UI per category

**Dependencies:** None

---

### 10. Transaction Pagination Server-Side

**Description:** The Transacciones page currently loads *all* transactions from the database into memory and paginates client-side. For a family with years of data across multiple bank accounts, this will eventually degrade performance. Move to server-side pagination with `skip`/`take` on the Prisma query, passing page number as a URL search param. Filters would also move server-side. This is a performance optimization that becomes critical as the dataset grows beyond ~5,000 transactions.

**Effort:** M  
**Key files:**
- `src/app/transacciones/page.tsx` — accept search params, apply server-side pagination and filters
- `src/app/transacciones/TransaccionesClient.tsx` — replace client-side filtering with URL-based navigation
- No schema changes

**Dependencies:** Feature #1 (Date Range Filter) should ideally be implemented simultaneously

---

### 11. Dashboard Month Selector

**Description:** The Dashboard currently shows only the current month's data with no way to look at previous months. Add a month/year picker to the Dashboard hero section so users can review historical spending, category breakdowns, and heatmaps for any past month. The data already exists in SQLite — it's just the query parameters that are hardcoded to `now()`. This would reuse the same `getDashboardData()` function but with configurable month/year parameters passed as URL search params.

**Effort:** S  
**Key files:**
- `src/app/page.tsx` — accept `month`/`year` search params, pass to `getDashboardData()`
- Add month navigation arrows or dropdown in the hero section

**Dependencies:** None

---

### 12. Automatic Bank Sync Scheduling

**Description:** Currently bank sync is manual — the user must go to Config, enter credentials, and click "Sincronizar." For a family running the app on a home server 24/7 via Docker, automatic daily or weekly syncs would keep data fresh without manual intervention. This requires securely storing bank credentials (encrypted at rest in SQLite or a separate secrets file) and a cron-like scheduler (e.g., `node-cron` or a Docker cron sidecar). The sync would run the same `/api/sync` logic. A Config UI would let users enable/disable auto-sync per bank and set the schedule.

**Effort:** L  
**Key files:**
- `prisma/schema.prisma` — add `BankCredential` model (bankId, encryptedRut, encryptedPassword, schedule, lastSyncAt)
- New: `src/lib/scheduler.ts` — cron scheduling logic
- `src/app/config/ConfigClient.tsx` — auto-sync toggle + schedule UI
- `src/app/config/actions.ts` — save/update credentials
- `src/app/api/sync/route.ts` — refactor to support scheduled invocation
- Security: encryption/decryption module for credentials

**Dependencies:** None, but high-risk due to credential storage

---

## Priority Matrix

| # | Feature | Tier | Effort | Impact |
|---|---------|------|--------|--------|
| 1 | Date Range Filter | 1 | S | High |
| 2 | Hidden Account Filtering | 1 | S | High |
| 3 | Manual Transaction Entry | 1 | S | High |
| 4 | Auto-Categorization Rules | 1 | M | High |
| 5 | Monthly Budget Targets | 2 | M | High |
| 6 | Spending Trends Chart | 2 | M | Medium |
| 7 | Recurring Transaction Detection | 2 | M | Medium |
| 8 | Data Export (CSV/PDF) | 2 | M | Medium |
| 9 | Category Merge & Delete | 3 | S | Low |
| 10 | Server-Side Pagination | 3 | M | Low (until scale) |
| 11 | Dashboard Month Selector | 3 | S | Medium |
| 12 | Auto Sync Scheduling | 3 | L | Medium |

---

## Recommended Implementation Order

1. **Hidden Account Filtering** (#2) — spec already written, pure implementation
2. **Date Range Filter** (#1) — small change, big UX improvement
3. **Manual Transaction Entry** (#3) — unblocks non-bank-sync usage
4. **Dashboard Month Selector** (#11) — small and highly visible
5. **Monthly Budget Targets** (#5) — the killer feature for family accountability
6. **Spending Trends Chart** (#6) — complements budgets with context
7. **Auto-Categorization Rules** (#4) — reduces post-sync friction
8. **Data Export** (#8) — enables offline/external analysis
9. **Category Merge & Delete** (#9) — housekeeping
10. **Recurring Transaction Detection** (#7) — insightful but complex
11. **Server-Side Pagination** (#10) — only needed at scale
12. **Auto Sync Scheduling** (#12) — high effort, security concerns
