#!/usr/bin/env bash
# SessionStart hook - runs when a new Claude Code session starts

set -euo pipefail

# Auto-configure git hooks path if .githooks/ exists
if [ -d ".githooks" ]; then
  current_hooks=$(git config --get core.hooksPath 2>/dev/null || echo "")
  if [ "$current_hooks" != ".githooks" ]; then
    git config core.hooksPath .githooks
    echo "✓ Configured git hooks path: .githooks"
  fi
fi
