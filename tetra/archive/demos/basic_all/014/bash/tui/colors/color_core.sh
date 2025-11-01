#!/usr/bin/env bash

# Color Core - Distance-based verb×noun coloring from 010
# Computes unique colors based on string distance

# Color distance cache
declare -gA HEX_TO_256_CACHE

# Current color state (avoids recomputation)
declare -g CURRENT_VERB_COLOR=""
declare -g CURRENT_NOUN_COLOR=""

# Compute distance between two strings
string_distance() {
    local s1="$1"
    local s2="$2"
    local len1=${#s1}
    local len2=${#s2}

    # Simple hash-based distance
    local hash1=0
    local hash2=0

    for ((i=0; i<len1; i++)); do
        printf -v ascii '%d' "'${s1:i:1}"
        hash1=$((hash1 + ascii))
    done

    for ((i=0; i<len2; i++)); do
        printf -v ascii '%d' "'${s2:i:1}"
        hash2=$((hash2 + ascii))
    done

    echo $((hash1 + hash2))
}

# Convert hash to 256-color code (cached)
hash_to_color() {
    local hash="$1"

    # Check cache
    if [[ -n "${HEX_TO_256_CACHE[$hash]}" ]]; then
        echo "${HEX_TO_256_CACHE[$hash]}"
        return
    fi

    # Compute color (avoid black/white/grays: 16-231 range)
    local color=$(( (hash % 180) + 36 ))

    # Cache result
    HEX_TO_256_CACHE[$hash]=$color

    echo "$color"
}

# Refresh color state for verb×noun pair
refresh_color_state_cached() {
    local verb="$1"
    local noun="$2"

    local verb_hash=$(string_distance "$verb" "")
    local noun_hash=$(string_distance "$noun" "")

    local verb_color=$(hash_to_color "$verb_hash")
    local noun_color=$(hash_to_color "$noun_hash")

    CURRENT_VERB_COLOR="\033[38;5;${verb_color}m"
    CURRENT_NOUN_COLOR="\033[38;5;${noun_color}m"
}

# Render verb×noun with colors
render_action_verb_noun() {
    local verb="$1"
    local noun="$2"

    # Use cached colors if already set for this pair
    if [[ -z "$CURRENT_VERB_COLOR" || -z "$CURRENT_NOUN_COLOR" ]]; then
        refresh_color_state_cached "$verb" "$noun"
    fi

    printf "${CURRENT_VERB_COLOR}%s\033[0m×${CURRENT_NOUN_COLOR}%s\033[0m" "$verb" "$noun"
}

# Reset colors
reset_color() {
    printf "\033[0m"
}
