#!/bin/bash
# Build an Android APK
# Usage: build-apk.sh [variant]
# Default variant: debug
# Examples:
#   build-apk.sh
#   build-apk.sh release

set -e
VARIANT="${1:-debug}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CLI="node ${SCRIPT_DIR}/../../dist/cli.js"

case "$VARIANT" in
  debug)   $CLI gradle build -o assembleDebug ;;
  release) $CLI gradle build -o assembleRelease ;;
  bundle)  $CLI gradle build -o bundle ;;
  *)       echo "Unknown variant: $VARIANT"; exit 1 ;;
esac
