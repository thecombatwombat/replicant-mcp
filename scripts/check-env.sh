#!/usr/bin/env bash
# Dev environment health checks for replicant-mcp.
# Outputs a structured report of issues found.
# Exit code: 0 = all good, 1 = warnings found.
#
# Usage:
#   scripts/check-env.sh          # full check
#   scripts/check-env.sh --quick  # fast subset for SessionStart

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TOOL_VERSIONS="$REPO_ROOT/.tool-versions"
QUICK=false
WARNINGS=0

if [[ "${1:-}" == "--quick" ]]; then
  QUICK=true
fi

warn() {
  echo "  ⚠  $1"
  WARNINGS=$((WARNINGS + 1))
}

ok() {
  echo "  ✓  $1"
}

# --- Tool versions ---
check_tool_versions() {
  echo ""
  echo "TOOL VERSIONS"

  if [ ! -f "$TOOL_VERSIONS" ]; then
    warn ".tool-versions file missing"
    return
  fi

  while IFS=' ' read -r tool expected; do
    [[ -z "$tool" || "$tool" == "#"* ]] && continue

    if ! command -v "$tool" &>/dev/null; then
      warn "$tool not installed (expected $expected)"
      continue
    fi

    installed="$("$tool" version 2>&1 || "$tool" --version 2>&1 || echo "unknown")"
    if [[ "$installed" == *"$expected"* ]]; then
      ok "$tool $expected"
    else
      warn "$tool version mismatch (want $expected, got: $installed)"
    fi
  done < "$TOOL_VERSIONS"
}

# --- Plugin version sync ---
check_plugin_version() {
  echo ""
  echo "PLUGIN SYNC"

  if ! command -v bd &>/dev/null; then
    return
  fi

  local bd_version
  bd_version="$(bd version 2>&1 | awk '{for(i=1;i<=NF;i++) if($i ~ /^[0-9]+\.[0-9]+/) {print $i; exit}}')" || true

  # Find installed_plugins.json (works on both macOS and Linux)
  local plugins_json=""
  for candidate in \
    "$HOME/.claude/plugins/installed_plugins.json" \
    "$HOME/.config/claude/plugins/installed_plugins.json"; do
    if [ -f "$candidate" ]; then
      plugins_json="$candidate"
      break
    fi
  done

  if [ -z "$plugins_json" ]; then
    ok "bd CLI $bd_version (plugin file not found — skipped)"
    return
  fi

  local plugin_version
  plugin_version="$(python3 -c "
import json, sys
with open('$plugins_json') as f:
    d = json.load(f)
for name, entries in d.get('plugins', {}).items():
    if 'beads' in name.lower():
        for e in entries:
            print(e.get('version', 'unknown'))
            sys.exit(0)
print('not-installed')
" 2>/dev/null)" || plugin_version="unknown"

  if [ "$plugin_version" = "not-installed" ]; then
    warn "beads plugin not installed (bd CLI is $bd_version)"
  elif [ "$plugin_version" = "$bd_version" ]; then
    ok "bd CLI $bd_version = plugin $plugin_version"
  else
    warn "bd CLI $bd_version != plugin $plugin_version — run: /plugin update beads@beads-marketplace"
  fi
}

# --- Beads health ---
check_beads() {
  echo ""
  echo "BEADS"

  if ! command -v bd &>/dev/null; then
    warn "bd not installed"
    return
  fi

  if [ ! -d "$REPO_ROOT/.beads" ]; then
    warn ".beads/ directory missing"
    return
  fi

  local doctor_output
  doctor_output="$(bd doctor 2>&1)" || true

  local summary_line passed warned failed
  summary_line="$(echo "$doctor_output" | grep -E '✓.*passed.*⚠.*warning|✓.*passed.*✖.*failed' || echo "")"
  passed="$(echo "$summary_line" | sed -n 's/.*✓ \([0-9]*\) passed.*/\1/p')"
  warned="$(echo "$summary_line" | sed -n 's/.*⚠ \([0-9]*\) warning.*/\1/p')"
  failed="$(echo "$summary_line" | sed -n 's/.*✖ \([0-9]*\) failed.*/\1/p')"
  passed="${passed:-0}"
  warned="${warned:-0}"
  failed="${failed:-0}"

  if [[ "$warned" -eq 0 && "$failed" -eq 0 ]]; then
    ok "bd doctor: $passed passed, no issues"
  else
    warn "bd doctor: $passed passed, $warned warnings, $failed failed"
    # Extract warning summaries
    echo "$doctor_output" | grep -A1 "^  ⚠\|^  ✖" | head -20 | while read -r line; do
      echo "     $line"
    done
  fi
}

# --- Git health ---
check_git() {
  echo ""
  echo "GIT"

  # Uncommitted changes
  local status
  status="$(git -C "$REPO_ROOT" status --porcelain 2>/dev/null)" || true
  if [ -z "$status" ]; then
    ok "Working tree clean"
  else
    local count
    count="$(echo "$status" | wc -l | tr -d ' ')"
    warn "$count uncommitted change(s)"
  fi

  # Branch sync
  local branch
  branch="$(git -C "$REPO_ROOT" branch --show-current 2>/dev/null)" || true
  local upstream_status
  upstream_status="$(git -C "$REPO_ROOT" status -sb 2>/dev/null | head -1)" || true
  if [[ "$upstream_status" == *"ahead"* ]]; then
    warn "Branch '$branch' has unpushed commits"
  elif [[ "$upstream_status" == *"behind"* ]]; then
    warn "Branch '$branch' is behind remote"
  else
    ok "Branch '$branch' in sync with remote"
  fi

  # Stale worktrees
  local worktrees
  worktrees="$(git -C "$REPO_ROOT" worktree list 2>/dev/null | grep -v "$REPO_ROOT " || true)"
  if [ -n "$worktrees" ]; then
    local wt_count
    wt_count="$(echo "$worktrees" | wc -l | tr -d ' ')"
    warn "$wt_count extra worktree(s) — consider cleanup"
  fi
}

# --- Build health (skip in quick mode) ---
check_build() {
  echo ""
  echo "BUILD"

  if [ ! -f "$REPO_ROOT/package.json" ]; then
    ok "No package.json (skipped)"
    return
  fi

  # Check if node_modules exists
  if [ ! -d "$REPO_ROOT/node_modules" ]; then
    warn "node_modules missing — run npm install"
    return
  fi

  ok "node_modules present"
}

# --- Run checks ---
echo "check-env: dev environment health"
echo "=================================="

check_tool_versions
check_git
check_plugin_version

if $QUICK; then
  # Quick mode: skip slow checks
  echo ""
  echo "  (quick mode — run /check-env for full check)"
else
  check_beads
  check_build
fi

echo ""
echo "────────────────────────────"
if [ $WARNINGS -eq 0 ]; then
  echo "✓ All checks passed"
  exit 0
else
  echo "⚠ $WARNINGS warning(s) found"
  exit 1
fi
