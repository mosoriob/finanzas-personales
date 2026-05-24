# Describe Texts

Exact strings for `hermes profile describe <name> --text "..."`.
The dispatcher reads these to route Kanban cards to the right profile.

## fp-orchestrator

```
Kanban orchestrator for finanzas-personales. Decomposes feature specs into implementation cards on the finanzas-personales board. Routes to fp-implementer, fp-reviewer, fp-devops. Never executes code. Next.js/Prisma/SQLite personal finance app.
```

## fp-implementer

```
Full-stack implementer for finanzas-personales. Next.js 16 App Router, Prisma/SQLite, Tailwind CSS v4, TypeScript. Writes code and tests in git worktrees, pushes branches, opens PRs via gh CLI. TDD workflow. Base branch: main.
```

## fp-reviewer

```
Code reviewer for finanzas-personales. Reviews PRs from fp-implementer. Checks code quality, test coverage, spec conformance. Next.js/Prisma/TypeScript stack. Approves or blocks with actionable feedback.
```

## fp-devops

```
DevOps for finanzas-personales. Docker build, docker-compose deployment to home Debian server. Handles Dockerfile, compose config, deploy scripts, CI/CD. Base branch: main.
```
