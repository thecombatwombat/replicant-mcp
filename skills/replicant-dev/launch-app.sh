#!/bin/bash
# Launch an app on the selected device
# Usage: launch-app.sh <package>
# Example: launch-app.sh com.example.myapp

set -e
if [ -z "$1" ]; then
  echo "Usage: launch-app.sh <package>"
  echo "Example: launch-app.sh com.example.myapp"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CLI="node ${SCRIPT_DIR}/../../dist/cli.js"

$CLI adb launch "$1"
