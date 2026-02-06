#!/usr/bin/env bash
# pre-pr-gate.sh — PreToolUse hook for Bash commands.
# Reads tool input from stdin, checks if command contains `gh pr create`.
# If so, runs complexity checks and warns on violations.
# All other commands pass through unchanged.

set -euo pipefail

# Read the tool input from stdin
input=$(cat)

# Extract the command from the JSON input
command=$(echo "$input" | grep -o '"command"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*: *"//;s/"$//' || true)

# Only gate on gh pr create
if ! echo "$command" | grep -q 'gh pr create'; then
  exit 0
fi

# Run complexity check
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
output=$("$SCRIPT_DIR/check-complexity.sh" 2>&1) && exit 0

# Violations found — warn but allow (will be enforced by CI)
echo "WARNING: Code complexity violations detected. CI will enforce these."
echo ""
echo "$output"
echo ""
echo "Consider running /create-pr which fixes violations automatically."
exit 0
