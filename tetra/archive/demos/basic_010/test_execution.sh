#!/usr/bin/env bash

# Test actual handler execution

echo "🚀 Testing Handler Execution"
echo "============================"

# Mock some required functions for testing
refresh_color_state_cached() { echo "Color state refreshed for $1:$2"; }
get_action_routing() { echo "input_keyboard → output_display"; }
render_action_verb_noun() { echo "[$1×$2]"; }
render_response_type() { echo " → response"; }
generate_section_separator() { echo "=========================================="; }
get_action_description() { echo "Description for $1:$2 action"; }
log_action() { echo "LOG: $*" >&2; }

# Export mock functions
export -f refresh_color_state_cached get_action_routing render_action_verb_noun
export -f render_response_type generate_section_separator get_action_description log_action

# Source dependencies
source bash/app/handlers/registry.sh

# Initialize
init_handler_registry 2>/dev/null

echo "🎯 Testing show:demo execution:"
echo "--------------------------------"

# Execute a show action
result=$(execute_action_with_handler show demo APP Learn 2>/dev/null)
echo "$result" | head -10

echo ""
echo "✅ Handler execution test completed"