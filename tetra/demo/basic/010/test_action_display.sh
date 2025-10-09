#!/usr/bin/env bash

# Test Action Display and Truncation Issues

echo "🎯 Testing Action Display Formatting"
echo "===================================="

# Source color system and functions
source bash/tui/modules/colors/color_module.sh 2>/dev/null || echo "⚠️  Color module not available"

# Mock functions if not available
if ! command -v render_action_verb_noun >/dev/null 2>&1; then
    render_action_verb_noun() {
        echo "${1}×${2}"
    }
fi

if ! command -v render_action_separator >/dev/null 2>&1; then
    render_action_separator() {
        echo " × "
    }
fi

if ! command -v reset_color >/dev/null 2>&1; then
    reset_color() { echo ""; }
fi

# Test different action lengths
test_actions=(
    "show:demo"
    "show:colors"
    "show:inspect"
    "configure:colors"
    "configure:palette"
    "test:very_long_noun_name"
    "very_long_verb_name:noun"
)

echo "📏 Testing Action Display Lengths"
echo "--------------------------------"

for action in "${test_actions[@]}"; do
    if [[ "$action" == *:* ]]; then
        verb="${action%%:*}"
        noun="${action##*:}"

        # Test the rendering function
        rendered=$(render_action_verb_noun "$verb" "$noun" 2>/dev/null)
        display_length=${#rendered}

        printf "%-25s | Length: %2d | Display: [%s]\n" "$action" "$display_length" "$rendered"
    fi
done

echo ""
echo "🖥️  Testing Terminal Width Constraints"
echo "-------------------------------------"

# Test with different terminal widths
original_columns=${COLUMNS:-80}

for width in 60 80 100 120; do
    export COLUMNS=$width
    echo "Terminal width: $width"

    # Test a problematic action
    action="show:inspect"
    verb="${action%%:*}"
    noun="${action##*:}"

    # Simulate the action line creation
    line_prefix="Action: ["
    line_suffix="] (6/6)"

    rendered_action=$(render_action_verb_noun "$verb" "$noun" 2>/dev/null)
    full_line="${line_prefix}${rendered_action}${line_suffix}"

    # Check if it fits
    clean_length=$(echo "$full_line" | sed 's/\x1B\[[0-9;]*[JKmsu]//g' | wc -c)
    clean_length=$((clean_length - 1))  # Remove newline

    if [[ $clean_length -le $width ]]; then
        echo "  ✅ Fits: $clean_length/$width chars"
    else
        echo "  ❌ Truncated: $clean_length/$width chars"
    fi

    echo "  Preview: $full_line"
    echo ""
done

# Restore original width
export COLUMNS=$original_columns

echo "🔧 Testing Potential Fixes"
echo "-------------------------"

# Test action truncation solution
truncate_action_if_needed() {
    local action="$1"
    local max_width="$2"

    if [[ ${#action} -gt $max_width ]]; then
        echo "${action:0:$((max_width-3))}..."
    else
        echo "$action"
    fi
}

echo "Smart truncation examples:"
for action in "${test_actions[@]}"; do
    if [[ ${#action} -gt 15 ]]; then
        truncated=$(truncate_action_if_needed "$action" 15)
        echo "  $action → $truncated"
    fi
done

echo ""
echo "🎉 Action display test completed!"
echo ""
echo "Potential solutions:"
echo "• Check terminal width before rendering"
echo "• Implement smart truncation for long actions"
echo "• Use responsive layout based on available space"
echo "• Ensure color codes don't interfere with width calculation"