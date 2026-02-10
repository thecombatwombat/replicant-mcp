#!/usr/bin/env bash
# Ensure beads daemon is running on session start.
#
# The daemon handles all syncing (commit + push + pull every 30s).
# We do NOT call bd sync here — it races with the daemon and causes
# lock contention that surfaces as SessionStart hook errors.
#
# Safe to run on every session — skips if bd or .beads/ not present.

set -euo pipefail

command -v bd >/dev/null || exit 0
[ -d .beads ] || exit 0

# Ensure daemon is running with auto-sync flags.
# "bd daemon start" is a no-op if already running (exits 0), so safe to call.
# Only restart if the running daemon is missing required flags — this is rare
# (misconfigured daemon) and worth the one-time restart.
DAEMON_FLAGS="--auto-commit --auto-push --auto-pull --interval 30s"
daemon_status="$(bd daemon status 2>&1)" || true
if echo "$daemon_status" | grep -q "running"; then
  # Running — only restart if missing a sync flag
  if ! echo "$daemon_status" | grep -q 'commit.*push.*pull'; then
    bd daemon stop . 2>/dev/null || true
    sleep 1
    bd daemon start $DAEMON_FLAGS 2>&1 || true
  fi
else
  bd daemon start $DAEMON_FLAGS 2>&1 || true
fi
