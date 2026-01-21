#!/bin/bash
# Select a device as the active target for ADB commands
# Usage: select-device.sh <deviceId>
# Example: select-device.sh emulator-5554

set -e
if [ -z "$1" ]; then
  echo "Usage: select-device.sh <deviceId>"
  echo "Example: select-device.sh emulator-5554"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CLI="node ${SCRIPT_DIR}/../../dist/cli.js"

$CLI adb select "$1"
