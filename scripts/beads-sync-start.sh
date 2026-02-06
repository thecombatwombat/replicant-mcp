#!/usr/bin/env bash
# Beads sync on session start.
#
# 1. Pull latest issues from all other agents/sessions (bd sync --full)
# 2. Ensure the daemon is running with auto-commit/push/pull
#    so issues stay fresh during long sessions (~30s staleness max)
#
# Safe to run on every session — skips if bd or .beads/ not present.

set -euo pipefail

# Skip if bd isn't installed or this isn't a beads project
command -v bd >/dev/null || exit 0
[ -d .beads ] || exit 0

# Pull latest from remote (other agents may have created/updated issues)
bd sync --full 2>&1 || true

# Ensure daemon is running with full sync flags.
# If it's already running correctly, this is a no-op.
if ! bd daemon status 2>&1 | grep -q 'commit.*push.*pull'; then
  bd daemon stop . 2>/dev/null || true
  sleep 1
  bd daemon start --auto-commit --auto-push --auto-pull --interval 30s 2>&1 || true
fi
