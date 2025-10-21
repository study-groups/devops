#!/usr/bin/env bash

# Source guard
[[ -n "${_COLOR_PALETTES_LOADED}" ]] && return 0
_COLOR_PALETTES_LOADED=1

source "$(dirname "${BASH_SOURCE[0]}")/color_core.sh"

# Primary color palettes (8 colors each, no names)
declare -a ENV_PRIMARY=(
    "00AA00" "22DD22" "44AA44" "66FF66"
    "00DD88" "006644" "88FF00" "00AAAA"
)

declare -a MODE_PRIMARY=(
    "0088FF" "0044AA" "4400AA" "000088"
    "0066FF" "4488AA" "88AAFF" "6688AA"
)

declare -a VERBS_PRIMARY=(
    "FF0044" "FF6644" "AA4400" "FFAA00"
    "AA6600" "CC6633" "FFCC00" "FF4400"
)

declare -a NOUNS_PRIMARY=(
    "AA00AA" "FF00FF" "8800AA" "CC44CC"
    "AA0088" "880088" "FF88FF" "CC00CC"
)

# Generate complementary colors
declare -a ENV_COMPLEMENT MODE_COMPLEMENT VERBS_COMPLEMENT NOUNS_COMPLEMENT

generate_complements() {
    local -n primary=$1
    local -n complement=$2

    for hex in "${primary[@]}"; do
        local r g b
        read r g b < <(hex_to_rgb "$hex")
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