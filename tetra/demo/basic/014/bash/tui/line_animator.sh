#!/usr/bin/env bash

# Line Animator - Sophisticated animated separator lines
# Concerned only with color, length, position, and marker placement

# Line configuration
declare -g LINE_LENGTH=80
declare -g LINE_ALIGN="center"  # left, center, right
declare -g LINE_CHAR="─"
declare -g LINE_MARKER="○"
declare -g LINE_MARKER_POSITION=50  # 0-100 percentage

# Colors (ANSI codes)
declare -g LINE_COLOR="\033[2m"      # Dim
declare -g LINE_MARKER_COLOR="\033[1;36m"  # Bright cyan
declare -g LINE_RESET="\033[0m"

# Initialize line animator
line_init() {
    LINE_LENGTH=${TUI_WIDTH:-80}
    LINE_ALIGN="center"
    LINE_MARKER_POSITION=50
}

# Set line length
line_set_length() {
    LINE_LENGTH="${1:-80}"
}

# Set line alignment
line_set_align() {
    local align="${1:-center}"
    case "$align" in
        left|center|right) LINE_ALIGN="$align" ;;
        *) LINE_ALIGN="center" ;;
    esac
}

# Set line character
line_set_char() {
    LINE_CHAR="${1:-─}"
}

# Set marker character
line_set_marker() {
    LINE_MARKER="${1:-○}"
}

# Set marker position (0-100)
line_set_marker_position() {
    local pos="${1:-50}"
    [[ $pos -lt 0 ]] && pos=0
    [[ $pos -gt 100 ]] && pos=100
    LINE_MARKER_POSITION=$pos
}

# Set colors
line_set_color() {
    LINE_COLOR="${1:-\033[2m}"
}

line_set_marker_color() {
    LINE_MARKER_COLOR="${1:-\033[1;36m}"
}

# Get middle index of line
line_get_middle() {
    echo $((LINE_LENGTH / 2))
}

# Calculate marker index from position percentage
line_get_marker_index() {
    local pos="${1:-$LINE_MARKER_POSITION}"
    echo $(( (LINE_LENGTH * pos) / 100 ))
}

# Render the line with marker at position
line_render() {
    local marker_idx=$(line_get_marker_index)
    local line=""

    # Build line with marker
    for ((i=0; i<LINE_LENGTH; i++)); do
        if [[ $i -eq $marker_idx ]]; then
            line+="${LINE_MARKER}"
        else
            line+="${LINE_CHAR}"
        fi
    done

    # Apply alignment
    case "$LINE_ALIGN" in
        left)
            printf "${LINE_COLOR}%s${LINE_RESET}\n" "$line"
            ;;
        center)
            local term_width=${TUI_WIDTH:-80}
            local padding=$(( (term_width - LINE_LENGTH) / 2 ))
            [[ $padding -lt 0 ]] && padding=0
            printf "%*s${LINE_COLOR}%s${LINE_RESET}\n" $padding "" "$line"
            ;;
        right)
            local term_width=${TUI_WIDTH:-80}
            local padding=$((term_width - LINE_LENGTH))
            [[ $padding -lt 0 ]] && padding=0
            printf "%*s${LINE_COLOR}%s${LINE_RESET}\n" $padding "" "$line"
            ;;
    esac
}

# Render line with colored marker at position
line_render_colored() {
    local marker_idx=$(line_get_marker_index)
    local line=""

    # Build line with colored marker
    printf "${LINE_COLOR}"
    for ((i=0; i<LINE_LENGTH; i++)); do
        if [[ $i -eq $marker_idx ]]; then
            printf "${LINE_MARKER_COLOR}%s${LINE_COLOR}" "$LINE_MARKER"
        else
            printf "%s" "${LINE_CHAR}"
        fi
    done
    printf "${LINE_RESET}\n"
}

# Render line aligned with proper spacing
line_render_aligned() {
    local marker_idx=$(line_get_marker_index)

    # Apply alignment padding
    case "$LINE_ALIGN" in
        left)
            local padding=0
            ;;
        center)
            local term_width=${TUI_WIDTH:-80}
            local padding=$(( (term_width - LINE_LENGTH) / 2 ))
            [[ $padding -lt 0 ]] && padding=0
            ;;
        right)
            local term_width=${TUI_WIDTH:-80}
            local padding=$((term_width - LINE_LENGTH))
            [[ $padding -lt 0 ]] && padding=0
            ;;
    esac

    # Output padding
    [[ $padding -gt 0 ]] && printf "%*s" $padding ""

    # Build line with colored marker
    printf "${LINE_COLOR}"
    for ((i=0; i<LINE_LENGTH; i++)); do
        if [[ $i -eq $marker_idx ]]; then
            printf "${LINE_MARKER_COLOR}%s${LINE_COLOR}" "$LINE_MARKER"
        else
            printf "%s" "${LINE_CHAR}"
        fi
    done
    printf "${LINE_RESET}\n"
}

# Animate marker using oscillator position
line_animate_from_osc() {
    local osc_pos="${1:-50}"  # 0-100 from oscillator
    line_set_marker_position "$osc_pos"
    line_render_aligned
}

# Render line with custom marker position (one-shot)
line_render_at() {
    local pos="${1:-50}"
    line_set_marker_position "$pos"
    line_render_aligned
}
