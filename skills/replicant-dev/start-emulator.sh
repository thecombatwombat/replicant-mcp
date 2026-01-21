#!/bin/bash
# Start an Android emulator by AVD name
# Usage: start-emulator.sh <avdName> [options]
# Examples:
#   start-emulator.sh Pixel_6_API_33
#   start-emulator.sh Pixel_6_API_33 --cold-boot
#   start-emulator.sh Pixel_6_API_33 --wipe-data

set -e
if [ -z "$1" ]; then
  echo "Usage: start-emulator.sh <avdName> [options]"
  echo "Options:"
  echo "  --cold-boot    Perform a cold boot (ignore snapshots)"
  echo "  --wipe-data    Wipe user data before starting"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CLI="node ${SCRIPT_DIR}/../../dist/cli.js"

$CLI emulator start "$@"
