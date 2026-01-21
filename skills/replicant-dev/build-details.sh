#!/bin/bash
# Get full output from cached build/test result
# Usage: build-details.sh <cacheId> [--errors|--warnings]
# Examples:
#   build-details.sh build-a1b2c3
#   build-details.sh build-a1b2c3 --errors

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CLI="node ${SCRIPT_DIR}/../../dist/cli.js"

$CLI gradle details "$@"
