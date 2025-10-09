#!/usr/bin/env bash

source ./color_palettes.sh

show_palette_line() {
    local -n primary=$1
    local -n complement=$2
    local label=$3

    # Calculate palette line width (visible characters only)
    # "ENV  : ██ ██ ██ ██  ██ ██ ██ ██     ██ ██ ██ ██  ██ ██ ██ ██  "
    # 7 + 8*2 + 8*1 + 5 + 8*2 + 8*1 = 7 + 16 + 8 + 5 + 16 + 8 = 60
    local palette_line_width=60
    local terminal_width=$(tput cols 2>/dev/null || echo 80)
    local palette_padding=$(( (terminal_width - palette_line_width) / 2 ))

    # Add centering padding for palette lines (different from examples)
    [[ $palette_padding -gt 0 ]] && printf "%*s" $palette_padding ""

    printf "%-5s: " "$label"
    for i in "${!primary[@]}"; do
        printf "$(fg_color "${primary[i]}")██$(reset_color) "
        if (( (i + 1) % 4 == 0 )); then
            printf " "
        fi
    done
    printf "   "
    for i in "${!complement[@]}"; do
        printf "$(fg_color "${complement[i]}")██$(reset_color) "
        if (( (i + 1) % 4 == 0 )); then
            printf " "
        fi
    done
    echo
}

show_all_palettes() {
    echo
    show_palette_line ENV_PRIMARY ENV_COMPLEMENT "ENV"
    echo
    show_palette_line MODE_PRIMARY MODE_COMPLEMENT "MODE"
    echo
    show_palette_line VERBS_PRIMARY VERBS_COMPLEMENT "VERBS"
    echo
    show_palette_line NOUNS_PRIMARY NOUNS_COMPLEMENT "NOUNS"
    echo
    source ./symbols.sh

    # Show 8 example rows with progressive desaturation
    for row in {1..8}; do
        # Get random symbols for this row
        local env_symbols=($(get_random_symbols 4 solid))
        local mode_symbols=($(get_random_symbols 4 solid))
        local nouns_symbols=($(get_random_symbols 2 solid))
        local verbs_symbols=($(get_random_symbols 2 solid))

        # Calculate desaturation level (0=full color, 7=grayscale)
        local desat_level=$((row - 1))

        # Calculate centering for new format
        # " ◆◇ ENV ◈◉  ★☆ MOD ☀☁  NOUNS ♩♪  ◑ ⚁ VERBS "
        local examples_content_width=48
        local terminal_width=$(tput cols 2>/dev/null || echo 80)
        local examples_padding=$(( (terminal_width - examples_content_width) / 2 ))

        [[ $examples_padding -gt 0 ]] && printf "%*s" $examples_padding ""

        # ENV: symbols on left, space, ENV, space, symbols
        printf "$(desaturated_bg_only "${ENV_PRIMARY[0]}" $desat_level)$(desaturated_fg_only "${ENV_COMPLEMENT[0]}" $desat_level) %s%s ENV %s%s $(reset_color) " \
            "${env_symbols[0]}" "${env_symbols[1]}" "${env_symbols[2]}" "${env_symbols[3]}"

        # MOD: symbols on left, space, MOD, space, symbols
        printf "$(desaturated_bg_only "${MODE_PRIMARY[1]}" $desat_level)$(desaturated_fg_only "${MODE_COMPLEMENT[1]}" $desat_level) %s%s MOD %s%s $(reset_color) " \
            "${mode_symbols[0]}" "${mode_symbols[1]}" "${mode_symbols[2]}" "${mode_symbols[3]}"

        # NOUNS: keep same format
        printf "$(desaturated_bg_only "${NOUNS_PRIMARY[2]}" $desat_level)$(desaturated_fg_only "${NOUNS_COMPLEMENT[2]}" $desat_level) NOUNS %s%s $(reset_color) " \
            "${nouns_symbols[0]}" "${nouns_symbols[1]}"

        # VERBS: symbols on left with space between, then VERBS
        printf "$(desaturated_bg_only "${VERBS_PRIMARY[3]}" $desat_level)$(desaturated_fg_only "${VERBS_COMPLEMENT[3]}" $desat_level) %s %s VERBS $(reset_color)" \
            "${verbs_symbols[0]}" "${verbs_symbols[1]}"

        echo
    done
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    show_all_palettes
fi