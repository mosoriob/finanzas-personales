# Coding Standards

The reviewer agent loads this file during code review via @.sandcastle/CODING_STANDARDS.md
so these standards are enforced during review without costing tokens during implementation.

This is a Next.js 16 (App Router) + React 19 + Prisma + TypeScript project. Styling is Tailwind v4.

## Style

- TypeScript everywhere. Avoid `any` and unchecked casts; let inference work, type the boundaries.
- Use named exports. Components are PascalCase, functions/variables are camelCase.
- Match the casing of the files you touch — components use both `PascalCase.tsx` and `kebab-case.tsx`; follow the directory's existing convention rather than introducing a new one.
- Keep `"use client"` boundaries tight: default to Server Components; only add `"use client"` when a component needs interactivity.
- Code must pass `npm run lint` (eslint-config-next) with no new warnings.

## Next.js / Data

- Mutations go through Server Actions in `actions.ts` files, not ad-hoc API routes, unless an external caller needs the endpoint.
- All database access goes through the shared Prisma client in `src/lib/db.ts`. Do not instantiate new `PrismaClient` instances.
- Validate user input at the action/route boundary with Zod before touching the database.
- Revalidate affected paths/tags after mutations so the UI reflects changes.

## Testing

- Tests live in `__tests__/` folders next to the code, named `*.test.ts(x)`, run with Vitest.
- Cover new or changed behavior, especially Server Actions and `src/lib` utilities. Test edge cases, not just the happy path.
- Use descriptive test names that state the expected behavior.
- Before committing, `npm run typecheck` and `npm run test` must both pass.

## Architecture

- Keep modules focused on a single responsibility. Pull reusable logic into `src/lib`.
- Prefer composition over inheritance; avoid premature abstraction for single-use code.
- Keep server-only concerns (DB, secrets) out of client components.
