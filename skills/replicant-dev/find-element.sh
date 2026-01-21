#!/bin/bash
# Find UI elements by selector
# Usage: find-element.sh [--text "..." | --contains "..." | --id "..." | --class "..."]
# Options:
#   -t, --text <text>       Exact text match
#   -c, --contains <text>   Text contains match
#   -i, --id <resourceId>   Resource ID match
#   --class <className>     Class name match
#   --json                  Output as JSON
# Examples:
#   find-element.sh --text "Login"
#   find-element.sh --contains "Submit"
#   find-element.sh --id "com.example:id/button_login"
#   find-element.sh --class "android.widget.Button"

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CLI="node ${SCRIPT_DIR}/../../dist/cli.js"

$CLI ui find "$@"
