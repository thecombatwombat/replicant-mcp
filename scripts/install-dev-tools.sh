#!/usr/bin/env bash
# Install development tools (bd, gh) for Claude Code remote environments.
# Safe to re-run — skips tools that are already installed and at the right version.

set -euo pipefail

BD_VERSION="0.49.4"
GH_VERSION="2.67.0"
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

install_bd
install_gh
