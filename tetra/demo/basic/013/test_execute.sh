#!/usr/bin/env bash

# Direct test of action execution chain

DEMO_DIR="$(dirname "${BASH_SOURCE[0]}")"

source "$DEMO_DIR/tui.conf"
source "$DEMO_DIR/colors/color_module.sh"
source "$DEMO_DIR/typography.sh"
source "$DEMO_DIR/router.sh"
source "$DEMO_DIR/action_registry.sh"
source "$DEMO_DIR/action_state.sh"
source "$DEMO_DIR/actions_impl.sh"
source "$DEMO_DIR/action_executor.sh"

echo "=== Testing Action Execution Chain ==="
echo ""

# Test 1: Can we call execute_action_impl directly?
echo "Test 1: Direct call to execute_action_impl"
echo "---"
output=$(execute_action_impl "view:toml")
exit_code=$?
echo "Exit code: $exit_code"
echo "Output length: ${#output} chars"
echo "First 100 chars: ${output:0:100}"
echo ""

# Test 2: Can we call execute_action_with_feedback?
echo "Test 2: Call through execute_action_with_feedback"
echo "---"
TUI_BUFFERS["@tui[content]"]=""
execute_action_with_feedback "view:toml"
exit_code=$?
echo "Exit code: $exit_code"
echo "Buffer set: ${TUI_BUFFERS["@tui[content]"]:0:100}"
echo ""

echo "=== Tests Complete ==="
