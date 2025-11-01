#!/usr/bin/env bash

# Action Display Fix - Responsive action rendering

# Enhanced action line rendering with width management
render_action_line_responsive() {
    local actions=("$@")
    local term_width=${COLUMNS:-80}

    if [[ ${#actions[@]} -eq 0 ]]; then
        printf "Action: [no actions available]"
        return
    fi

    if [[ $ACTION_INDEX -ge ${#actions[@]} ]]; then
        ACTION_INDEX=0
    fi

    local action="${actions[$ACTION_INDEX]}"
    local action_prefix="Action: ["
    local action_suffix="] ($((ACTION_INDEX + 1))/${#actions[@]})"

    # Calculate available space for action content
    local prefix_suffix_length=$((${#action_prefix} + ${#action_suffix}))
    local available_width=$((term_width - prefix_suffix_length - 5))  # 5 char safety margin

    if [[ "$action" == *:* ]]; then
        local verb="${action%%:*}"
        local noun="${action##*:}"

        # Check if full action fits
        local full_action="${verb}×${noun}"
        if [[ ${#full_action} -le $available_width ]]; then
            # Full action fits - use normal rendering
            refresh_color_state_cached "$verb" "$noun" 2>/dev/null || true
            printf "%s" "$action_prefix"
            render_action_verb_noun "$verb" "$noun" 2>/dev/null || printf "%s×%s" "$verb" "$noun"
            printf "%s" "$action_suffix"
        else
            # Action too long - use smart truncation
            local max_noun_length=$((available_width - ${#verb} - 3))  # 3 for "×" and "..."
            if [[ $max_noun_length -gt 3 ]]; then
                local truncated_noun="${noun:0:$max_noun_length}..."
                printf "%s%s×%s%s" "$action_prefix" "$verb" "$truncated_noun" "$action_suffix"
            else
                # Very tight space - just show verb
                printf "%s%s×...%s" "$action_prefix" "$verb" "$action_suffix"
            fi
        fi
    else
        # Non-standard action format
        if [[ ${#action} -le $available_width ]]; then
            printf "%s%s%s" "$action_prefix" "$action" "$action_suffix"
        else
            local truncated="${action:0:$((available_width - 3))}..."
            printf "%s%s%s" "$action_prefix" "$truncated" "$action_suffix"
        fi
    fi
}

# Test the responsive rendering
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    echo "🧪 Testing Responsive Action Display"
    echo "===================================="

    # Mock required functions
    refresh_color_state_cached() { :; }
    render_action_verb_noun() { printf "%s×%s" "$1" "$2"; }

    # Mock state
    ACTION_INDEX=0

    # Test with different terminal widths
    for width in 40 60 80 120; do
        export COLUMNS=$width
        echo "Terminal width: $width"
        echo -n "  "
        render_action_line_responsive "show:demo" "configure:colors" "show:inspect" "test:very_long_noun_name"
        echo ""
    done

    echo ""
    echo "✅ Responsive rendering test completed"
fi