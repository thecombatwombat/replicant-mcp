#!/bin/bash
# Tap a UI element or coordinates
# Usage: tap-element.sh [--index N | --x X --y Y]
# Options:
#   -i, --index <n>   Tap element at index from last find results
#   -x, --x <x>       X coordinate (requires --y)
#   -y, --y <y>       Y coordinate (requires --x)
# Examples:
#   tap-element.sh --index 0
#   tap-element.sh --x 540 --y 960
#   tap-element.sh -i 2

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CLI="node ${SCRIPT_DIR}/../../dist/cli.js"

$CLI ui tap "$@"
