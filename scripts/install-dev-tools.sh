#!/usr/bin/env bash
# Install development tools (bd, gh) for Claude Code remote environments.
# Safe to re-run — skips tools that are already installed and at the right version.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TOOL_VERSIONS="$REPO_ROOT/.tool-versions"

read_version() {
  local tool="$1"
  if [ ! -f "$TOOL_VERSIONS" ]; then
    echo "ERROR: .tool-versions not found at $TOOL_VERSIONS" >&2
    exit 1
  fi
  grep "^${tool} " "$TOOL_VERSIONS" | awk '{print $2}'
}

BD_VERSION="$(read_version bd)"
GH_VERSION="$(read_version gh)"
INSTALL_DIR="/usr/local/bin"
ARCH="$(uname -m)"

case "$ARCH" in
  x86_64)  ARCH_SUFFIX="amd64" ;;
  aarch64) ARCH_SUFFIX="arm64" ;;
  *)       echo "Unsupported architecture: $ARCH"; exit 1 ;;
esac

install_bd() {
  if command -v bd &>/dev/null && [[ "$(bd version 2>&1)" == *"$BD_VERSION"* ]]; then
    echo "bd $BD_VERSION already installed"
    return
  fi

  echo "Installing bd $BD_VERSION..."
  local url="https://github.com/steveyegge/beads/releases/download/v${BD_VERSION}/beads_${BD_VERSION}_linux_${ARCH_SUFFIX}.tar.gz"
  local tmp
  tmp="$(mktemp -d)"
  curl -fsSL -o "$tmp/beads.tar.gz" "$url"
  tar xzf "$tmp/beads.tar.gz" -C "$tmp"
  cp "$tmp/bd" "$INSTALL_DIR/bd"
  chmod +x "$INSTALL_DIR/bd"
  rm -rf "$tmp"
  echo "bd $BD_VERSION installed"
}

install_gh() {
  if command -v gh &>/dev/null && [[ "$(gh version 2>&1)" == *"$GH_VERSION"* ]]; then
    echo "gh $GH_VERSION already installed"
    return
  fi

  echo "Installing gh $GH_VERSION..."
  local url="https://github.com/cli/cli/releases/download/v${GH_VERSION}/gh_${GH_VERSION}_linux_${ARCH_SUFFIX}.tar.gz"
  local tmp
  tmp="$(mktemp -d)"
  curl -fsSL -o "$tmp/gh.tar.gz" "$url"
  tar xzf "$tmp/gh.tar.gz" -C "$tmp"
  cp "$tmp/gh_${GH_VERSION}_linux_${ARCH_SUFFIX}/bin/gh" "$INSTALL_DIR/gh"
  chmod +x "$INSTALL_DIR/gh"
  rm -rf "$tmp"
  echo "gh $GH_VERSION installed"
}

check_gh_token() {
  if [ -z "${GH_TOKEN:-}" ] && ! gh auth status &>/dev/null 2>&1; then
    echo ""
    echo "WARNING: gh is installed but not authenticated."
    echo "To enable PR creation, issue management, etc.:"
    echo ""
    echo "  1. Create a GitHub Personal Access Token:"
    echo "     https://github.com/settings/tokens?type=beta"
    echo "     -> 'Generate new token' -> scope to thecombatwombat/replicant-mcp"
    echo "     -> Permissions: Read/Write for Contents, Pull Requests, Issues"
    echo ""
    echo "  2. Add it to your Claude Code environment:"
    echo "     claude.ai/code -> environment settings -> Environment variables"
    echo "     Add: GH_TOKEN=github_pat_xxxx..."
    echo ""
  fi
}

init_bd() {
  # Skip if .beads/beads.db already exists (already initialized)
  if [ -f ".beads/beads.db" ]; then
    echo "bd already initialized"
    return
  fi

  # Only init if .beads/ directory exists (this is a beads-tracked repo)
  if [ -d ".beads" ]; then
    echo "Initializing bd for fresh clone..."
    bd init 2>&1 || echo "bd init failed (non-fatal)"
    git config beads.role maintainer
    echo "bd initialized"
  fi
}

install_bd
install_gh
init_bd
check_gh_token
