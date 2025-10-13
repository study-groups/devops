#!/usr/bin/env bash

# Simplified Color Module for Demo 013
# Smart verb/noun coloring with distance algorithm

# Load dependencies
COLORS_DIR="$(dirname "${BASH_SOURCE[0]}")"
source "$COLORS_DIR/color_core.sh"
source "$COLORS_DIR/color_palettes.sh"
source "$COLORS_DIR/color_ui.sh"

# Current color state (prevent collisions)
declare -A CURRENT_COLOR_STATE=(
    [verb_color]=""
    [noun_color]=""
)

# === COLOR DISTANCE ALGORITHM ===

# Weighted RGB distance for perceptual separation
weighted_rgb_distance() {
    local hex1="$1" hex2="$2"

    local rgb1=$(hex_to_rgb "$hex1")
    local rgb2=$(hex_to_rgb "$hex2")

    local r1=${rgb1%% *} g1=${rgb1#* }; g1=${g1%% *}; local b1=${rgb1##* }
    local r2=${rgb2%% *} g2=${rgb2#* }; g2=${g2%% *}; local b2=${rgb2##* }

    local dr=$((r1 - r2))
    local dg=$((g1 - g2))
    local db=$((b1 - b2))

    # Weighted: red=0.30, green=0.59, blue=0.11
    local distance=$(( (dr*dr*30 + dg*dg*59 + db*db*11) / 100 ))

    echo "$distance"
}

# Find color with maximum distance from another color
find_max_distance_color() {
    local avoid_color="$1"
    local palette_name="${2:-ENV_PRIMARY}"

    local max_distance=0
    local best_color=""
    local -n palette_ref=$palette_name

    for color in "${palette_ref[@]}"; do
        local distance=$(weighted_rgb_distance "$color" "$avoid_color")
        if (( distance > max_distance )); then
            max_distance=$distance
            best_color=$color
        fi
    done

    echo "$best_color"
}

# === SMART COLOR FUNCTIONS ===

# Get verb color (bold, from palette)
get_smart_verb_color() {
    local verb="$1"
    local verb_index="${VERBS[$verb]:-0}"
    local verb_color="${VERBS_PRIMARY[$verb_index]}"

    CURRENT_COLOR_STATE[verb_color]="$verb_color"

    printf "\033[1m"  # Bold
    text_color "$verb_color"
}

# Get noun color (bold, maximally distant from verb)
get_smart_noun_color() {
    local noun="$1"
    local verb_color="${CURRENT_COLOR_STATE[verb_color]}"

    # Find noun color that's maximally distant from verb
    local noun_color
    if [[ -n "$verb_color" ]]; then
        noun_color=$(find_max_distance_color "$verb_color" "NOUNS_PRIMARY")
    else
        local noun_index="${NOUNS[$noun]:-0}"
        noun_color="${NOUNS_PRIMARY[$noun_index]}"
    fi

    CURRENT_COLOR_STATE[noun_color]="$noun_color"

    printf "\033[1m"  # Bold
    text_color "$noun_color"
}

# === RENDERING FUNCTIONS ===

# Render verb with smart color
safe_verb_display() {
    local verb="$1"
    get_smart_verb_color "$verb"
    printf "%s" "$verb"
    reset_color
}

# Render noun with smart color
safe_noun_display() {
    local noun="$1"
    get_smart_noun_color "$noun"
    printf "%s" "$noun"
    reset_color
}

# Render complete action: verb:noun with colors
render_action_verb_noun() {
    local verb="$1"
    local noun="$2"

    safe_verb_display "$verb"
    printf ":"
    safe_noun_display "$noun"
}

# Refresh color state when action changes
refresh_color_state() {
    local verb="$1"
    local noun="$2"

    CURRENT_COLOR_STATE[verb_color]=""
    CURRENT_COLOR_STATE[noun_color]=""

    # Pre-calculate colors
    get_smart_verb_color "$verb" > /dev/null
    get_smart_noun_color "$noun" > /dev/null
}

# Cache for optimized rendering
refresh_color_state_cached() {
    refresh_color_state "$1" "$2"
}
