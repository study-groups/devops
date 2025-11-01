#!/usr/bin/env bash

# Test viewport with long content

DEMO_DIR="$(dirname "${BASH_SOURCE[0]}")"
source "$DEMO_DIR/viewport.sh"

# Simulate a 24-line terminal
export LINES=24
export COLUMNS=80

update_viewport_dimensions

echo "=== Viewport Test ==="
echo "Terminal: ${LINES}x${COLUMNS}"
echo "Available content lines: ${VIEWPORT_CONTENT_LINES}"
echo ""

# Generate long content
long_content=$(cat <<'EOF'
Line 1: This is a test of viewport management
Line 2: The header should stay fixed
Line 3: Even when content is very long
Line 4: We want to see truncation working
Line 5: The viewport calculates available space
Line 6: Header takes 4 lines
Line 7: Footer takes 2 lines
Line 8: Plus 2 separator lines
Line 9: That leaves about 16 lines for content
Line 10: If content exceeds that
Line 11: It should be truncated
Line 12: With an indicator showing more lines
Line 13: This ensures header never scrolls off
Line 14: And layout stays predictable
Line 15: Let's add more lines to test
Line 16: Line sixteen
Line 17: Line seventeen
Line 18: Line eighteen
Line 19: Line nineteen
Line 20: Line twenty - should be truncated!
Line 21: This should not appear
Line 22: Neither should this
Line 23: Or this
Line 24: Or this
Line 25: Definitely not this one
EOF
)

echo "=== Original Content (25 lines) ==="
echo "$long_content" | head -5
echo "..."
echo "$long_content" | tail -5
echo ""

echo "=== Truncated Content ==="
truncated=$(truncate_content "$long_content")
echo "$truncated"
echo ""

echo "=== Line Count Check ==="
actual_lines=$(echo "$truncated" | wc -l)
echo "Truncated output lines: $actual_lines"
echo "Expected max: $VIEWPORT_CONTENT_LINES"

if (( actual_lines <= VIEWPORT_CONTENT_LINES )); then
    echo "✓ PASS: Content fits in viewport"
else
    echo "✗ FAIL: Content exceeds viewport"
fi
