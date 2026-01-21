#!/bin/bash
# Dump the accessibility tree of the current screen
# Usage: dump-ui.sh [options]
# Options:
#   --json    Output as JSON
# Examples:
#   dump-ui.sh
#   dump-ui.sh --json

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CLI="node ${SCRIPT_DIR}/../../dist/cli.js"

$CLI ui dump "$@"
