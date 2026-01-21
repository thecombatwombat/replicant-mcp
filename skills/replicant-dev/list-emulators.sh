#!/bin/bash
# List available AVDs and running emulators
# Usage: list-emulators.sh
# Example: list-emulators.sh

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CLI="node ${SCRIPT_DIR}/../../dist/cli.js"

$CLI emulator list
