#!/usr/bin/env bash

# Test the live handler system with the actual environment

echo "🧪 Testing Live Handler Execution"
echo "================================="

# Source the actual app environment
APP_SCRIPT_DIR="$(dirname "${BASH_SOURCE[0]}")/bash/app"

# Source dependencies in correct order
source "$APP_SCRIPT_DIR/../utils/nouns_verbs.sh"
source "$APP_SCRIPT_DIR/action_router.sh"

# Set up minimal environment for testing
ENV_INDEX=0
MODE_INDEX=0
ACTION_INDEX=0
ENVIRONMENTS=("APP" "DEV")
declare -A current_modes_cache

get_current_modes() {
    echo "Learn Try"
}

# Test the show:inspect action specifically
echo "🎯 Testing show:inspect action:"
echo "--------------------------------"

# Initialize handler registry
if [[ ${#HANDLER_REGISTRY[@]} -eq 0 ]]; then
    init_handler_registry 2>/dev/null
fi

echo "Handler for show:inspect: $(find_handler show inspect APP Learn)"
echo ""

# Execute the action
echo "Executing show:inspect..."
result=$(execute_action_with_handlers show inspect 2>/dev/null)

echo "Result preview (first 10 lines):"
echo "$result" | head -10
echo ""
echo "✅ Test completed"