# Configurable Docker Port for Multi-Instance Deployment

**Date:** 2026-05-24
**Status:** Approved
**Goal:** Allow running multiple instances of the same docker-compose on one machine by making the host port configurable via environment variable.

## Motivation

The app is deployed via `docker-compose.yml` on a home Debian server. Currently the host port is hardcoded to `3000:3000`. To run multiple instances (e.g., one per family member, or staging + production), each instance needs a distinct host port. Docker will refuse to start a second instance if port 3000 is already bound.

## Current State

### docker-compose.yml
- Port mapping: `"3000:3000"` (hardcoded)
- Volume name: `finanzas-db` (hardcoded — also conflicts between instances)

### Dockerfile
- `ENV PORT=3000` — Next.js respects the `PORT` env var via `next start`
- `EXPOSE 3000`

### package.json
- `"start": "next start"` — Next.js reads `PORT` env var automatically

## Design

### 1. docker-compose.yml Changes

Use environment variable substitution with defaults:

```yaml
services:
  web:
    build: .
    image: finanzas-personales:local
    ports:
      - "${APP_PORT:-3000}:3000"
    env_file:
      - .env
    environment:
      DATABASE_URL: "file:/app/prisma/dev.db"
      NODE_ENV: production
    volumes:
      - finanzas-db:/app/prisma
    command: sh -c "npx prisma migrate deploy && npm run start"
    restart: unless-stopped

volumes:
  finanzas-db:
```

Key decisions:
- **Only the host port changes** (`${APP_PORT:-3000}:3000`). The container always listens on 3000 internally — no need to change the Dockerfile or Next.js config.
- **Default is 3000** so existing single-instance deployments work with zero config changes.
- The variable name `APP_PORT` avoids confusion with the internal `PORT` env var used by Next.js.

### 2. .env.example Update

Add `APP_PORT` with documentation:

```env
# Host port for docker-compose (default: 3000)
# Set different values to run multiple instances on the same machine
# APP_PORT=3000
```

### 3. Volume Isolation for Multi-Instance

For truly independent instances, users also need distinct volume names. Add a compose project name convention in the README/docs. Docker Compose uses the project name as a volume prefix, so running with different `-p` flags or `COMPOSE_PROJECT_NAME` values gives isolated volumes automatically:

```bash
# Instance 1
COMPOSE_PROJECT_NAME=finanzas-alice APP_PORT=3001 docker compose up -d

# Instance 2
COMPOSE_PROJECT_NAME=finanzas-bob APP_PORT=3002 docker compose up -d
```

### 4. Documentation

Add a "Multi-Instance Deployment" section to the README explaining:
- How to set `APP_PORT` in `.env` or as an env var
- How to use `COMPOSE_PROJECT_NAME` for volume isolation
- Example commands for running multiple instances

## Files Touched

| File | Change |
|---|---|
| `docker-compose.yml` | Replace `"3000:3000"` with `"${APP_PORT:-3000}:3000"` |
| `.env.example` | Add `APP_PORT` with comment |
| `README.md` | Add multi-instance deployment section |

## What NOT to Change

- **Dockerfile**: No changes needed. The container always listens on port 3000 internally.
- **Next.js config / package.json**: No changes. `next start` already reads `PORT` env var but we don't need to change the internal port.
- **Application code**: Zero app changes.

## Verification

1. `docker compose up -d` with no env vars → binds to port 3000 (backward compatible)
2. `APP_PORT=3001 docker compose up -d` → binds to port 3001
3. Run two instances with different `COMPOSE_PROJECT_NAME` and `APP_PORT` → both accessible, independent databases
