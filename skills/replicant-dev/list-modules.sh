#!/bin/bash
# List Gradle modules, variants, or tasks
# Usage: list-modules.sh [modules|variants|tasks]
# Default: modules

set -e
TYPE="${1:-modules}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CLI="node ${SCRIPT_DIR}/../../dist/cli.js"

$CLI gradle list -t "$TYPE"
