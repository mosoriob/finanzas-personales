# Design Spec: mis finanzas

**Date**: 2026-04-11  
**Status**: Approved  
**Author**: Fernando  

---

## Project Overview

- **Name**: mis finanzas (lowercase, casual)
- **Tagline**: "tu plata, tu control"
- **Purpose**: Unify personal finances in one place with a beautiful interface
- **User**: Fernando, based in Chile, not a programmer
- **Privacy**: Runs locally, data never leaves the machine

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js (full-stack, single project) |
| Database | SQLite via Prisma (single file, zero config) |
| Styling | Tailwind CSS + shadcn/ui |
| Fonts | Caveat (logo/brand), DM Sans (UI) |
| Design system | "Airy Pastel" — clean, violet palette, rounded corners, soft backgrounds |

---

## Visual Identity

### Color Palette

- **Primary**: #6366f1 (indigo-500) → #a78bfa (violet-400) gradient
- **Heatmap gradient**: #f0edff (lightest) → #7c3aed (deepest)
- **Backgrounds**: Soft whites and light violet tints
- **Accent**: Violet shades for active states, badges, and highlights

### Typography

- **Logo/Brand**: Caveat (handwritten feel, casual tone)
- **UI**: DM Sans (clean, geometric, highly legible)

### Logo

- Wallet icon with violet gradient on a rounded square
- SVG files stored in `assets/logo/` (logo-full.svg, logo-icon.svg, logo-text.svg)
- Favicon uses the wallet icon SVG with violet gradient
- Reference `assets/logo/BRAND.md` for construction details (note: ignore orange/coral colors mentioned there; the app uses the Airy Pastel violet palette)

### Design Principles

- Rounded corners on all containers and interactive elements
- Soft drop shadows, no harsh borders
- Generous whitespace
- Violet as the single accent color family
- Spending is the protagonist — not balance

---

## Data Model

### Accounts

| Field | Type | Description |
|-------|------|-------------|
| name | string | e.g., "Visa Banco Chile" |
| type | enum | credit_card, checking, savings |
| bank | string | e.g., "Banco de Chile", "BancoEstado" |
| balance | integer | CLP amount |
| color | hex string | For visual differentiation in UI |

### Transactions

| Field | Type | Description |
|-------|------|-------------|
| date | Date | Transaction date |
| description | string | Bank description |
| amount | integer | CLP — positive = income, negative = expense |
| category | relation | FK to Category |
| account | relation | FK to Account |

### Categories (pre-loaded seed data)

| Name | Emoji |
|------|-------|
| Supermercado | 🛒 |
| Transporte | 🚗 |
| Entretenimiento | 🎬 |
| Salud | 💊 |
| Restaurant | 🍕 |
| Servicios | 📱 |
| Hogar | 🏠 |
| Educación | 📚 |
| Sueldo | 💰 |
| Transferencia | 🔄 |
| Otro | 📌 |

---

## Currency Format

- All amounts in CLP (Chilean Pesos)
- Display format: $XXX.XXX (dot as thousands separator, no decimals)
- Examples: $1.200.000, -$450.000, $3.500

---

## Screens

### 1. Dashboard (Home — `/`)

The dashboard is the landing screen and gives an at-a-glance view of the user's financial health, with spending as the protagonist.

**Hero section**:
- Big number: Total monthly spending (the main visual element)
- Small secondary line below: Total balance across all accounts

**Account pills**:
- Horizontally centered row of pill-shaped badges
- Each pill shows: account name, balance, and monthly spend for that account
- Colored left border matching the account's assigned color

**Heatmap**:
- GitHub-style yearly heatmap showing daily spending intensity
- Only past months are rendered (no empty future squares)
- Today's cell is highlighted with a distinct border
- Color scale uses the violet gradient: #f0edff (low) → #7c3aed (high)
- Hovering a cell shows the date and total spent that day

**Categories donut**:
- Pie/donut chart breaking down monthly spending by category
- Legend beside/below the chart showing: emoji, category name, amount, percentage
- Colors derived from the violet palette with enough contrast between slices

**Recent transactions**:
- List of the last 5 transactions
- Each row: category emoji, description, date, account name, amount
- Negative amounts in default text color, positive amounts highlighted

---

### 2. Transactions (`/transacciones`)

Full transaction history with search and filtering.

**Summary bar** (top):
- Total transaction count
- Total expenses (sum of negatives)
- Total income (sum of positives)
- All three values update dynamically as filters are applied

**Search**:
- Single text input that filters by description and account name
- Filters in real-time as the user types

**Filter dropdowns**:
- By account: dropdown listing all accounts
- By category: dropdown listing all categories
- Active filters shown as removable pills with an ✕ button to clear

**Table**:
- Columns: Date, Icon (category emoji), Description + Account, Category badge, Amount
- Row hover highlight
- Alternating subtle background colors for readability
- Amount column right-aligned

**Pagination**:
- Numbered page buttons at the bottom
- Shows current page indicator

---

### 3. Accounts (`/cuentas`)

Visual overview of each account with drill-down capability.

**Cards grid**:
- One card per account arranged in a responsive grid
- Each card shows:
  - Colored top stripe (account's assigned color)
  - Bank name
  - Account name
  - Account type (credit_card/checking/savings label)
  - Current balance
  - Monthly spend
  - Number of movements this month
- Click a card to select it and open the detail panel

**Detail panel**:
- Appears below or beside the grid when an account is selected
- Mini bar chart showing daily spending over the last 30 days
- List of that account's recent transactions (same format as dashboard)

---

### 4. Configuration (`/configuracion`)

Settings for managing accounts and categories.

**Sidebar navigation**:
- Two tabs: "Cuentas" and "Categorias"
- Vertical tab list on the left, content area on the right

**Cuentas tab**:
- Add account form:
  - Name (text input)
  - Bank (dropdown with common Chilean banks)
  - Type (dropdown: Cuenta Corriente, Tarjeta de Crédito, Cuenta de Ahorro)
  - Color (picker with 6 preset swatches)
- Existing accounts list:
  - Each row shows name, bank, type, color swatch
  - Edit button opens inline editing
  - Delete button with confirmation
- Toast notifications for create/edit/delete actions

**Categorias tab**:
- Add category form:
  - Name (text input)
  - Emoji (text input or picker)
- Grid of active categories:
  - Each cell shows emoji + name + transaction count using that category
- Toast notifications for create actions

---

## Navigation

- Sticky top navigation bar
- Left side: Logo (wallet icon + "mis finanzas" text + tagline "tu plata, tu control")
- Right side: Tab pills for each screen (Dashboard, Transacciones, Cuentas, Configuración)
- Active tab has violet background with white text
- Clicking the logo navigates back to Dashboard
- Navigation is always visible (sticky/fixed top)

---

## Responsive Behavior

- Primary target: Desktop (nav bar at top, full-width layouts)
- Mobile adaptation planned for later (bottom tab bar, stacked layouts)
- All layouts use flexible grids that collapse gracefully on smaller viewports

---

## Demo Data (Seed)

Three fictional accounts:

| Account | Bank | Type | Balance |
|---------|------|------|---------|
| Cuenta Corriente | Banco de Chile | checking | $1.200.000 |
| Visa Banco Chile | Banco de Chile | credit_card | -$450.000 |
| Cuenta Vista | BancoEstado | savings | $180.000 |

Approximately 150 transactions spanning 3 months with realistic Chilean merchants:
- Supermarkets: Líder, Jumbo, Santa Isabel
- Transport: Uber, Copec, Cornershop
- Entertainment: Netflix, Spotify, Steam
- Food: Rappi, PedidosYa, Starbucks
- Services: Entel, VTR, Enel
- Income: Monthly salary of $1.800.000

---

## Interactions & Behavior

- Search on Transactions page filters results live as the user types
- Filter dropdowns update the summary bar totals immediately
- Account card selection in the Accounts page loads the detail panel with that account's data
- All CRUD operations in Configuration show toast notifications (success/error)
- Heatmap cells show a tooltip on hover with date and amount
- Donut chart segments are hoverable to highlight the category
- Pagination in Transactions loads the next page without full-page reload

---

## Future Integration (Phase 2)

- **Library**: Open Banking Chile (github.com/kaihv/open-banking-chile)
- **Approach**: Web scraping based (not official API), requires Chrome + real bank credentials
- **Supported banks**: 10 Chilean banks including Banco de Chile, BancoEstado, Santander, BCI, Scotiabank, Itaú, Banco Falabella, Banco Ripley, Banco Security, Banco BICE
- **Reference**: See `docs/open-banking-chile-research.md` for full research report
- **Impact**: Will allow automatic transaction import instead of manual entry
- **Privacy**: Credentials stored locally only, scraping runs on user's machine

---

## File Structure (Planned)

```
finanzas-personales/
├── assets/
│   └── logo/
│       ├── logo-full.svg
│       ├── logo-icon.svg
│       ├── logo-text.svg
│       └── BRAND.md
├── docs/
│   ├── open-banking-chile-research.md
│   └── superpowers/specs/
│       └── 2026-04-11-finanzas-personales-design.md
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx              (Dashboard)
│   │   ├── transacciones/
│   │   │   └── page.tsx
│   │   ├── cuentas/
│   │   │   └── page.tsx
│   │   └── configuracion/
│   │       └── page.tsx
│   ├── components/
│   │   ├── ui/                   (shadcn components)
│   │   ├── nav.tsx
│   │   ├── heatmap.tsx
│   │   ├── donut-chart.tsx
│   │   ├── account-card.tsx
│   │   └── transaction-row.tsx
│   └── lib/
│       ├── db.ts                 (Prisma client)
│       ├── format.ts             (CLP formatting)
│       └── seed-data.ts
├── public/
│   └── favicon.svg
├── tailwind.config.ts
├── next.config.ts
├── package.json
└── tsconfig.json
```

---

## Key Design Decisions Summary

1. **Spending is the protagonist** — the hero number on the dashboard is monthly spending, not balance
2. **Heatmap shows only the past** — no wasted visual space on future months; today highlighted with a border
3. **Single accent color** — violet palette throughout for visual cohesion
4. **Local-first** — SQLite file, no network calls, complete privacy
5. **Pre-loaded categories** — sensible Chilean defaults so the app is useful immediately
6. **Demo data included** — seed script populates realistic data so the app feels alive on first run
7. **Four screens only** — simple navigation, no deep nesting, everything accessible in one click
8. **Functional interactions** — every filter, search, and selection actually works and updates the UI in real-time
