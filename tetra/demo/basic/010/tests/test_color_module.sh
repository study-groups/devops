#!/usr/bin/env bash

# Test script for the new color module with maximum distance algorithm

source ./modules/colors/color_module.sh

echo "=== Color Module Test ==="
echo

# Test basic color distance calculation
echo "Testing color distance algorithm:"
echo "Distance between FF0000 (red) and 00FF00 (green): $(color_distance "FF0000" "00FF00")"
echo "Distance between FF0000 (red) and FF0044 (similar red): $(color_distance "FF0000" "FF0044")"
echo

# Test maximum distance color selection
echo "Testing maximum distance selection:"
verb_color="FF0044"  # Red from VERBS
noun_bg="AA00AA"     # Purple from NOUNS

echo "Verb color: $verb_color"
echo "Noun bg: $noun_bg"

optimal=$(find_max_distance_color "$verb_color" "$noun_bg" "MODE_PRIMARY")
echo "Optimal response type color: $optimal"

distance1=$(color_distance "$optimal" "$verb_color")
distance2=$(color_distance "$optimal" "$noun_bg")
echo "Distance from verb: $distance1"
echo "Distance from noun bg: $distance2"
echo

# Test safe color display functions
echo "Testing safe color display:"

# Test verb display (foreground only)
printf "Verb 'show': "
safe_verb_display "show"
echo

# Test noun display (background + contrasting fg)
printf "Noun 'palette': "
safe_noun_display "palette"
echo

# Test verb × noun combination
printf "Combination: "
render_action_verb_noun "show" "palette"
echo

# Test response type
printf "With response: "
render_action_verb_noun "show" "palette"
render_response_type "show" "palette"
echo
echo

# Test different verb:noun combinations
echo "Testing various verb:noun combinations:"

combinations=(
    "show:palette"
    "test:colors"
    "configure:header"
    "cycle:input"
    "reset:demo"
)

for combo in "${combinations[@]}"; do
    verb="${combo%%:*}"
    noun="${combo##*:}"

    printf "%-20s: " "$combo"
    render_action_verb_noun "$verb" "$noun"
    render_response_type "$verb" "$noun"
    echo
done

echo

# Test state management
echo "Testing color state management:"
refresh_color_state "show" "palette"
show_color_state

echo "=== Action Line Layout Test ==="
echo

# Simulate the new action line format
echo "OLD format (broken):"
echo "Action: [show × palette] → other_actions..."
echo

echo "NEW format (clean separation):"
echo "Action: [show × palette]"
echo "        → [STD_OUT] other_actions..."
echo

echo "Test complete!"