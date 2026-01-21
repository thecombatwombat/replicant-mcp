#!/bin/bash
set -e

SKILL_DIR="$HOME/.claude/skills"
SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "Installing Android Development skill..."

# Build if needed
if [ ! -f "$SCRIPT_DIR/dist/cli.js" ]; then
  echo "Building CLI..."
  cd "$SCRIPT_DIR"
  npm run build
fi

# Create skills dir if needed
mkdir -p "$SKILL_DIR"

# Remove old installation, symlink new
rm -rf "$SKILL_DIR/replicant-dev"
ln -s "$SCRIPT_DIR/skills/replicant-dev" "$SKILL_DIR/replicant-dev"

echo ""
echo "✓ Installed to $SKILL_DIR/replicant-dev"
echo "→ Restart Claude Code to activate"
