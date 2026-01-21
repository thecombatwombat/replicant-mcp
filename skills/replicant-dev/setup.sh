#!/bin/bash
# Post-install setup for replicant-dev skill
# Run this once after installing via plugin marketplace

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLUGIN_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

echo "Setting up replicant-dev skill..."
echo "Plugin root: ${PLUGIN_ROOT}"

cd "${PLUGIN_ROOT}"

echo "Installing dependencies..."
npm install

echo "Building CLI..."
npm run build

echo ""
echo "Setup complete! The replicant-dev skill is ready to use."
