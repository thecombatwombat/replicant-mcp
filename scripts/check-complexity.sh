#!/usr/bin/env bash
# check-complexity.sh — Single source of truth for code complexity checks.
# Used by /check-complexity, /create-pr, pre-PR hook, and CI.
# Exits non-zero if any violations found.

set -euo pipefail

SRC_DIR="${1:-src}"
MAX_FILE_LINES=300
MAX_FUNCTION_LINES=60

# Colors (disabled if not a terminal)
if [ -t 1 ]; then
  RED='\033[0;31m'
  NC='\033[0m'
else
  RED=''
  NC=''
fi

# Collect all violations into an array
declare -a violations=()

report() {
  echo -e "${RED}VIOLATION:${NC} $1"
  violations+=("$1")
}

# Check 1: Files over MAX_FILE_LINES lines
while IFS= read -r file; do
  lines=$(wc -l < "$file" | tr -d ' ')
  if [ "$lines" -gt "$MAX_FILE_LINES" ]; then
    report "$file exceeds $MAX_FILE_LINES lines ($lines)"
  fi
done < <(find "$SRC_DIR" -name '*.ts' -not -path '*/node_modules/*' -not -name '*.test.ts' -not -name '*.d.ts')

# Check 2: Functions over MAX_FUNCTION_LINES lines
# Uses brace-depth tracking for accurate function boundary detection.
while IFS= read -r file; do
  awk_output=$(awk -v max="$MAX_FUNCTION_LINES" -v file="$file" '
    # Detect function start: exported/async functions, methods, arrow functions assigned to const
    /^[[:space:]]*(export )?(async )?function [a-zA-Z_]/ ||
    /^[[:space:]]*(private|protected|public) (readonly )?(async )?[a-zA-Z_]+\(/ {
      # Close previous function if tracked
      if (in_func && func_lines > max) {
        printf "%s:%s exceeds %d lines (%d)\n", file, func_name, max, func_lines
      }
      # Extract function name
      name = $0
      gsub(/^[[:space:]]*(export )?(async )?(function )?/, "", name)
      gsub(/^[[:space:]]*(private|protected|public) (readonly )?(async )?/, "", name)
      gsub(/[(<= ].*/, "", name)
      func_name = name
      func_lines = 0
      brace_depth = 0
      in_func = 0
      saw_open = 0
    }
    func_name != "" {
      func_lines++
      # Count braces on this line (naive but works for well-formatted TS)
      for (i = 1; i <= length($0); i++) {
        c = substr($0, i, 1)
        if (c == "{") { brace_depth++; saw_open = 1; in_func = 1 }
        if (c == "}") { brace_depth-- }
      }
      # Function ends when we return to depth 0 after seeing at least one open brace
      if (saw_open && brace_depth <= 0 && in_func) {
        if (func_lines > max) {
          printf "%s:%s exceeds %d lines (%d)\n", file, func_name, max, func_lines
        }
        func_name = ""
        in_func = 0
        saw_open = 0
      }
    }
    END {
      if (func_name != "" && in_func && func_lines > max) {
        printf "%s:%s exceeds %d lines (%d)\n", file, func_name, max, func_lines
      }
    }
  ' "$file")
  if [ -n "$awk_output" ]; then
    while IFS= read -r line; do
      report "$line"
    done <<< "$awk_output"
  fi
done < <(find "$SRC_DIR" -name '*.ts' -not -path '*/node_modules/*' -not -name '*.test.ts' -not -name '*.d.ts')

# Check 3: `as any` or `as unknown` casts
while IFS= read -r file; do
  matches=$(grep -n 'as any\b\|as unknown\b' "$file" 2>/dev/null || true)
  if [ -n "$matches" ]; then
    while IFS= read -r match; do
      line_num=$(echo "$match" | cut -d: -f1)
      report "$file:$line_num uses unsafe cast (as any/as unknown)"
    done <<< "$matches"
  fi
done < <(find "$SRC_DIR" -name '*.ts' -not -path '*/node_modules/*' -not -name '*.test.ts' -not -name '*.d.ts')

# Check 4: [key: string]: unknown index signatures
while IFS= read -r file; do
  matches=$(grep -n '\[key: string\]: unknown' "$file" 2>/dev/null || true)
  if [ -n "$matches" ]; then
    while IFS= read -r match; do
      line_num=$(echo "$match" | cut -d: -f1)
      report "$file:$line_num has loose index signature ([key: string]: unknown)"
    done <<< "$matches"
  fi
done < <(find "$SRC_DIR" -name '*.ts' -not -path '*/node_modules/*' -not -name '*.test.ts' -not -name '*.d.ts')

# Summary
count=${#violations[@]}
if [ "$count" -gt 0 ]; then
  echo ""
  echo "$count violation(s) found."
  exit 1
else
  echo "No complexity violations found."
  exit 0
fi
