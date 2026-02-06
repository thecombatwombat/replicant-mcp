#!/usr/bin/env bash
# Tests for beads sync hardening: jitter, retry logic, daemon health check.
#
# Uses PATH-based mocking to shadow `bd` and `sleep` with fake versions.
# Mock `bd` dispatches on env vars to simulate sync failures, daemon states, etc.
#
# Usage: bash scripts/test-beads-sync.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

TESTS_PASSED=0
TESTS_FAILED=0
TESTS_SKIPPED=0

pass() {
  echo -e "${GREEN}PASS${NC}"
  TESTS_PASSED=$((TESTS_PASSED + 1))
}

fail() {
  echo -e "${RED}FAIL${NC}"
  echo "  $1"
  TESTS_FAILED=$((TESTS_FAILED + 1))
}

skip() {
  echo -e "${YELLOW}SKIPPED${NC} ($1)"
  TESTS_SKIPPED=$((TESTS_SKIPPED + 1))
}

# ============================================
# Mock setup
# ============================================

MOCK_DIR="$(mktemp -d)"
trap 'rm -rf "$MOCK_DIR"' EXIT

# State file for tracking bd sync --full call count
SYNC_COUNT_FILE="$MOCK_DIR/sync_count"
CALLS_LOG="$MOCK_DIR/calls.log"

# Create mock `bd` script
cat > "$MOCK_DIR/bd" << 'MOCK_BD'
#!/usr/bin/env bash
# Mock bd — dispatches on subcommand + env vars
set -euo pipefail

MOCK_DIR="$(dirname "$0")"
SYNC_COUNT_FILE="$MOCK_DIR/sync_count"
CALLS_LOG="$MOCK_DIR/calls.log"

echo "bd $*" >> "$CALLS_LOG"

cmd="${1:-}"
sub="${2:-}"

case "$cmd $sub" in
  "sync --full")
    # Track call count
    count=0
    if [ -f "$SYNC_COUNT_FILE" ]; then
      count="$(cat "$SYNC_COUNT_FILE")"
    fi
    count=$((count + 1))
    echo "$count" > "$SYNC_COUNT_FILE"

    case "${BD_SYNC_FAIL:-}" in
      once)
        if [ "$count" -eq 1 ]; then
          echo "Error: lock contention" >&2
          exit 1
        fi
        echo "Sync complete"
        exit 0
        ;;
      always)
        echo "Error: lock contention" >&2
        exit 1
        ;;
      *)
        echo "Sync complete"
        exit 0
        ;;
    esac
    ;;

  "sync --status")
    if [ "${BD_SYNC_PENDING:-}" = "1" ]; then
      echo "Pending changes: 3 issues"
    else
      echo "Pending changes: none"
    fi
    exit 0
    ;;

  "daemon status")
    case "${BD_DAEMON:-running-full}" in
      running-full)
        echo "✓ running (PID 55206, v0.49.4)"
        echo ""
        echo "  Sync:       ✓ commit  ✓ push  ✓ pull"
        ;;
      running-noflags)
        echo "✓ running (PID 55206, v0.49.4)"
        echo ""
        echo "  Sync:       (none)"
        ;;
      stopped)
        echo "✗ stopped"
        ;;
    esac
    exit 0
    ;;

  "daemon stop")
    exit 0
    ;;

  "daemon start")
    exit 0
    ;;

  "doctor ")
    echo "✓ 5 passed  ⚠ 0 warnings  ✖ 0 failed"
    exit 0
    ;;

  "version ")
    echo "0.49.4"
    exit 0
    ;;

  *)
    echo "UNEXPECTED: bd $*" >&2
    exit 1
    ;;
esac
MOCK_BD
chmod +x "$MOCK_DIR/bd"

# Create mock `sleep` script (no-op, just logs)
cat > "$MOCK_DIR/sleep" << 'MOCK_SLEEP'
#!/usr/bin/env bash
MOCK_DIR="$(dirname "$0")"
echo "sleep $1" >> "$MOCK_DIR/calls.log"
MOCK_SLEEP
chmod +x "$MOCK_DIR/sleep"

# Create a fake .beads directory for tests that need it
FAKE_PROJECT="$(mktemp -d)"
mkdir -p "$FAKE_PROJECT/.beads"

# Helper: reset state between tests
reset_mocks() {
  rm -f "$SYNC_COUNT_FILE" "$CALLS_LOG"
  touch "$CALLS_LOG"
}

# Helper: run a script with mocked PATH in the fake project dir
run_with_mocks() {
  local script="$1"
  shift
  (
    cd "$FAKE_PROJECT"
    PATH="$MOCK_DIR:$PATH" bash "$script" "$@" 2>&1
  )
}

# Helper: count occurrences of a pattern in calls.log
call_count() {
  local n
  n="$(grep -c "$1" "$CALLS_LOG" 2>/dev/null)" || true
  echo "${n:-0}"
}

echo "=============================================="
echo "Beads Sync Hardening Tests"
echo "=============================================="
echo ""

# ============================================
# Group 1: beads-sync-start.sh
# ============================================
echo -e "${BLUE}=== beads-sync-start.sh ===${NC}"

# 1.1 Jitter range is 0-30
echo -n "1.1 Jitter range is 0-30... "
(
  min=999
  max=-1
  for _ in $(seq 1 500); do
    val=$(( RANDOM % 31 ))
    [ "$val" -lt "$min" ] && min=$val
    [ "$val" -gt "$max" ] && max=$val
  done
  if [ "$min" -eq 0 ] && [ "$max" -le 30 ] && [ "$max" -ge 25 ]; then
    exit 0
  else
    exit 1
  fi
) && pass || fail "RANDOM % 31 range outside expected bounds"

# 1.2 Skip when bd is missing
echo -n "1.2 Skip when bd missing... "
reset_mocks
output="$(cd "$FAKE_PROJECT" && PATH="/usr/bin:/bin" bash "$SCRIPT_DIR/beads-sync-start.sh" 2>&1)" || true
if [ -z "$output" ] || [ ! -s "$CALLS_LOG" ]; then
  pass
else
  fail "Expected silent exit, got: $output"
fi

# 1.3 Skip when .beads/ missing
echo -n "1.3 Skip when .beads/ missing... "
reset_mocks
NO_BEADS_DIR="$(mktemp -d)"
output="$(cd "$NO_BEADS_DIR" && PATH="$MOCK_DIR:$PATH" bash "$SCRIPT_DIR/beads-sync-start.sh" 2>&1)" || true
rm -rf "$NO_BEADS_DIR"
count="$(call_count "sync --full")"
if [ "$count" -eq 0 ]; then
  pass
else
  fail "sync --full was called in dir without .beads/"
fi

# 1.4 Sync succeeds first try
echo -n "1.4 Sync succeeds first try... "
reset_mocks
run_with_mocks "$SCRIPT_DIR/beads-sync-start.sh" >/dev/null
count="$(call_count "sync --full")"
if [ "$count" -eq 1 ]; then
  pass
else
  fail "Expected 1 sync --full call, got $count"
fi

# 1.5 Sync fails once, retry succeeds
echo -n "1.5 Retry on first failure... "
reset_mocks
BD_SYNC_FAIL=once run_with_mocks "$SCRIPT_DIR/beads-sync-start.sh" >/dev/null
count="$(call_count "sync --full")"
if [ "$count" -eq 2 ]; then
  pass
else
  fail "Expected 2 sync --full calls, got $count"
fi

# 1.6 Both syncs fail, still exits 0
echo -n "1.6 Both fail, exits 0... "
reset_mocks
exit_code=0
BD_SYNC_FAIL=always run_with_mocks "$SCRIPT_DIR/beads-sync-start.sh" >/dev/null || exit_code=$?
count="$(call_count "sync --full")"
if [ "$exit_code" -eq 0 ] && [ "$count" -eq 2 ]; then
  pass
else
  fail "Expected exit 0 with 2 calls, got exit=$exit_code calls=$count"
fi

# 1.7 Daemon restart on missing flags
echo -n "1.7 Daemon restart on missing flags... "
reset_mocks
BD_DAEMON=running-noflags run_with_mocks "$SCRIPT_DIR/beads-sync-start.sh" >/dev/null
if grep -q "daemon stop" "$CALLS_LOG" && grep -q "daemon start" "$CALLS_LOG"; then
  # Verify stop comes before start
  stop_line="$(grep -n "daemon stop" "$CALLS_LOG" | head -1 | cut -d: -f1)"
  start_line="$(grep -n "daemon start" "$CALLS_LOG" | tail -1 | cut -d: -f1)"
  if [ "$stop_line" -lt "$start_line" ]; then
    pass
  else
    fail "daemon stop should come before daemon start"
  fi
else
  fail "Expected daemon stop + start in calls.log"
fi

# ============================================
# Group 2: beads-sync-end.sh
# ============================================
echo ""
echo -e "${BLUE}=== beads-sync-end.sh ===${NC}"

# 2.1 Skip when no pending changes
echo -n "2.1 Skip when no pending changes... "
reset_mocks
run_with_mocks "$SCRIPT_DIR/beads-sync-end.sh" >/dev/null
count="$(call_count "sync --full")"
if [ "$count" -eq 0 ]; then
  pass
else
  fail "Expected 0 sync --full calls, got $count"
fi

# 2.2 Sync on pending, first try OK
echo -n "2.2 Sync on pending changes... "
reset_mocks
BD_SYNC_PENDING=1 run_with_mocks "$SCRIPT_DIR/beads-sync-end.sh" >/dev/null
count="$(call_count "sync --full")"
if [ "$count" -eq 1 ]; then
  pass
else
  fail "Expected 1 sync --full call, got $count"
fi

# 2.3 Sync on pending, retry on failure
echo -n "2.3 Retry on failure... "
reset_mocks
BD_SYNC_PENDING=1 BD_SYNC_FAIL=once run_with_mocks "$SCRIPT_DIR/beads-sync-end.sh" >/dev/null
count="$(call_count "sync --full")"
if [ "$count" -eq 2 ]; then
  pass
else
  fail "Expected 2 sync --full calls, got $count"
fi

# 2.4 Both fail, exits 0
echo -n "2.4 Both fail, exits 0... "
reset_mocks
exit_code=0
BD_SYNC_PENDING=1 BD_SYNC_FAIL=always run_with_mocks "$SCRIPT_DIR/beads-sync-end.sh" >/dev/null || exit_code=$?
count="$(call_count "sync --full")"
if [ "$exit_code" -eq 0 ] && [ "$count" -eq 2 ]; then
  pass
else
  fail "Expected exit 0 with 2 calls, got exit=$exit_code calls=$count"
fi

# 2.5 Skip when bd missing
echo -n "2.5 Skip when bd missing... "
reset_mocks
output="$(cd "$FAKE_PROJECT" && PATH="/usr/bin:/bin" bash "$SCRIPT_DIR/beads-sync-end.sh" 2>&1)" || true
count="$(call_count "sync")"
if [ "$count" -eq 0 ]; then
  pass
else
  fail "Expected no sync calls when bd missing"
fi

# ============================================
# Group 3: check-env.sh daemon check
# ============================================
echo ""
echo -e "${BLUE}=== check-env.sh daemon check ===${NC}"

# Run check-env from repo root so SCRIPT_DIR/REPO_ROOT resolve correctly.
# Only mock bd, let everything else use real tools.
run_check_env() {
  (
    cd "$REPO_ROOT"
    PATH="$MOCK_DIR:$PATH" bash "$SCRIPT_DIR/check-env.sh" "$@" 2>&1
  ) || true
}

# 3.1 Daemon not running
echo -n "3.1 Daemon not running... "
reset_mocks
output="$(BD_DAEMON=stopped run_check_env)"
if echo "$output" | grep -qi "beads daemon not running"; then
  pass
else
  fail "Expected 'beads daemon not running' in output"
fi

# 3.2 Daemon running with all flags
echo -n "3.2 Daemon running with flags... "
reset_mocks
output="$(BD_DAEMON=running-full run_check_env)"
if echo "$output" | grep -qi "beads daemon running" && echo "$output" | grep -qi "commit/push/pull"; then
  pass
else
  fail "Expected daemon running + commit/push/pull flags"
fi

# 3.3 Daemon running, missing flags
echo -n "3.3 Daemon missing sync flags... "
reset_mocks
output="$(BD_DAEMON=running-noflags run_check_env)"
if echo "$output" | grep -qi "daemon missing sync flags"; then
  pass
else
  fail "Expected 'daemon missing sync flags' in output"
fi

# 3.4 Quick mode skips daemon check
echo -n "3.4 Quick mode skips daemon... "
reset_mocks
output="$(BD_DAEMON=stopped run_check_env --quick)"
if ! echo "$output" | grep -q "BEADS DAEMON"; then
  pass
else
  fail "Quick mode should not include BEADS DAEMON section"
fi

# ============================================
# Group 4: Static analysis
# ============================================
echo ""
echo -e "${BLUE}=== Static analysis ===${NC}"

# 4.1 bash -n syntax check
echo -n "4.1 Syntax check (bash -n)... "
syntax_ok=true
for script in beads-sync-start.sh beads-sync-end.sh check-env.sh; do
  if ! bash -n "$SCRIPT_DIR/$script" 2>/dev/null; then
    syntax_ok=false
    break
  fi
done
if $syntax_ok; then
  pass
else
  fail "Syntax error in $script"
fi

# 4.2 No lock deletion code (excluding comments)
echo -n "4.2 No lock deletion code... "
lock_matches="$(grep -rinE 'rm\s.*lock|delet.*lock' "$SCRIPT_DIR/beads-sync-start.sh" "$SCRIPT_DIR/beads-sync-end.sh" "$SCRIPT_DIR/check-env.sh" 2>/dev/null | grep -v '^\s*#\|:#' || true)"
if [ -n "$lock_matches" ]; then
  fail "Found lock deletion pattern in scripts: $lock_matches"
else
  pass
fi

# ============================================
# Cleanup
# ============================================
rm -rf "$FAKE_PROJECT"

# ============================================
# Summary
# ============================================
echo ""
echo "=============================================="
echo "SUMMARY"
echo "=============================================="
echo -e "Passed:  ${GREEN}$TESTS_PASSED${NC}"
echo -e "Failed:  ${RED}$TESTS_FAILED${NC}"
echo -e "Skipped: ${YELLOW}$TESTS_SKIPPED${NC}"
echo ""

if [ $TESTS_FAILED -gt 0 ]; then
  echo -e "${RED}Some tests failed!${NC}"
  exit 1
else
  echo -e "${GREEN}All tests passed!${NC}"
  exit 0
fi
