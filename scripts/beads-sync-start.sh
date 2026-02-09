#!/usr/bin/env bash
# Beads sync on session start — designed for 30-50 parallel agents.
#
# Strategy:
#   1. Random jitter (0-30s) to avoid thundering herd on sync
#   2. Try bd sync --full once. If locked, wait and retry once.
#   3. If still locked, skip — the daemon picks it up within 30s.
#   4. Ensure daemon is running (try start, don't stop/restart).
#
# We NEVER delete the sync lock. Lock contention is expected with
# many agents. Retries + daemon provide eventual consistency.
#
# Safe to run on every session — skips if bd or .beads/ not present.

set -euo pipefail

# Skip if bd isn't installed or this isn't a beads project
command -v bd >/dev/null || exit 0
[ -d .beads ] || exit 0

# Detect if running in parallel agent context or single interactive session
if [ -n "${AGENT_CONTEXT:-}" ]; then
  # Parallel agents: use jitter to avoid thundering herd
  sleep $(( RANDOM % 31 ))

  # Try sync. If another agent holds the lock, wait and retry once.
  if ! bd sync --full 2>&1; then
    sleep $(( 2 + RANDOM % 5 ))
    bd sync --full 2>&1 || true
  fi
else
  # Single interactive session: run sync in background, no blocking
  (
    sleep $(( RANDOM % 3 ))  # Short jitter for concurrent sessions
    bd sync --full 2>&1 || bd sync --full 2>&1 || true
  ) &
fi

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
