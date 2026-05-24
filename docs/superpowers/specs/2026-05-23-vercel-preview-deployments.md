# Vercel Preview Deployments

**Date:** 2026-05-23  
**Status:** Draft  
**Goal:** Get automatic preview URLs on every PR via Vercel, while production stays on the home Debian server via Docker.

---

## 1. Overview

Connect the `mosoriob/finanzas-personales` GitHub repo to Vercel (free Hobby tier). Every pull request gets an automatic preview deployment with a seeded demo database. Production remains on the home server — Vercel is preview-only.

## 2. Scope

### In scope
- Vercel project creation and GitHub integration
- Build configuration for Next.js 16 + Prisma + SQLite
- Build-time database seeding (categories, accounts, sample transactions)
- Environment variable configuration
- `vercel-build` script in `package.json`

### Out of scope
- Production deployment (stays on Docker/Debian)
- Custom domain for previews (default `*.vercel.app` URLs are fine)
- Bank sync (`/api/sync`) — Puppeteer/Playwright not available on serverless
- Persistent data — previews use ephemeral seeded DB

## 3. Prerequisites

- Vercel account (free Hobby tier)
- `mosoriob/finanzas-personales` repo connected to Vercel via GitHub integration
- **The user must do this manually** — Vercel project creation and GitHub connection require interactive OAuth login at vercel.com

## 4. Technical Design

### 4.1 Build Script

Add a `vercel-build` script to `package.json` that handles the full pipeline:

```json
{
  "scripts": {
    "vercel-build": "prisma generate && prisma db push && prisma db seed && next build"
  }
}
```

**Why `vercel-build`?** Vercel automatically detects and runs this script instead of the default `build` script. This keeps the regular `build` script clean for Docker/production while adding Prisma steps only for Vercel.

**Why `db push` instead of `migrate deploy`?** `db push` applies the schema to a fresh SQLite file without needing a migrations history table. Since the preview DB is ephemeral (seeded fresh every deploy), there's no migration state to track.

### 4.2 Environment Variables (set in Vercel dashboard)

| Variable | Value | Scope |
|----------|-------|-------|
| `DATABASE_URL` | `file:./prisma/dev.db` | Preview + Development |

No production scope needed — Vercel is preview-only.

### 4.3 Prisma Output Path

Prisma generates its client into `node_modules/.prisma/client` by default. On Vercel, this is inside the build output and accessible to serverless functions. No path override needed.

### 4.4 `better-sqlite3` Native Binding

`better-sqlite3` has native C++ bindings that must compile for Vercel's Linux runtime. This is handled automatically by `npm ci` during Vercel's build step (runs on Linux). The existing `serverExternalPackages` in `next.config.ts` already lists the relevant packages.

### 4.5 `open-banking-chile` Dependency

This is a public GitHub repo (`github:kaihv/open-banking-chile#085faa...`). Vercel's build environment has `git` installed, so `npm ci` will clone it successfully. No token needed.

### 4.6 What Doesn't Work on Previews

- **`/api/sync`** — Requires Puppeteer/Playwright for bank scraping. Not available in Vercel serverless. This is fine — previews are for UI review, not bank syncing.
- **Data persistence** — SQLite writes within a single serverless invocation work, but data resets across cold starts. For PR review purposes, the seeded data is sufficient.

## 5. Implementation Steps

1. Add `vercel-build` script to `package.json`.
2. Optionally add a `.vercelignore` to skip unnecessary files (Docker artifacts, docs, `.worktrees`).
3. User connects repo to Vercel via vercel.com (manual step).
4. User sets `DATABASE_URL` env var in Vercel dashboard.
5. Open a test PR → verify preview URL works, seeded data shows up.

## 6. Verification

1. Preview URL loads without errors.
2. `/transacciones` page shows seeded transactions (3 months of Chilean expenses).
3. `/configuracion` shows all 24+ categories.
4. Category change (click badge → pick new category) works within a session.
5. Shared expense checkboxes toggle correctly.
6. No console errors related to Prisma or SQLite.

## 7. Files Changed

| File | Change |
|------|--------|
| `package.json` | Add `vercel-build` script |
| `.vercelignore` (new, optional) | Exclude Docker/docs/worktrees from deploy |
