# Hermes Fleet — finanzas-personales

## Overview

Autonomous development fleet for adapting the upstream `mis finanzas` app
(Chilean personal finance tracker) into a family-use, self-hosted version on a
home Debian server.

## Roster

| Profile           | Model          | Role                                       |
|-------------------|----------------|---------------------------------------------|
| fp-orchestrator   | claude-opus    | Decomposes specs → Kanban cards. Never executes. |
| fp-implementer    | claude-sonnet  | Writes code + tests in worktrees, pushes PRs.    |
| fp-reviewer       | claude-sonnet  | Reviews implementer PRs, approves or blocks.     |
| fp-devops         | claude-sonnet  | Docker build + deploy to Debian home server.     |

## Workflow

1. User brainstorms a feature spec (superpowers Phase 1) → spec lands in `docs/superpowers/specs/`.
2. User tells the orchestrator to ship it.
3. Orchestrator decomposes spec into Kanban cards on board `finanzas-personales`.
4. Implementer picks up cards, creates worktrees off `main`, writes code + tests, pushes branch, opens PR via `gh`.
5. Reviewer reviews the PR, approves or blocks with feedback.
6. Discord ping → user reviews PR on GitHub, approves.
7. On merge, devops deploys to Debian server.

## Branching Policy

- Base branch: **main** (this is a fork; upstream uses main).
- Feature branches: `feat/<slug>`, `fix/<slug>`, `chore/<slug>` off `main`.
- Worktrees: `.worktrees/<task-id>`.
- Never push directly to `main`. Always open a PR.
- Commits never indicate Claude/Anthropic authorship.

## Tech Stack

- Next.js 16 (App Router)
- Prisma + SQLite (local-first)
- Tailwind CSS v4
- TypeScript
- Docker + docker-compose for deployment

## Repo Path

`/Users/mosorio/repos/github.com/mosoriob/finanzas-personales`

## Board

`finanzas-personales`

## Discord Notifications

Channel ID stored in `.planning/hermes-fleet/discord-target.txt`.
Orchestrator auto-subscribes implementation/review/deploy cards.
