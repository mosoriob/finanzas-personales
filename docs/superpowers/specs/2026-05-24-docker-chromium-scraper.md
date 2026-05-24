# Docker: Install Chromium for bank scraper

**Date:** 2026-05-24
**Status:** approved
**Bug:** The `/api/sync` route spawns a sidecar script that uses `open-banking-chile`,
which depends on `puppeteer-core`. Puppeteer-core does NOT bundle a browser — it
expects a system-installed Chrome/Chromium. The Docker runner stage
(`node:20-bookworm-slim`) has no browser, so the scraper fails with:

> No se encontró Chrome/Chromium. Instala Google Chrome o pasa chromePath en las opciones.

## Root Cause

The `open-banking-chile` library's `findChrome()` function searches these paths in order:
- `/usr/bin/google-chrome-stable`
- `/usr/bin/google-chrome`
- `/usr/bin/chromium-browser`
- `/usr/bin/chromium`
- `/snap/bin/chromium`

None exist in `node:20-bookworm-slim`.

## Fix

Install `chromium` and its runtime dependencies in the **runner** stage of the
Dockerfile. Chromium in Debian Bookworm is available via `apt-get install chromium`.

### Dockerfile changes (runner stage only)

Add before `COPY --from=builder`:

```dockerfile
# Chromium + runtime deps for the open-banking-chile scraper (puppeteer-core)
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
       chromium \
       fonts-liberation \
       libnss3 \
       libatk-bridge2.0-0 \
       libdrm2 \
       libxkbcommon0 \
       libgbm1 \
       libasound2 \
  && rm -rf /var/lib/apt/lists/*
```

This must run as root (before the `USER node` directive — which it already is in the
current Dockerfile order).

### Why `chromium` and not `google-chrome-stable`?

- `google-chrome-stable` is not in Debian's repos — it requires adding Google's apt
  source. `chromium` is in Debian Bookworm natively.
- `chromium` installs to `/usr/bin/chromium`, which is one of the paths
  `open-banking-chile`'s `findChrome()` checks.
- Smaller footprint (~200 MB vs ~350 MB for full Chrome).

### Security considerations

The container already runs headless with `--no-sandbox` and `--disable-setuid-sandbox`
(set by `open-banking-chile` DEFAULT_ARGS). Since the container runs as `node` user
(non-root) and the scraper is invoked only by authenticated API calls, this is
acceptable for self-hosted use.

## Files to change

1. `Dockerfile` — add `RUN apt-get install chromium ...` in the runner stage

## What NOT to change

- Do NOT modify `open-banking-chile` library code
- Do NOT add `chromium` to the builder stage (only needed at runtime)
- Do NOT switch to `puppeteer` (which auto-downloads Chrome) — the project
  deliberately uses `puppeteer-core` for smaller images
- Do NOT modify `docker-compose.yml`
- Do NOT modify `src/app/api/sync/route.ts`

## Verification

1. `docker compose build` completes successfully
2. `docker compose up -d` starts the container
3. `docker compose exec web chromium --version` prints a version
4. The `/api/sync` endpoint (POST with bankId, rut, password) no longer fails with
   the "Chrome not found" error (it may fail with auth errors if no valid bank
   credentials are provided, but the Chrome error must be gone)
