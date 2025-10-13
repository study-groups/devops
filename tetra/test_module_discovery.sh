#!/usr/bin/env bash

# Test module discovery and integration

echo "=== Testing Module Discovery ==="
echo

# Source tetra
source ~/tetra/tetra.sh

# Source demo 014 dependencies
DEMO_DIR="demo/basic/014"
source "$DEMO_DIR/bash/actions/registry.sh"
source "$DEMO_DIR/bash/actions/module_discovery.sh"

# Discover modules
echo "Discovering modules..."
discover_tetra_modules
echo

# Test action retrieval
echo "=== Testing Action Retrieval ==="
echo

echo "Local × Inspect actions:"
actions=$(get_module_actions "Local" "Inspect")
echo "  $actions"
echo

echo "Dev × Inspect actions:"
actions=$(get_module_actions "Dev" "Inspect")
echo "  $actions"
echo

echo "Local × Execute actions:"
actions=$(get_module_actions "Local" "Execute")
echo "  $actions"
echo

# Show registered actions
echo "=== Registered Actions ==="
for action_name in "${ACTION_REGISTRY[@]}"; do
    if declare -p "ACTION_${action_name}" &>/dev/null 2>&1; then
        local -n _act="ACTION_${action_name}"
        if [[ -n "${_act[contexts]}" ]]; then
            echo "  ${_act[verb]}:${_act[noun]} - contexts: ${_act[contexts]}, modes: ${_act[modes]}"
        fi
    fi
done
echo

echo "=== Test Complete ==="
