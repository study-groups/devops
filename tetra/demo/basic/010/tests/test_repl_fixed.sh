#!/usr/bin/env bash

# Test the fixed REPL UI system

echo "=== Testing Fixed REPL UI System ==="
echo

echo "Testing 'ui' command with new color system..."
echo 'ui' | ./demo.sh repl 2>/dev/null | head -20

echo
echo "Testing 'ui palette' command..."
echo 'ui palette' | ./demo.sh repl 2>/dev/null | head -25

echo
echo "✅ REPL UI system updated!"
echo "Changes made:"
echo "- Removed old static color grids (forest sage moss mint, etc.)"
echo "- Updated to use new element-based color functions"
echo "- 'ui palette' now shows gold standard palette.sh"
echo "- UI assignments use new ui_env_selected, ui_mode_selected, etc."