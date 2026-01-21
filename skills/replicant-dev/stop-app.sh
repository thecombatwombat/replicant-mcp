#!/bin/bash
# Force stop an app on the selected device
# Usage: stop-app.sh <package>
# Example: stop-app.sh com.example.myapp

set -e
if [ -z "$1" ]; then
  echo "Usage: stop-app.sh <package>"
  echo "Example: stop-app.sh com.example.myapp"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CLI="node ${SCRIPT_DIR}/../../dist/cli.js"

$CLI adb stop "$1"
