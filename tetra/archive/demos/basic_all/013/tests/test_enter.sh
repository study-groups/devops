#!/usr/bin/env bash

# Simulate pressing Enter and verify screen changes

DEMO_DIR="$(dirname "${BASH_SOURCE[0]}")"

# Source everything in correct order
source "$DEMO_DIR/tui.conf"
source "$DEMO_DIR/viewport.sh"
source "$DEMO_DIR/colors/color_module.sh"
source "$DEMO_DIR/typography.sh"
source "$DEMO_DIR/router.sh"
source "$DEMO_DIR/action_registry.sh"
source "$DEMO_DIR/action_state.sh"
source "$DEMO_DIR/action_preview.sh"
source "$DEMO_DIR/modal.sh"
source "$DEMO_DIR/actions_impl.sh"
source "$DEMO_DIR/action_executor.sh"

# Set up state like demo.sh
ENV_INDEX=0
MODE_INDEX=0
ACTION_INDEX=0
ENVIRONMENTS=("System" "Local" "Dev")
MODES=("Monitor" "Control" "Deploy")

# Get actions function
get_actions() {
    local env="${ENVIRONMENTS[$ENV_INDEX]}"
    local mode="${MODES[$MODE_INDEX]}"
    case "$env:$mode" in
        "System:Monitor") echo "view:toml view:services view:org" ;;
        *) echo "" ;;
    esac
}

echo "=== Testing Enter Key Action Execution ==="
echo ""
echo "Initial buffer state:"
echo "Content: '${TUI_BUFFERS["@tui[content]"]}'"
echo "Footer: '${TUI_BUFFERS["@tui[footer]"]}'"
echo ""

# Get current action
actions=($(get_actions))
action="${actions[$ACTION_INDEX]}"

echo "Current action: $action"
echo ""

# Execute the action (simulating Enter key)
echo "Executing action..."
execute_action_with_feedback "$action"
exit_code=$?

echo ""
echo "After execution (exit_code=$exit_code):"
echo "Content buffer length: ${#TUI_BUFFERS["@tui[content]"]} chars"
echo "Content preview: ${TUI_BUFFERS["@tui[content]"]:0:200}"
echo ""
echo "Footer: '${TUI_BUFFERS["@tui[footer]"]}'"
