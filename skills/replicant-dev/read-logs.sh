#!/bin/bash
# Read logcat from the selected device
# Usage: read-logs.sh [options]
# Options are passed through to the CLI logcat command
# Examples:
#   read-logs.sh
#   read-logs.sh --package com.example.myapp
#   read-logs.sh --level error --lines 50

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CLI="node ${SCRIPT_DIR}/../../dist/cli.js"

$CLI adb logcat "$@"
