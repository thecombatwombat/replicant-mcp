#!/bin/bash
# Run unit or instrumented tests
# Usage: run-tests.sh [options]
# Examples:
#   run-tests.sh
#   run-tests.sh --type instrumented
#   run-tests.sh --module :feature:login

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CLI="node ${SCRIPT_DIR}/../../dist/cli.js"

$CLI gradle test "$@"
