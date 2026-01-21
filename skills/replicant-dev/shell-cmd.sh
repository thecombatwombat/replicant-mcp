#!/bin/bash
# Execute a shell command on the selected device
# Usage: shell-cmd.sh "<command>"
# Examples:
#   shell-cmd.sh "pm list packages"
#   shell-cmd.sh "dumpsys battery"
#   shell-cmd.sh "getprop ro.build.version.sdk"

set -e
if [ -z "$1" ]; then
  echo "Usage: shell-cmd.sh \"<command>\""
  echo "Example: shell-cmd.sh \"pm list packages\""
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CLI="node ${SCRIPT_DIR}/../../dist/cli.js"

$CLI adb shell "$1"
