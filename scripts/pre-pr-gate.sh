#!/usr/bin/env bash
# pre-pr-gate.sh — PreToolUse hook for Bash commands.
# Reads tool input from stdin, checks if command contains `gh pr create`.
# If so, runs complexity checks and blocks on violations.
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

# Check for in-progress beads issues (blocking, with trivial/ escape hatch)
if command -v bd &>/dev/null; then
  current_branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || true)
  if [[ "$current_branch" == trivial/* ]]; then
    echo "Skipping beads check for trivial/ branch."
    echo ""
  else
    beads_output=$(bd list --status=in_progress 2>/dev/null | head -1)
    if [ -z "$beads_output" ]; then
      echo "BLOCKED: No in-progress beads issues. Run \`bd create\` and \`bd update <id> --status=in_progress\` first."
      echo "Tip: Use a \`trivial/\` branch prefix to skip this check for minor fixes."
      exit 2
    fi
  fi
fi

# Run complexity check
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
output=$("$SCRIPT_DIR/check-complexity.sh" 2>&1) && exit 0

# Violations found — block PR creation
echo "BLOCKED: Code complexity violations detected. Fix before creating PR."
echo ""
echo "$output"
echo ""
echo "Run /create-pr which fixes violations automatically, or fix manually."
exit 2
