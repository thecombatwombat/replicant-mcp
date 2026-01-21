#!/bin/bash
# View and manage output cache
# Usage: cache-stats.sh [stats|get <id>|clear]
# Examples:
#   cache-stats.sh              # Show cache statistics (default)
#   cache-stats.sh stats        # Show cache statistics
#   cache-stats.sh get abc123   # Get cached entry by ID
#   cache-stats.sh clear        # Clear all cached entries

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CLI="node ${SCRIPT_DIR}/../../dist/cli.js"

# Default to stats if no args provided
if [ $# -eq 0 ]; then
    $CLI cache stats
else
    $CLI cache "$@"
fi
