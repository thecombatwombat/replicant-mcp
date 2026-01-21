#!/bin/bash
# Manage emulator snapshots (save, load, list, delete)
# Usage: snapshot.sh <action> -d <deviceId> [-n <name>]
# Examples:
#   snapshot.sh list -d emulator-5554
#   snapshot.sh save -d emulator-5554 -n my_snapshot
#   snapshot.sh load -d emulator-5554 -n my_snapshot
#   snapshot.sh delete -d emulator-5554 -n my_snapshot

set -e
if [ -z "$1" ]; then
  echo "Usage: snapshot.sh <action> -d <deviceId> [-n <name>]"
  echo "Actions: save, load, list, delete"
  echo "Options:"
  echo "  -d, --device <deviceId>  Target emulator device ID (required)"
  echo "  -n, --name <name>        Snapshot name (required for save/load/delete)"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CLI="node ${SCRIPT_DIR}/../../dist/cli.js"

$CLI emulator snapshot "$@"
