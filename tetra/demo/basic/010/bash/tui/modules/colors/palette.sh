#!/usr/bin/env bash

COLORS_DIR="$(dirname "${BASH_SOURCE[0]}")"
source "$COLORS_DIR/color_palettes.sh"

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
    source "$COLORS_DIR/symbols.sh"

    # Section D title - left aligned with stanza
    local terminal_width=$(tput cols 2>/dev/null || echo 80)
    local title_padding=$(( (terminal_width - 48) / 2 ))
    [[ $title_padding -gt 0 ]] && printf "%*s" $title_padding ""
    echo "$(printf "\033[2mNo background - foreground only\033[0m")"

    # Fourth section: no background, foreground only
    for row in {1..8}; do
        local env_symbols=($(get_random_symbols 4 solid))
        local mode_symbols=($(get_random_symbols 4 solid))
        local nouns_symbols=($(get_random_symbols 2 solid))
        local verbs_symbols=($(get_random_symbols 2 solid))

        local examples_padding=$(( ($(tput cols 2>/dev/null || echo 80) - 48) / 2 ))
        [[ $examples_padding -gt 0 ]] && printf "%*s" $examples_padding ""

        # No background, foreground colors only
        printf "$(fg_only "${ENV_COMPLEMENT[0]}")  ENV %s%s%s%s $(reset_color)$(fg_only "${MODE_COMPLEMENT[1]}") %s%s%s%s MOD $(reset_color)$(fg_only "${NOUNS_COMPLEMENT[2]}") NOUNS %s %s $(reset_color)$(fg_only "${VERBS_COMPLEMENT[3]}") %s %s VERBS $(reset_color)" \
            "${env_symbols[0]}" "${env_symbols[1]}" "${env_symbols[2]}" "${env_symbols[3]}" \
            "${mode_symbols[0]}" "${mode_symbols[1]}" "${mode_symbols[2]}" "${mode_symbols[3]}" \
            "${nouns_symbols[0]}" "${nouns_symbols[1]}" "${verbs_symbols[0]}" "${verbs_symbols[1]}"

        echo
    done

    echo
    echo

    # Section A title - left aligned with stanza
    [[ $title_padding -gt 0 ]] && printf "%*s" $title_padding ""
    echo "$(printf "\033[2mDesaturating both fg+bg\033[0m")"

    # Show 8 example rows with progressive desaturation (reversed)
    for row in {8..1}; do
        # Get random symbols for this row
        local env_symbols=($(get_random_symbols 4 solid))
        local mode_symbols=($(get_random_symbols 4 solid))
        local nouns_symbols=($(get_random_symbols 2 solid))
        local verbs_symbols=($(get_random_symbols 2 solid))

        # Calculate desaturation level (7=grayscale, 0=full color)
        local desat_level=$((row - 1))

        # Calculate centering for new format
        # " ◆◇ ENV ◈◉  ★☆ MOD ☀☁  NOUNS ♩♪  ◑ ⚁ VERBS "
        local examples_content_width=48
        local terminal_width=$(tput cols 2>/dev/null || echo 80)
        local examples_padding=$(( (terminal_width - examples_content_width) / 2 ))

        [[ $examples_padding -gt 0 ]] && printf "%*s" $examples_padding ""

        # Fixed labels: ENV, MOD, NOUNS, VERBS - no pipes between sections
        printf "$(desaturated_bg_only "${ENV_PRIMARY[0]}" $desat_level)$(desaturated_fg_only "${ENV_COMPLEMENT[0]}" $desat_level)  ENV %s%s%s%s $(reset_color)$(desaturated_bg_only "${MODE_PRIMARY[1]}" $desat_level)$(desaturated_fg_only "${MODE_COMPLEMENT[1]}" $desat_level) %s%s%s%s MOD $(reset_color)$(desaturated_bg_only "${NOUNS_PRIMARY[2]}" $desat_level)$(desaturated_fg_only "${NOUNS_COMPLEMENT[2]}" $desat_level) NOUNS %s %s $(reset_color)$(desaturated_bg_only "${VERBS_PRIMARY[3]}" $desat_level)$(desaturated_fg_only "${VERBS_COMPLEMENT[3]}" $desat_level) %s %s VERBS $(reset_color)" \
            "${env_symbols[0]}" "${env_symbols[1]}" "${env_symbols[2]}" "${env_symbols[3]}" \
            "${mode_symbols[0]}" "${mode_symbols[1]}" "${mode_symbols[2]}" "${mode_symbols[3]}" \
            "${nouns_symbols[0]}" "${nouns_symbols[1]}" "${verbs_symbols[0]}" "${verbs_symbols[1]}"

        echo
    done

    echo
    echo

    # Section B title - left aligned with stanza
    [[ $title_padding -gt 0 ]] && printf "%*s" $title_padding ""
    echo "$(printf "\033[2mBg desaturating, fg normal\033[0m")"

    # Second section: desaturated background, normal foreground
    for row in {1..8}; do
        local env_symbols=($(get_random_symbols 4 solid))
        local mode_symbols=($(get_random_symbols 4 solid))
        local nouns_symbols=($(get_random_symbols 2 solid))
        local verbs_symbols=($(get_random_symbols 2 solid))

        local desat_level=$((row - 1))
        local examples_padding=$(( ($(tput cols 2>/dev/null || echo 80) - 48) / 2 ))
        [[ $examples_padding -gt 0 ]] && printf "%*s" $examples_padding ""

        # Fixed labels: ENV, MOD, NOUNS, VERBS - no pipes between sections
        printf "$(desaturated_bg_only "${ENV_PRIMARY[0]}" $desat_level)$(fg_only "${ENV_COMPLEMENT[0]}")  ENV %s%s%s%s $(reset_color)$(desaturated_bg_only "${MODE_PRIMARY[1]}" $desat_level)$(fg_only "${MODE_COMPLEMENT[1]}") %s%s%s%s MOD $(reset_color)$(desaturated_bg_only "${NOUNS_PRIMARY[2]}" $desat_level)$(fg_only "${NOUNS_COMPLEMENT[2]}") NOUNS %s %s $(reset_color)$(desaturated_bg_only "${VERBS_PRIMARY[3]}" $desat_level)$(fg_only "${VERBS_COMPLEMENT[3]}") %s %s VERBS $(reset_color)" \
            "${env_symbols[0]}" "${env_symbols[1]}" "${env_symbols[2]}" "${env_symbols[3]}" \
            "${mode_symbols[0]}" "${mode_symbols[1]}" "${mode_symbols[2]}" "${mode_symbols[3]}" \
            "${nouns_symbols[0]}" "${nouns_symbols[1]}" "${verbs_symbols[0]}" "${verbs_symbols[1]}"

        echo
    done

    echo
    echo

    # Section C title - left aligned with stanza
    [[ $title_padding -gt 0 ]] && printf "%*s" $title_padding ""
    echo "$(printf "\033[2mText brightness/boldness fade\033[0m")"

    # Third section: text brightness/boldness fade
    for row in {1..8}; do
        local env_symbols=($(get_random_symbols 4 solid))
        local mode_symbols=($(get_random_symbols 4 solid))
        local nouns_symbols=($(get_random_symbols 2 solid))
        local verbs_symbols=($(get_random_symbols 2 solid))

        local brightness_level=$((8 - row))  # 7=brightest, 0=dimmest
        local bold=""
        local dim=""

        if (( brightness_level >= 6 )); then
            bold="\033[1m"  # Bold - rows 1,2
        elif (( brightness_level >= 4 )); then
            :  # Normal - rows 3,4,5 (no special formatting)
        else
            dim="\033[2m"   # Dim - rows 6,7,8
        fi

        local examples_padding=$(( ($(tput cols 2>/dev/null || echo 80) - 48) / 2 ))
        [[ $examples_padding -gt 0 ]] && printf "%*s" $examples_padding ""

        # Fixed labels: ENV, MOD, NOUNS, VERBS - no pipes between sections
        printf "$(bg_only "${ENV_PRIMARY[0]}")$(fg_only "${ENV_COMPLEMENT[0]}")$bold$dim  ENV %s%s%s%s $(reset_color)$(bg_only "${MODE_PRIMARY[1]}")$(fg_only "${MODE_COMPLEMENT[1]}")$bold$dim %s%s%s%s MOD $(reset_color)$(bg_only "${NOUNS_PRIMARY[2]}")$(fg_only "${NOUNS_COMPLEMENT[2]}")$bold$dim NOUNS %s %s $(reset_color)$(bg_only "${VERBS_PRIMARY[3]}")$(fg_only "${VERBS_COMPLEMENT[3]}")$bold$dim %s %s VERBS $(reset_color)" \
            "${env_symbols[0]}" "${env_symbols[1]}" "${env_symbols[2]}" "${env_symbols[3]}" \
            "${mode_symbols[0]}" "${mode_symbols[1]}" "${mode_symbols[2]}" "${mode_symbols[3]}" \
            "${nouns_symbols[0]}" "${nouns_symbols[1]}" "${verbs_symbols[0]}" "${verbs_symbols[1]}"

        echo
    done
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    show_all_palettes
fi