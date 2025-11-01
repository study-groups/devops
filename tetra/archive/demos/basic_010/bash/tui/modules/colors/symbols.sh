#!/usr/bin/env bash

# DevOps Symbol Asset Library - 8 groups of 16 symbols each

# Group 1: Solid Geometric (bitmap-style rendering)
declare -a SOLID_SHAPES=(
    "◆" "◉" "◊" "●" "◐" "◑" "◒" "◓" "◔" "◕" "◖" "◗" "■" "▪" "▫" "▬"
)

# Group 2: Line Geometric (vector-style with holes)
declare -a LINE_SHAPES=(
    "◇" "◈" "○" "◎" "□" "▢" "▣" "▤" "▥" "▦" "▧" "▨" "▩" "▭" "▮" "▯"
)

# Group 3: Musical Notation
declare -a MUSICAL=(
    "♩" "♪" "♫" "♬" "♭" "♮" "♯" "𝄞" "𝄢" "𝄡" "𝄪" "𝄫" "𝄬" "𝄭" "𝄰" "𝄱"
)

# Group 4: Gaming Elements
declare -a GAMING=(
    "⚀" "⚁" "⚂" "⚃" "⚄" "⚅" "♠" "♡" "♢" "♣" "♤" "♥" "♦" "♧" "⚈" "⚉"
)

# Group 5: Technical Arrows
declare -a TECHNICAL=(
    "↑" "↓" "←" "→" "↖" "↗" "↘" "↙" "↔" "↕" "⇄" "⇅" "⇈" "⇊" "⇉" "⇇"
)

# Group 6: Natural Elements
declare -a NATURAL=(
    "❄" "❅" "❆" "⛄" "⛅" "⛈" "⛉" "⛊" "⛋" "⛌" "⛍" "⛎" "⛏" "⛐" "⛑" "⛒"
)

# Group 7: Cultural Symbols
declare -a CULTURAL=(
    "☯" "☪" "☫" "☬" "☭" "☮" "☸" "☹" "☺" "☻" "⚕" "⚖" "⚗" "⚘" "⚙" "⚚"
)

# Group 8: Abstract Patterns
declare -a ABSTRACT=(
    "⌘" "⌬" "⌯" "⌰" "⌱" "⌲" "⌳" "⌴" "⌵" "⌶" "⌷" "⌸" "⌹" "⌺" "⌻" "⌼"
)

# Filtered symbol pools
declare -a SOLID_SYMBOLS=(
    "${SOLID_SHAPES[@]}" "${GAMING[@]}" "${TECHNICAL[@]}" "${ABSTRACT[@]}"
)

declare -a LINE_SYMBOLS=(
    "${LINE_SHAPES[@]}" "${MUSICAL[@]}" "${NATURAL[@]}" "${CULTURAL[@]}"
)

# Master symbol pool (all groups combined)
declare -a ALL_SYMBOLS=(
    "${SOLID_SHAPES[@]}" "${LINE_SHAPES[@]}" "${MUSICAL[@]}" "${GAMING[@]}"
    "${TECHNICAL[@]}" "${NATURAL[@]}" "${CULTURAL[@]}" "${ABSTRACT[@]}"
)

# Group metadata
declare -A GROUP_NAMES=(
    [0]="GEOMETRIC" [1]="CELESTIAL" [2]="MUSICAL" [3]="GAMING"
    [4]="TECHNICAL" [5]="NATURAL" [6]="CULTURAL" [7]="ABSTRACT"
)

# Export functions
get_random_symbols() {
    local count=${1:-4}
    local type=${2:-solid}  # solid, line, or all
    local selected=()
    local source_array

    case "$type" in
        solid) source_array=("${SOLID_SYMBOLS[@]}") ;;
        line) source_array=("${LINE_SYMBOLS[@]}") ;;
        *) source_array=("${ALL_SYMBOLS[@]}") ;;
    esac

    for ((i=0; i<count; i++)); do
        local idx=$((RANDOM % ${#source_array[@]}))
        selected+=("${source_array[$idx]}")
    done

    echo "${selected[@]}"
}

get_group_symbols() {
    local group_name=${1^^}
    case "$group_name" in
        GEOMETRIC) echo "${GEOMETRIC[@]}" ;;
        CELESTIAL) echo "${CELESTIAL[@]}" ;;
        MUSICAL) echo "${MUSICAL[@]}" ;;
        GAMING) echo "${GAMING[@]}" ;;
        TECHNICAL) echo "${TECHNICAL[@]}" ;;
        NATURAL) echo "${NATURAL[@]}" ;;
        CULTURAL) echo "${CULTURAL[@]}" ;;
        ABSTRACT) echo "${ABSTRACT[@]}" ;;
        *) echo "Unknown group: $group_name" >&2; return 1 ;;
    esac
}

show_symbol_library() {
    echo "=== DevOps Symbol Asset Library ==="
    echo "Total symbols: ${#ALL_SYMBOLS[@]} (8 groups × 16 each)"
    echo

    for i in {0..7}; do
        local group_name="${GROUP_NAMES[$i]}"
        printf "%-10s: " "$group_name"
        local -n group_ref=${group_name}
        for symbol in "${group_ref[@]}"; do
            printf "%s " "$symbol"
        done
        echo
    done
    echo
}

# Export the symbol arrays and functions
export ALL_SYMBOLS GEOMETRIC CELESTIAL MUSICAL GAMING TECHNICAL NATURAL CULTURAL ABSTRACT
export GROUP_NAMES
export -f get_random_symbols get_group_symbols show_symbol_library

# Demo if run directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    show_symbol_library
    echo "Random 4: $(get_random_symbols 4)"
    echo "Random 8: $(get_random_symbols 8)"
fi