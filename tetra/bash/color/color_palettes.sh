#!/usr/bin/env bash

# Source guard
[[ -n "${_COLOR_PALETTES_LOADED}" ]] && return 0
_COLOR_PALETTES_LOADED=1

source "$(dirname "${BASH_SOURCE[0]}")/color_core.sh"

# =============================================================================
# TDS 8x4 PALETTE SYSTEM
# =============================================================================
#
# ENV[0-7]   "Where" - A/B alternating contexts (theme-specific)
# MODE[0-7]  "How"   - bad/warning/good/info + dims (theme-specific)
# VERBS[0-7] "Do"    - rainbow cycle for collections (universal)
# NOUNS[0-7] "What"  - dark→bright gradient (theme-specific)

# ENV_PRIMARY - Alternating hue families for context distinction
# [0,2,4,6] = hue A (greens), [1,3,5,7] = hue B (teals)
ENV_PRIMARY=(
    "00AA00"  # 0: A primary (green)
    "00AAAA"  # 1: B primary (teal)
    "44DD44"  # 2: A light
    "44DDDD"  # 3: B light
    "338833"  # 4: A muted
    "338888"  # 5: B muted
    "225522"  # 6: A dim
    "225555"  # 7: B dim
)

# MODE_PRIMARY - Semantic states (theme-specific colors)
# [0]=bad [1]=warning [2]=good [3]=info [4-7]=dim versions (via desaturate_hex)
_MODE_BAD="DD4444"
_MODE_WARNING="DDAA44"
_MODE_GOOD="44DD44"
_MODE_INFO="4488DD"
MODE_PRIMARY=(
    "$_MODE_BAD"                          # 0: bad/error (red)
    "$_MODE_WARNING"                      # 1: warning (amber)
    "$_MODE_GOOD"                         # 2: good/success (green)
    "$_MODE_INFO"                         # 3: info (blue)
    "$(desaturate_hex "$_MODE_BAD" 3)"    # 4: bad dim
    "$(desaturate_hex "$_MODE_WARNING" 3)" # 5: warning dim
    "$(desaturate_hex "$_MODE_GOOD" 3)"   # 6: good dim
    "$(desaturate_hex "$_MODE_INFO" 3)"   # 7: info dim
)

# VERBS_PRIMARY - Rainbow cycle for collection distinction (universal)
# 8 maximally distinct hues spread across color wheel
VERBS_PRIMARY=(
    "E53935"  # 0: red (0°)
    "FB8C00"  # 1: orange (30°)
    "FDD835"  # 2: yellow (60°)
    "43A047"  # 3: green (120°)
    "00ACC1"  # 4: cyan (180°)
    "1E88E5"  # 5: blue (210°)
    "8E24AA"  # 6: purple (270°)
    "EC407A"  # 7: pink (330°)
)

# NOUNS_PRIMARY - Text gradient dark→bright
# [0]=darkest → [7]=brightest
NOUNS_PRIMARY=(
    "333333"  # 0: darkest
    "555555"  # 1: dark
    "777777"  # 2: dim
    "999999"  # 3: muted
    "AAAAAA"  # 4: subtle
    "CCCCCC"  # 5: light
    "DDDDDD"  # 6: pale
    "EEEEEE"  # 7: brightest
)

# Generate complementary colors
ENV_COMPLEMENT=()
MODE_COMPLEMENT=()
VERBS_COMPLEMENT=()
NOUNS_COMPLEMENT=()

generate_complements() {
    local -n primary=$1
    local -n complement=$2

    for hex in "${primary[@]}"; do
        # Parse hex directly to avoid IFS issues
        local hex_clean="${hex#\#}"
        if [[ ! "$hex_clean" =~ ^[0-9A-Fa-f]{6}$ ]]; then
            complement+=("$hex")  # Keep original if invalid
            continue
        fi
        local r=$((16#${hex_clean:0:2}))
        local g=$((16#${hex_clean:2:2}))
        local b=$((16#${hex_clean:4:2}))
        complement+=($(rgb_to_hex $((255-r)) $((255-g)) $((255-b))))
    done
}

# Initialize colors
init_colors() {
    generate_complements ENV_PRIMARY ENV_COMPLEMENT
    generate_complements MODE_PRIMARY MODE_COMPLEMENT
    generate_complements VERBS_PRIMARY VERBS_COMPLEMENT
    generate_complements NOUNS_PRIMARY NOUNS_COMPLEMENT
}

# Call initialization
init_colors

# Color scheme functions (using array indices 0-15)
env_color() {
    local index=$1 variant=${2:-primary}
    local color
    if (( index < 8 )); then
        case "$variant" in
            primary) color="${ENV_PRIMARY[$index]}" ;;
            bright) color="$(brighten "${ENV_PRIMARY[$index]}")" ;;
            dark) color="$(darken "${ENV_PRIMARY[$index]}")" ;;
        esac
    else
        local comp_index=$((index - 8))
        case "$variant" in
            primary) color="${ENV_COMPLEMENT[$comp_index]}" ;;
            bright) color="$(brighten "${ENV_COMPLEMENT[$comp_index]}")" ;;
            dark) color="$(darken "${ENV_COMPLEMENT[$comp_index]}")" ;;
        esac
    fi
    text_color "$color"
}

mode_color() {
    local index=$1 variant=${2:-primary}
    local color
    if (( index < 8 )); then
        case "$variant" in
            primary) color="${MODE_PRIMARY[$index]}" ;;
            bright) color="$(brighten "${MODE_PRIMARY[$index]}")" ;;
            dark) color="$(darken "${MODE_PRIMARY[$index]}")" ;;
        esac
    else
        local comp_index=$((index - 8))
        case "$variant" in
            primary) color="${MODE_COMPLEMENT[$comp_index]}" ;;
            bright) color="$(brighten "${MODE_COMPLEMENT[$comp_index]}")" ;;
            dark) color="$(darken "${MODE_COMPLEMENT[$comp_index]}")" ;;
        esac
    fi
    text_color "$color"
}

verbs_color() {
    local index=$1 variant=${2:-primary}
    local color
    if (( index < 8 )); then
        case "$variant" in
            primary) color="${VERBS_PRIMARY[$index]}" ;;
            bright) color="$(brighten "${VERBS_PRIMARY[$index]}")" ;;
            dark) color="$(darken "${VERBS_PRIMARY[$index]}")" ;;
        esac
    else
        local comp_index=$((index - 8))
        case "$variant" in
            primary) color="${VERBS_COMPLEMENT[$comp_index]}" ;;
            bright) color="$(brighten "${VERBS_COMPLEMENT[$comp_index]}")" ;;
            dark) color="$(darken "${VERBS_COMPLEMENT[$comp_index]}")" ;;
        esac
    fi
    text_color "$color"
}

nouns_color() {
    local index=$1 variant=${2:-primary}
    local color
    if (( index < 8 )); then
        case "$variant" in
            primary) color="${NOUNS_PRIMARY[$index]}" ;;
            bright) color="$(brighten "${NOUNS_PRIMARY[$index]}")" ;;
            dark) color="$(darken "${NOUNS_PRIMARY[$index]}")" ;;
        esac
    else
        local comp_index=$((index - 8))
        case "$variant" in
            primary) color="${NOUNS_COMPLEMENT[$comp_index]}" ;;
            bright) color="$(brighten "${NOUNS_COMPLEMENT[$comp_index]}")" ;;
            dark) color="$(darken "${NOUNS_COMPLEMENT[$comp_index]}")" ;;
        esac
    fi
    text_color "$color"
}