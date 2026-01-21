#!/bin/bash
# Input text to the focused element
# Usage: input-text.sh <text>
# Examples:
#   input-text.sh "hello world"
#   input-text.sh "user@example.com"

set -e
if [ -z "$1" ]; then
  echo "Usage: input-text.sh <text>"
  echo "Example: input-text.sh \"hello world\""
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CLI="node ${SCRIPT_DIR}/../../dist/cli.js"

$CLI ui input "$@"
