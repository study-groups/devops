#!/usr/bin/env bash

# Test pagination functionality

DEMO_DIR="$(dirname "${BASH_SOURCE[0]}")"
source "$DEMO_DIR/viewport.sh"

# Simulate a 24-line terminal
export LINES=24
export COLUMNS=80

update_viewport_dimensions

echo "=== Pagination Test ==="
echo "Terminal: ${LINES}x${COLUMNS}"
echo "Content lines per page: ${VIEWPORT_CONTENT_LINES}"
echo ""

# Generate 50 lines of content
long_content=""
for i in {1..50}; do
    long_content+="Line $i: This is test content to demonstrate pagination\n"
done

echo "=== Generated Content ==="
echo "Total lines: 50"
echo "Expected pages: ~4 (50 lines / 15 usable lines per page)"
echo ""

# Test Page 1
echo "=== Page 1 (Initial) ==="
VIEWPORT_CURRENT_PAGE=1
page1=$(truncate_content "$(echo -e "$long_content")")
echo "$page1" | tail -3  # Show last 3 lines (including indicator)
echo ""

# Test Page 2
echo "=== Page 2 (After Ctrl+O) ==="
# First, populate pagination state
truncate_content "$(echo -e "$long_content")" > /dev/null
# Now navigate to next page
viewport_next_page
echo "Current page after next: $VIEWPORT_CURRENT_PAGE"
# Get the new page content
page2=$(truncate_content "$(echo -e "$long_content")")
echo "$page2" | head -3  # Show first 3 lines
echo "..."
echo "$page2" | tail -1  # Show indicator
echo ""

# Test Page Navigation
echo "=== Navigation Test ==="
# Initialize pagination state first
VIEWPORT_CURRENT_PAGE=1
truncate_content "$(echo -e "$long_content")" > /dev/null
echo "Starting page: $VIEWPORT_CURRENT_PAGE / $VIEWPORT_TOTAL_PAGES"

viewport_next_page && echo "✓ Next page: $VIEWPORT_CURRENT_PAGE"
viewport_next_page && echo "✓ Next page: $VIEWPORT_CURRENT_PAGE"
viewport_next_page && echo "✓ Next page: $VIEWPORT_CURRENT_PAGE"
viewport_next_page && echo "✓ Next page: $VIEWPORT_CURRENT_PAGE (should be at last page)"
viewport_next_page || echo "✗ No more pages (correctly at page $VIEWPORT_CURRENT_PAGE)"

echo ""
viewport_prev_page && echo "✓ Prev page: $VIEWPORT_CURRENT_PAGE"
viewport_prev_page && echo "✓ Prev page: $VIEWPORT_CURRENT_PAGE"
viewport_prev_page && echo "✓ Prev page: $VIEWPORT_CURRENT_PAGE"
viewport_prev_page && echo "✓ Prev page: $VIEWPORT_CURRENT_PAGE (should be at first page)"
viewport_prev_page || echo "✗ Already at first page (correctly at page $VIEWPORT_CURRENT_PAGE)"

echo ""
echo "=== Page Calculation Test ==="
VIEWPORT_CURRENT_PAGE=1
truncate_content "$(echo -e "$long_content")" > /dev/null
echo "Total pages calculated: $VIEWPORT_TOTAL_PAGES"
echo "Expected: 4 pages"

if (( VIEWPORT_TOTAL_PAGES == 4 )); then
    echo "✓ PASS: Correct page calculation"
else
    echo "✗ FAIL: Expected 4 pages, got $VIEWPORT_TOTAL_PAGES"
fi

echo ""
echo "=== Indicator Format Test ==="
VIEWPORT_CURRENT_PAGE=1
page_with_indicator=$(truncate_content "$(echo -e "$long_content")")
if echo "$page_with_indicator" | grep -q "Ctrl+O=next"; then
    echo "✓ PASS: Next page hint present"
else
    echo "✗ FAIL: Next page hint missing"
fi

VIEWPORT_CURRENT_PAGE=$VIEWPORT_TOTAL_PAGES
last_page=$(truncate_content "$(echo -e "$long_content")")
if echo "$last_page" | grep -q "last page"; then
    echo "✓ PASS: Last page indicator present"
else
    echo "✗ FAIL: Last page indicator missing"
fi
