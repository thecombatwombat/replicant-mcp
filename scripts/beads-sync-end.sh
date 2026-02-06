#!/usr/bin/env bash
# Beads sync on session end.
#
# Push any pending issue changes to remote so the next session
# (local or remote) sees them. Only syncs if there are actual changes.
#
# Safe to run on every session — skips if bd or .beads/ not present,
# or if there's nothing to sync.

set -euo pipefail

# Skip if bd isn't installed or this isn't a beads project
command -v bd >/dev/null || exit 0
[ -d .beads ] || exit 0

# Only sync if there are pending changes.
# Retry once on lock contention — the daemon picks it up within 30s either way.
if ! bd sync --status 2>&1 | grep -q 'Pending changes: none'; then
  if ! bd sync --full 2>&1; then
    sleep $(( 2 + RANDOM % 5 ))
    bd sync --full 2>&1 || true
  fi
fi
