#!/usr/bin/env bash

# Quick test of action execution system

DEMO_DIR="$(dirname "${BASH_SOURCE[0]}")"

source "$DEMO_DIR/tui.conf"
source "$DEMO_DIR/viewport.sh"
source "$DEMO_DIR/colors/color_module.sh"
source "$DEMO_DIR/typography.sh"
source "$DEMO_DIR/action_registry.sh"
source "$DEMO_DIR/action_state.sh"
source "$DEMO_DIR/action_preview.sh"
source "$DEMO_DIR/modal.sh"
source "$DEMO_DIR/router.sh"
source "$DEMO_DIR/actions_impl.sh"

echo "Testing action execution system..."
echo ""

# Test 1: Call action directly
echo "Test 1: Direct action call"
echo "=========================="
action_view_services "Local"
echo ""
echo ""

# Test 2: Check if action functions exist
echo "Test 2: Function existence check"
echo "================================="
for action in "view_toml" "view_services" "status_tsm" "deploy_local"; do
    if declare -f "action_$action" &>/dev/null; then
        echo "✓ action_$action exists"
    else
        echo "✗ action_$action NOT FOUND"
    fi
done
echo ""

# Test 3: Test routing
echo "Test 3: Output routing"
echo "======================"
output=$(action_view_services "Local")
echo "Captured output:"
echo "$output"
echo ""

# Test 4: Check TUI_SEPARATOR_WIDTH
echo "Test 4: Configuration"
echo "====================="
echo "TUI_SEPARATOR_WIDTH: ${TUI_SEPARATOR_WIDTH:-NOT SET}"
echo "TETRA_DIR: ${TETRA_DIR:-NOT SET}"
echo ""

echo "All tests complete!"
