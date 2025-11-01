#!/usr/bin/env bash

# Test pager functionality

DEMO_DIR="$(dirname "${BASH_SOURCE[0]}")"
source "$DEMO_DIR/viewport.sh"

# Simulate a 24-line terminal
export LINES=24
export COLUMNS=80

update_viewport_dimensions

echo "=== Pager Test ==="
echo "Terminal: ${LINES}x${COLUMNS}"
echo "Content lines per page: ${VIEWPORT_CONTENT_LINES}"
echo ""

# Generate long content
long_content=""
for i in {1..50}; do
    long_content+="Line $i: This is test content for pager view\n"
done

echo "=== Truncated View ==="
# Store raw content first (mimics demo.sh behavior)
store_raw_content "$(echo -e "$long_content")"
truncated=$(truncate_content "$(echo -e "$long_content")")
echo "$truncated" | head -5
echo "..."
echo "$truncated" | tail -2
echo ""

echo "=== Pager Detection ==="
pager=$(detect_pager)
echo "Detected pager: $pager"
echo ""

echo "=== Stored Content Test ==="
if [[ -n "$VIEWPORT_RAW_CONTENT" ]]; then
    lines=$(echo "$VIEWPORT_RAW_CONTENT" | wc -l)
    echo "✓ PASS: Raw content stored ($lines lines)"
else
    echo "✗ FAIL: Raw content not stored"
fi

echo ""
echo "=== Indicator Format Test ==="
if echo "$truncated" | grep -q "Press Ctrl+O to view all"; then
    echo "✓ PASS: Pager hint present"
else
    echo "✗ FAIL: Pager hint missing"
fi

if echo "$truncated" | grep -q "35 more lines"; then
    echo "✓ PASS: Line count correct"
else
    echo "✗ FAIL: Line count incorrect"
fi
