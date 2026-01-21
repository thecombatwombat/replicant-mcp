#!/bin/bash
# Stop a running Android emulator
# Usage: stop-emulator.sh <deviceId>
# Example: stop-emulator.sh emulator-5554

set -e
if [ -z "$1" ]; then
  echo "Usage: stop-emulator.sh <deviceId>"
  echo "Example: stop-emulator.sh emulator-5554"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CLI="node ${SCRIPT_DIR}/../../dist/cli.js"

$CLI emulator stop "$1"
