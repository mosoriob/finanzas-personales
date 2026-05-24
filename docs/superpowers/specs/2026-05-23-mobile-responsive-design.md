# Design Spec: Mobile Responsive UI

**Date**: 2026-05-23  
**Status**: Approved  
**Scope**: Make the entire app usable on mobile devices (≥320px width)

---

## Motivation

The app was built desktop-first with almost zero mobile responsiveness. There is only a single `md:` Tailwind breakpoint in the entire codebase. On a 375px phone screen:

- The top navigation bar overflows (4 horizontal tabs + logo)
- Transactions page has a 4-column summary grid and a 6-column fixed-width table (~570px minimum)
- Accounts page has a 3-column grid that cramps cards to unreadable widths
- Config page has a 220px fixed sidebar leaving ~95px for content
- `px-10` padding everywhere eats 80px of a 375px screen

This spec addresses all of these by introducing a mobile-first responsive layout.

---

## Breakpoint Strategy

Use Tailwind's default breakpoints consistently:

| Token | Width | Usage |
|-------|-------|-------|
| (base) | 0–639px | Mobile phones — single column, bottom nav |
| `sm:` | ≥640px | Large phones / small tablets — 2-column where useful |
| `md:` | ≥768px | Tablets — switch to desktop nav, multi-column grids |
| `lg:` | ≥1024px | Desktop — full layouts as they exist today |

**Rule**: Every grid, flex layout, and padding value must have a base (mobile) class and at least one responsive upgrade.

---

## 1. Navigation — Bottom Tab Bar on Mobile

### Current
- Sticky top bar with logo (left) + 4 tab links (right)
- `px-10` padding, no wrapping, no mobile alternative

### Mobile (`<md:`)
- **Hide** the desktop top bar (`hidden md:flex` on the current nav)
- **Add a bottom tab bar** fixed to viewport bottom:
  - 4 tabs: Dashboard, Transacciones, Cuentas, Configuración
  - Each tab: icon + label stacked vertically
  - Active tab: violet icon + text, inactive: gray
  - Height: 64px, with safe-area padding for notched phones (`pb-[env(safe-area-inset-bottom)]`)
  - Background: white with subtle top border or shadow
- **Simplified top header** on mobile: just the logo (wallet icon + "mis finanzas"), no tabs
  - Smaller padding: `px-4 py-2`

### Desktop (`≥md:`)
- Keep the current top nav exactly as-is
- Hide the bottom tab bar (`hidden md:block` inverted)

### Icons for Bottom Tabs
Use Lucide React icons (already available via shadcn/ui):
- Dashboard: `LayoutDashboard`
- Transacciones: `ArrowLeftRight`
- Cuentas: `Wallet`
- Configuración: `Settings`

### Files to Modify
- `src/components/nav.tsx` — wrap current nav in `hidden md:flex`, reduce padding to `px-4 md:px-10`
- Create `src/components/mobile-bottom-nav.tsx` — bottom tab bar component
- `src/app/layout.tsx` — add bottom nav, reduce padding to `px-4 md:px-10`, add `pb-20 md:pb-8` to main content to clear bottom nav

---

## 2. Global Padding

### Current
- `layout.tsx`: `px-10 py-8`
- `nav.tsx`: `px-10 py-3.5`

### Change
- `layout.tsx`: `px-4 md:px-10 py-6 md:py-8 pb-24 md:pb-20`
- `nav.tsx`: `px-4 md:px-10 py-2.5 md:py-3.5`

---

## 3. Dashboard (`/`) — Mostly Fine, Minor Tweaks

The dashboard is the best-adapted page already. Changes needed:

### Hero Section
- Reduce font sizes slightly on mobile for the spending number
- Account pills already wrap (`flex-wrap`) — no change needed

### Heatmap
- Keep horizontal scroll on mobile (already has `overflow-x-auto`)
- Optionally: add a subtle scroll indicator (gradient fade on the right edge) so users know to scroll
- No structural change required

### Category Donut + Recent Transactions
- Already has `grid-cols-1 md:grid-cols-2` — ✅ no change needed

### Files to Modify
- `src/app/page.tsx` — minor font-size responsive classes on hero number

---

## 4. Transactions (`/transacciones`) — Major Rework

### Summary Bar
**Current**: `grid grid-cols-4 gap-4` — clips on mobile

**Mobile**: `grid grid-cols-2 gap-3` — 2×2 grid
**Desktop**: `grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4`

### Filters / Toolbar
**Current**: `flex flex-wrap gap-3` — wraps but awkward

**Mobile changes**:
- Search input: full width on mobile (`w-full md:w-auto md:min-w-[200px]`)
- Dropdowns: full width stacked below search on mobile
- Active filter pills: wrap naturally (already okay)

### Transaction List — Card Layout on Mobile
**Current**: 6-column `<table>` with fixed widths

**Mobile (`<md:`)**: Replace with a **card-based list**:
```
┌──────────────────────────────┐
│ 🛒  Líder Express       -$45.000 │
│ Visa Banco Chile · 15 may      │
│ [Supermercado]  [👥 Familiar]   │
└──────────────────────────────┘
```

Each transaction card shows:
- **Row 1**: Category emoji + description (left), amount (right, bold)
- **Row 2**: Account name + date (smaller, muted text)
- **Row 3** (if applicable): Category badge + shared/reimbursed badges

**Desktop (`≥md:`)**: Keep the current `<table>` exactly as-is

### Implementation Pattern
- Create `src/components/transaction-card.tsx` — mobile card component
- In `TransaccionesClient.tsx`:
  - Wrap `<table>` in `hidden md:block`
  - Add `<div className="md:hidden">` with card-based list
  - Both render the same data, just different layouts

### Pagination
- Current numbered buttons — keep as-is, they work on mobile

### Files to Modify
- `src/app/transacciones/TransaccionesClient.tsx` — summary grid, filters, table/card toggle
- Create `src/components/transaction-card.tsx`

---

## 5. Accounts (`/cuentas`) — Responsive Grid

### Current
`grid grid-cols-3 gap-5` — unreadable on mobile

### Change
`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5`

### Detail Panel
- On mobile: show below the grid (full width), same as current behavior but stacked
- No structural change needed since it already renders below on narrow viewports

### Files to Modify
- `src/app/cuentas/AccountsClient.tsx` — grid classes

---

## 6. Config (`/configuracion`) — Tab Layout on Mobile

### Current
- `flex` with `<aside className="w-[220px]">` sidebar + content area
- Categories grid: `grid grid-cols-2`

### Mobile (`<md:`)
- **Replace sidebar with horizontal top tabs** (Cuentas | Categorías)
- Full-width content below the tabs
- Categories grid: `grid grid-cols-1 sm:grid-cols-2`

### Desktop (`≥md:`)
- Keep the sidebar layout exactly as-is

### Implementation
- Wrap the sidebar `<aside>` in `hidden md:block`
- Add a `<div className="md:hidden flex gap-2 mb-4">` with horizontal tab buttons
- Both control the same `activeTab` state

### Form Inputs
- Ensure all form inputs are full-width on mobile
- Color picker swatches: keep as-is (6 swatches fit fine)

### Files to Modify
- `src/app/config/ConfigClient.tsx` — sidebar/tab toggle, grid classes

---

## 7. Touch & Accessibility Considerations

- All interactive elements (buttons, tabs, pills) must have a minimum tap target of **44×44px** on mobile
- Bottom nav tabs: 64px tall
- Transaction cards: generous vertical padding for easy tapping
- Filter dropdowns: at least 44px height on mobile
- No hover-only interactions (heatmap tooltips should work on tap too)

---

## 8. What NOT to Change

- **Heatmap rendering logic** — keep as-is with horizontal scroll
- **Donut chart** — already responsive
- **Color palette / design system** — no visual redesign, just layout
- **Data model / API / server actions** — zero backend changes
- **Desktop appearance** — the `≥md:` / `≥lg:` breakpoints must preserve the current look pixel-for-pixel

---

## Verification

1. Chrome DevTools responsive mode at 375×667 (iPhone SE), 390×844 (iPhone 14), 768×1024 (iPad)
2. All 4 pages render without horizontal overflow at 375px
3. Bottom nav appears on mobile, top nav appears on desktop
4. Transaction cards display correctly on mobile, table displays on desktop
5. Config tabs work on mobile, sidebar works on desktop
6. No regression on desktop layout (≥1024px)
7. `npm run build` passes with no errors

---

## Files Summary

| Action | File |
|--------|------|
| Modify | `src/components/nav.tsx` |
| Create | `src/components/mobile-bottom-nav.tsx` |
| Create | `src/components/transaction-card.tsx` |
| Modify | `src/app/layout.tsx` |
| Modify | `src/app/page.tsx` |
| Modify | `src/app/transacciones/TransaccionesClient.tsx` |
| Modify | `src/app/cuentas/AccountsClient.tsx` |
| Modify | `src/app/config/ConfigClient.tsx` |
