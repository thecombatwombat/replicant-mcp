#!/bin/bash
# Uninstall an app from the selected device
# Usage: uninstall-app.sh <package>
# Example: uninstall-app.sh com.example.myapp

set -e
if [ -z "$1" ]; then
  echo "Usage: uninstall-app.sh <package>"
  echo "Example: uninstall-app.sh com.example.myapp"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CLI="node ${SCRIPT_DIR}/../../dist/cli.js"

$CLI adb uninstall "$1"
