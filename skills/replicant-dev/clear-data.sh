#!/bin/bash
# Clear app data on the selected device
# Usage: clear-data.sh <package>
# Example: clear-data.sh com.example.myapp

set -e
if [ -z "$1" ]; then
  echo "Usage: clear-data.sh <package>"
  echo "Example: clear-data.sh com.example.myapp"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CLI="node ${SCRIPT_DIR}/../../dist/cli.js"

$CLI adb clear "$1"
