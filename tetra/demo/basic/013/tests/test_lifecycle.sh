#!/usr/bin/env bash

# Test TES Action Lifecycle

DEMO_DIR="$(dirname "${BASH_SOURCE[0]}")"

source "$DEMO_DIR/tui.conf"
source "$DEMO_DIR/action_registry.sh"
source "$DEMO_DIR/action_state.sh"

echo "Testing TES Action Lifecycle"
echo "════════════════════════════════════════"
echo

# Test 1: Check initial state
echo "Test 1: Initial State"
echo "--------------------"
action="view:toml"
state=$(get_action_state "$action")
symbol=$(get_state_symbol "$state")
echo "Action: $action"
echo "State: $state $symbol"
echo "Expected: idle ●"
echo

# Test 2: Check if action is fully qualified (no inputs)
echo "Test 2: Qualification Check (no inputs)"
echo "---------------------------------------"
if is_fully_qualified "$action"; then
    echo "✓ Action is fully qualified (no inputs required)"
else
    echo "✗ Action is NOT qualified"
fi
echo

# Test 3: Check if action is ready
echo "Test 3: Ready Check"
echo "-------------------"
if is_action_ready "$action"; then
    echo "✓ Action is ready to execute"
else
    echo "○ Action is NOT ready (expected - needs marking)"
fi
echo

# Test 4: Qualify the action
echo "Test 4: Qualify Action"
echo "----------------------"
if qualify_action "$action"; then
    new_state=$(get_action_state "$action")
    new_symbol=$(get_state_symbol "$new_state")
    echo "✓ Action qualified"
    echo "New state: $new_state $new_symbol"
else
    echo "✗ Failed to qualify action"
fi
echo

# Test 5: Mark as ready
echo "Test 5: Mark Ready"
echo "------------------"
mark_action_ready "$action"
final_state=$(get_action_state "$action")
final_symbol=$(get_state_symbol "$final_state")
echo "State: $final_state $final_symbol"
echo "Expected: ready ◉"
echo

# Test 6: Check ready status
echo "Test 6: Final Ready Check"
echo "-------------------------"
if is_action_ready "$action"; then
    echo "✓ Action is ready to execute"
else
    echo "✗ Action is NOT ready"
fi
echo

# Test 7: Test action with inputs (simulated)
echo "Test 7: Action with Inputs (Simulated)"
echo "--------------------------------------"
# Simulate an action that needs inputs
declare -gA ACTION_test_with_inputs=(
    [verb]="deploy"
    [noun]="target"
    [inputs]="@staging"  # Unresolved symbol
    [output]="@tui[content]"
    [state]="idle"
)

action_with_inputs="deploy:target"
echo "Action: $action_with_inputs"
echo "Inputs: @staging (unresolved symbol)"

if is_fully_qualified "$action_with_inputs"; then
    echo "✗ Should NOT be qualified (has unresolved symbol)"
else
    echo "✓ Correctly detected as NOT qualified"
fi
echo

# Summary
echo "════════════════════════════════════════"
echo "TES Lifecycle Summary"
echo "════════════════════════════════════════"
echo
echo "States implemented:"
echo "  idle      ● - Neutral state"
echo "  template  ○ - Declared, needs inputs"
echo "  qualified ◐ - Inputs provided"
echo "  ready     ◉ - Validated, can execute"
echo "  executing ▶ - Running"
echo "  success   ✓ - Completed"
echo "  error     ✗ - Failed"
echo
echo "TES Lifecycle: template → qualified → ready → executing → success/error → idle"
echo
