#!/usr/bin/env bash
#
# Idempotent setup script for the finanzas-personales Hermes fleet.
# Review the files under .planning/hermes-fleet/ before running this.
#
# Usage:
#   cd /Users/mosorio/repos/github.com/mosoriob/finanzas-personales
#   bash .planning/hermes-fleet/apply.sh
#
set -euo pipefail

REPO_DIR="/Users/mosorio/repos/github.com/mosoriob/finanzas-personales"
FLEET_DIR="$REPO_DIR/.planning/hermes-fleet"
PROFILES_DIR="$HOME/.hermes/profiles"
BOARD_SLUG="finanzas-personales"

# Source profile to clone from (inherits model/provider config).
# Using mint-orchestrator for opus profiles, mint-implementer for sonnet profiles.
OPUS_SOURCE="mint-orchestrator"
SONNET_SOURCE="mint-implementer"

echo "=== finanzas-personales fleet setup ==="

# ── 1. Create profiles (skip if already exist) ──────────────────────

create_profile() {
    local name="$1"
    local source="$2"
    if [ -d "$PROFILES_DIR/$name" ]; then
        echo "  [skip] Profile '$name' already exists."
    else
        echo "  [create] Profile '$name' (cloned from $source)..."
        hermes profile create "$name" --clone-from "$source" --no-alias
    fi
}

create_profile "fp-orchestrator" "$OPUS_SOURCE"
create_profile "fp-implementer"  "$SONNET_SOURCE"
create_profile "fp-reviewer"     "$SONNET_SOURCE"
create_profile "fp-devops"       "$SONNET_SOURCE"

# ── 2. Install SOUL.md files ────────────────────────────────────────

install_soul() {
    local name="$1"
    echo "  [soul] Installing SOUL.md for '$name'..."
    cp "$FLEET_DIR/souls/$name.md" "$PROFILES_DIR/$name/SOUL.md"
}

install_soul "fp-orchestrator"
install_soul "fp-implementer"
install_soul "fp-reviewer"
install_soul "fp-devops"

# ── 3. Set describe texts (routing signals for dispatcher) ──────────

echo ""
echo "=== Setting describe texts ==="

hermes profile describe fp-orchestrator --text \
    "Kanban orchestrator for finanzas-personales. Decomposes feature specs into implementation cards on the finanzas-personales board. Routes to fp-implementer, fp-reviewer, fp-devops. Never executes code. Next.js/Prisma/SQLite personal finance app."

hermes profile describe fp-implementer --text \
    "Full-stack implementer for finanzas-personales. Next.js 16 App Router, Prisma/SQLite, Tailwind CSS v4, TypeScript. Writes code and tests in git worktrees, pushes branches, opens PRs via gh CLI. TDD workflow. Base branch: main."

hermes profile describe fp-reviewer --text \
    "Code reviewer for finanzas-personales. Reviews PRs from fp-implementer. Checks code quality, test coverage, spec conformance. Next.js/Prisma/TypeScript stack. Approves or blocks with actionable feedback."

hermes profile describe fp-devops --text \
    "DevOps for finanzas-personales. Docker build, docker-compose deployment to home Debian server. Handles Dockerfile, compose config, deploy scripts, CI/CD. Base branch: main."

# ── 4. Set up Kanban board ──────────────────────────────────────────

echo ""
echo "=== Kanban board setup ==="

# Check if board exists
if hermes kanban boards list 2>/dev/null | grep -q "$BOARD_SLUG"; then
    echo "  [skip] Board '$BOARD_SLUG' already exists."
else
    echo "  [create] Creating board '$BOARD_SLUG'..."
    hermes kanban boards create "$BOARD_SLUG" --description \
        "Family-adapted personal finance app. Next.js + Prisma/SQLite. Deploy to home Debian server."
fi

# Switch to the new board
echo "  [switch] Switching active board to '$BOARD_SLUG'..."
hermes kanban boards switch "$BOARD_SLUG"

# ── 5. Configure orchestrator profile ───────────────────────────────

echo ""
echo "=== Orchestrator config ==="

hermes -p fp-orchestrator config set kanban.orchestrator_profile fp-orchestrator
hermes -p fp-orchestrator config set kanban.dispatch_in_gateway true
hermes -p fp-orchestrator config set kanban.dispatch_interval_seconds 60

# ── 6. Reminder about Discord ──────────────────────────────────────

echo ""
echo "=== Discord setup ==="

if [ -f "$FLEET_DIR/discord-target.txt" ]; then
    CHANNEL_ID=$(cat "$FLEET_DIR/discord-target.txt" | tr -d '[:space:]')
    echo "  Discord channel ID: $CHANNEL_ID"
    echo "  Setting allowed_channels on fp-orchestrator..."
    hermes -p fp-orchestrator config set discord.require_mention true
    hermes -p fp-orchestrator config set discord.allowed_channels "$CHANNEL_ID"
else
    echo "  [warn] No discord-target.txt found."
    echo "  To enable Discord notifications:"
    echo "    1. Create a Discord channel for this project."
    echo "    2. Get the numeric channel ID."
    echo "    3. echo '<CHANNEL_ID>' > $FLEET_DIR/discord-target.txt"
    echo "    4. Re-run this script."
fi

# ── 7. Summary ──────────────────────────────────────────────────────

echo ""
echo "=== Done ==="
echo ""
echo "Fleet created:"
echo "  fp-orchestrator  (opus)   — routes specs to cards"
echo "  fp-implementer   (sonnet) — writes code + tests"
echo "  fp-reviewer      (sonnet) — code review"
echo "  fp-devops        (sonnet) — docker deploy"
echo ""
echo "Board: $BOARD_SLUG"
echo ""
echo "Next steps:"
echo "  1. Set up Discord channel + discord-target.txt (if not done)."
echo "  2. Start the orchestrator gateway:"
echo "       hermes -p fp-orchestrator gateway start"
echo "  3. Brainstorm your first feature spec, then tell the orchestrator to ship it."
echo "  4. Watch the board:"
echo "       hermes kanban watch"
