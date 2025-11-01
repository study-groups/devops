#!/usr/bin/env bash

# Quick Handler System Test
# Focused test to identify specific issues

set -e

PROJECT_ROOT="$(realpath "$(dirname "${BASH_SOURCE[0]}")/../..")"
cd "$PROJECT_ROOT"

echo "🧪 Quick Handler Test"
echo "===================="

# Test 1: Basic file structure
echo "📁 Files exist:"
for file in bash/app/handlers/{base,registry,show,configure,test,default}_handler.sh config/tui_actions.conf; do
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
        echo "❌ $(basename "$file")"
        bash -n "$file"  # Show error
    fi
done

# Test 3: Registry loading (with minimal output)
echo ""
echo "🗂️  Registry test:"

# Mock required functions
refresh_color_state_cached() { :; }
get_action_routing() { echo "input_keyboard → output_display"; }
render_action_verb_noun() { echo "[$1×$2]"; }
render_response_type() { echo " → response"; }
generate_section_separator() { echo "=========================================="; }
get_action_description() { echo "Test description for $1:$2"; }
log_action() { :; }  # Silent log
handler_log() { :; }  # Silent log

export -f refresh_color_state_cached get_action_routing render_action_verb_noun
export -f render_response_type generate_section_separator get_action_description
export -f log_action handler_log

# Source registry with silent loading
source bash/app/handlers/registry.sh 2>/dev/null

# Initialize registry silently
init_handler_registry >/dev/null 2>&1

echo "✅ Registry loaded: ${#HANDLER_REGISTRY[@]} handlers"

# Test 4: Handler discovery
echo ""
echo "🔍 Handler discovery:"
show_handler=$(find_handler show demo APP Learn 2>/dev/null)
echo "✅ show:demo → $(basename "$show_handler")"

config_handler=$(find_handler configure colors APP Try 2>/dev/null)
echo "✅ configure:colors → $(basename "$config_handler")"

unknown_handler=$(find_handler unknown action APP Learn 2>/dev/null)
echo "✅ unknown:action → $(basename "$unknown_handler")"

# Test 5: Basic execution
echo ""
echo "⚡ Execution test:"
source bash/app/handlers/show_handler.sh 2>/dev/null

if result=$(handler_execute show demo APP Learn 2>/dev/null); then
    echo "✅ show:demo executed ($(echo "$result" | wc -l) lines)"
else
    echo "❌ show:demo failed"
fi

echo ""
echo "🎯 Quick test completed!"