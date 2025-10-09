#!/usr/bin/env bash

# Debug newline issue in action rendering

echo "🔍 Debugging Newline Issue"
echo "=========================="

# Source required modules
source bash/tui/modules/colors/color_module.sh 2>/dev/null

# Test each component separately
echo "Testing individual components:"
echo ""

# Test 1: Action separator
echo -n "1. Action separator: '"
render_action_separator
echo "'"
echo ""

# Test 2: Noun rendering
echo -n "2. Noun rendering: '"
safe_noun_display_uniform "inspect"
echo "'"
echo ""

# Test 3: Reset color
echo -n "3. Reset color: '"
reset_color
echo "'"
echo ""

# Test 4: Full function with debug
echo "4. Full render_action_verb_noun with debug:"
echo ""

render_action_verb_noun_debug() {
    local verb="$1"
    local noun="$2"

    echo -n "Starting render..."

    # Get sigil
    local sigil_verb="$(render_action_sigil "$verb")"
    echo -n "Sigil: [$sigil_verb]"

    # Apply verb color
    get_smart_verb_color "$verb"
    printf "%s" "$sigil_verb"
    reset_color
    echo -n "After verb color reset"

    # Separator
    render_action_separator
    echo -n "After separator"

    # Noun
    safe_noun_display_uniform "$noun"
    echo -n "After noun"

    echo " [END]"
}

render_action_verb_noun_debug "show" "inspect"

echo ""
echo "🔧 Testing potential fix:"

# Fixed version without newlines
render_action_verb_noun_fixed() {
    local verb="$1"
    local noun="$2"

    # Use printf only, no echo
    local sigil_verb="$(render_action_sigil "$verb")"
    get_smart_verb_color "$verb"
    printf "%s" "$sigil_verb"
    reset_color

    printf "%s" " × "  # Direct separator

    printf "\033[1m"  # Bold directly
    text_color "${NOUNS_PRIMARY[0]}"
    printf "%s" "$noun"
    reset_color
}

echo -n "Fixed version: '"
render_action_verb_noun_fixed "show" "inspect"
echo "'"