#!/bin/bash
# Install an APK on the selected device
# Usage: install-app.sh <apkPath>
# Example: install-app.sh app/build/outputs/apk/debug/app-debug.apk

set -e
if [ -z "$1" ]; then
  echo "Usage: install-app.sh <apkPath>"
  echo "Example: install-app.sh app/build/outputs/apk/debug/app-debug.apk"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CLI="node ${SCRIPT_DIR}/../../dist/cli.js"

$CLI adb install "$1"
