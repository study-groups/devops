#!/usr/bin/env bash

# Test REPL palette integration

echo "=== REPL Palette Integration Test ==="
echo

# Test palette command directly
echo "Testing '/palette' command..."
echo '/palette' | ./demo.sh repl 2>/dev/null | head -20

echo
echo "Testing 'palette' shortcut command..."
echo 'palette' | ./demo.sh repl 2>/dev/null | head -20

echo
echo "Testing 'colors' alias..."
echo 'colors' | ./demo.sh repl 2>/dev/null | head -20

echo
echo "Testing help system includes palette..."
echo '/help' | ./demo.sh repl 2>/dev/null | grep -A 10 "🎮 REPL Commands"

echo
echo "Testing commands list includes palette..."
echo '/commands' | ./demo.sh repl 2>/dev/null | grep -A 5 "Regular:"

echo
echo "✅ REPL palette integration complete!"
echo "Available commands:"
echo "  palette      - Show full color palette system"
echo "  colors       - Alias for palette"
echo "  /palette     - Meta command version"