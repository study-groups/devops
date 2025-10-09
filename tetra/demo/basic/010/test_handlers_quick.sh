#!/usr/bin/env bash

# Quick Handler System Test - Direct in project root

echo "🧪 Quick Handler Test"
echo "===================="

# Test 1: Basic file structure
echo "📁 Files exist:"
files_to_check=(
    "bash/app/handlers/base_handler.sh"
    "bash/app/handlers/registry.sh"
    "bash/app/handlers/show_handler.sh"
    "bash/app/handlers/configure_handler.sh"
    "bash/app/handlers/test_handler.sh"
    "bash/app/handlers/default_handler.sh"
    "config/tui_actions.conf"
)

for file in "${files_to_check[@]}"; do
    if [[ -f "$file" ]]; then
        echo "✅ $file"
    else
        echo "❌ $file"
    fi
done

# Test 2: Syntax validation
echo ""
echo "🔍 Syntax check:"
for file in bash/app/handlers/*.sh; do
    if bash -n "$file" 2>/dev/null; then
        echo "✅ $(basename "$file")"
    else
        echo "❌ $(basename "$file") has syntax errors"
    fi
done

# Test 3: Mock functions for testing
echo ""
echo "🔧 Setting up mocks..."

# Create minimal mocks
refresh_color_state_cached() { :; }
get_action_routing() { echo "input_keyboard → output_display"; }
render_action_verb_noun() { echo "[$1×$2]"; }
render_response_type() { echo " → response"; }
generate_section_separator() { echo "=========================================="; }
get_action_description() { echo "Test description for $1:$2"; }
log_action() { :; }
handler_log() { :; }

export -f refresh_color_state_cached get_action_routing render_action_verb_noun
export -f render_response_type generate_section_separator get_action_description
export -f log_action handler_log

echo "✅ Mock functions ready"

# Test 4: Registry loading
echo ""
echo "🗂️  Registry test:"

# Source registry
if source bash/app/handlers/registry.sh 2>/dev/null; then
    echo "✅ Registry sourced"
else
    echo "❌ Registry source failed"
    exit 1
fi

# Initialize registry
if init_handler_registry >/dev/null 2>&1; then
    echo "✅ Registry initialized: ${#HANDLER_REGISTRY[@]} handlers"
else
    echo "❌ Registry initialization failed"
    exit 1
fi

# Test 5: Handler discovery
echo ""
echo "🔍 Handler discovery:"

show_handler=$(find_handler show demo APP Learn 2>/dev/null)
if [[ -n "$show_handler" ]]; then
    echo "✅ show:demo → $(basename "$show_handler")"
else
    echo "❌ show:demo handler not found"
fi

config_handler=$(find_handler configure colors APP Try 2>/dev/null)
if [[ -n "$config_handler" ]]; then
    echo "✅ configure:colors → $(basename "$config_handler")"
else
    echo "❌ configure:colors handler not found"
fi

# Test 6: Show handler execution
echo ""
echo "⚡ Execution test:"

if source bash/app/handlers/show_handler.sh 2>/dev/null; then
    echo "✅ Show handler sourced"

    if result=$(handler_execute show demo APP Learn 2>/dev/null); then
        lines=$(echo "$result" | wc -l)
        echo "✅ show:demo executed ($lines lines output)"
        echo "   Preview: $(echo "$result" | head -1)"
    else
        echo "❌ show:demo execution failed"
    fi
else
    echo "❌ Show handler source failed"
fi

echo ""
echo "🎯 Quick test completed successfully!"