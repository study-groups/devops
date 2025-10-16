#!/usr/bin/env bash
# Simple comprehensive return statement finder

TETRA_ROOT="${TETRA_SRC:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"

echo "Finding all return statements in $TETRA_ROOT"
echo "=============================================="
echo ""

# Find all .sh files and grep for return
find "$TETRA_ROOT" -type f -name "*.sh" ! -path "*/node_modules/*" -exec grep -Hn "return" {} \; 2>/dev/null | \
  grep -v "^Binary" | \
  sort | \
  awk -F: '{
    # Color the filename
    printf "\033[0;36m%s\033[0m:\033[0;33m%s\033[0m: %s\n", $1, $2, substr($0, index($0,$3))
  }'

echo ""
echo "=============================================="
echo "SUMMARY"
echo "=============================================="

total=$(find "$TETRA_ROOT" -type f -name "*.sh" ! -path "*/node_modules/*" -exec grep -l "return" {} \; 2>/dev/null | wc -l)
returns=$(find "$TETRA_ROOT" -type f -name "*.sh" ! -path "*/node_modules/*" -exec grep -h "return" {} \; 2>/dev/null | wc -l)

echo "Files with return statements: $total"
echo "Total return statements: $returns"
echo ""
echo "To save to a file:"
echo "  $0 > return_analysis.txt 2>&1"
