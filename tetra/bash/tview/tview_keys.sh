#!/usr/bin/env bash

# TView Keys - Single Source of Truth for All Key Bindings
# This file defines the ONLY key mappings used throughout TView
# ALL other files must use these definitions

# Navigation Keys (Universal across all TView modes)
declare -grA TVIEW_KEYS=(
    # Primary Navigation
    ["UP"]="i"
    ["DOWN"]="k"
    ["DRILL_IN"]="l"
    ["EXIT_OUT"]="j"

    # Secondary Navigation
    ["BACK"]=$'\e'          # ESC key
    ["QUIT"]="q"
    ["ENTER"]=$'\n'
    ["SPACE"]=" "

    # Mode Switching (Environment/Mode)
    ["NEXT_ENV"]="d"        # Next environment (TETRA -> LOCAL -> DEV etc)
    ["PREV_ENV"]="a"        # Previous environment
    ["NEXT_MODE"]="s"       # Next mode (TOML -> TKM -> TSM etc)
    ["PREV_MODE"]="w"       # Previous mode

    # Action Keys
    ["REFRESH"]="r"
    ["HELP"]="h"
    ["SEARCH"]="/"
)

# Key Descriptions (for help text)
declare -grA TVIEW_KEY_DESCRIPTIONS=(
    ["i"]="Move up"
    ["k"]="Move down"
    ["l"]="Drill in / Expand"
    ["j"]="Exit / Go out"
    ["ESC"]="Back / Cancel"
    ["q"]="Quit TView"
    ["d"]="Next environment"
    ["a"]="Previous environment"
    ["s"]="Next mode"
    ["w"]="Previous mode"
    ["r"]="Refresh"
    ["h"]="Help"
    ["/"]="Search"
)

# Utility Functions

# Get key for a specific action
get_key() {
    local action="$1"
    echo "${TVIEW_KEYS[$action]}"
}

# Check if pressed key matches action
key_matches() {
    local pressed_key="$1"
    local action="$2"
    [[ "$pressed_key" == "${TVIEW_KEYS[$action]}" ]]
}

# Generate help text for keys
show_key_help() {
    echo "TView Navigation Keys:"
    echo "====================="
    echo "  i = Move up        k = Move down"
    echo "  l = Drill in       j = Exit/Out"
    echo "  ESC = Back         q = Quit"
    echo ""
    echo "Environment/Mode:"
    echo "  a/d = Switch env   w/s = Switch mode"
    echo ""
    echo "Other: r=refresh, h=help, /=search"
}

# Validate that a key handler uses correct mappings
validate_key_handler() {
    local file="$1"
    local issues=()

    # Check for hardcoded wrong mappings
    if grep -q "j.*down\|j.*Move down" "$file" 2>/dev/null; then
        issues+=("ERROR: j mapped to down (should be EXIT)")
    fi

    if grep -q "k.*up\|k.*Move up" "$file" 2>/dev/null; then
        issues+=("ERROR: k mapped to up (should be down)")
    fi

    if [[ ${#issues[@]} -gt 0 ]]; then
        echo "Key binding issues in $file:"
        printf '  %s\n' "${issues[@]}"
        return 1
    fi

    return 0
}

# Export key checking functions
export -f get_key key_matches show_key_help validate_key_handler