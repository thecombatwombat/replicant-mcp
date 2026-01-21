#!/bin/bash
# Take a screenshot of the current screen
# Usage: screenshot.sh [output-path]
# If no path is provided, saves to screenshot-<timestamp>.png
# Examples:
#   screenshot.sh
#   screenshot.sh ./screenshots/login-screen.png
#   screenshot.sh /tmp/debug.png

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CLI="node ${SCRIPT_DIR}/../../dist/cli.js"

$CLI ui screenshot "$@"
