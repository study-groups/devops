#!/usr/bin/env bash

# TDS ANSI Utilities
# Handle ANSI escape codes for proper width calculation and manipulation

# Strip all ANSI escape codes from text
# Returns: text without ANSI codes
tds_strip_ansi() {
    local text="$1"
    # Remove all ANSI escape sequences: ESC[...m
    echo "$text" | sed 's/\x1b\[[0-9;]*m//g'
}

# Calculate visual width of text (excluding ANSI codes)
# Returns: integer width
tds_visual_width() {
    local text="$1"
    local stripped=$(tds_strip_ansi "$text")
    echo "${#stripped}"
}

# Calculate padding needed to center text in given width
# Args: text, total_width
# Returns: "left_pad right_pad"
tds_center_padding() {
    local text="$1"
    local total_width="$2"
    local visual_width=$(tds_visual_width "$text")

    local pad_total=$((total_width - visual_width))
    [[ $pad_total -lt 0 ]] && pad_total=0

    local pad_left=$((pad_total / 2))
    local pad_right=$((pad_total - pad_left))

    echo "$pad_left $pad_right"
}

# Pad text to exact visual width (ANSI-aware)
# Args: text, width, align (left|center|right), pad_char
tds_pad() {
    local text="$1"
    local width="$2"
    local align="${3:-left}"
    local pad_char="${4:- }"

    local visual_width=$(tds_visual_width "$text")
    local pad_needed=$((width - visual_width))

    [[ $pad_needed -le 0 ]] && { echo "$text"; return; }

    case "$align" in
        left)
            printf "%s%*s" "$text" "$pad_needed" "" | tr ' ' "$pad_char"
            ;;
        right)
            printf "%*s%s" "$pad_needed" "" "$text" | tr ' ' "$pad_char"
            ;;
        center)
            local pad_left=$((pad_needed / 2))
            local pad_right=$((pad_needed - pad_left))
            printf "%*s%s%*s" "$pad_left" "" "$text" "$pad_right" "" | tr ' ' "$pad_char"
            ;;
    esac
}

# Truncate text to visual width (preserves ANSI codes at start)
# Args: text, max_width, ellipsis
tds_truncate() {
    local text="$1"
    local max_width="$2"
    local ellipsis="${3:-...}"

    local visual_width=$(tds_visual_width "$text")

    if [[ $visual_width -le $max_width ]]; then
        echo "$text"
        return
    fi

    # Extract leading ANSI codes
    local ansi_prefix=""
    if [[ "$text" =~ ^($'\033'\[[0-9\;]*m)+ ]]; then
        ansi_prefix="${BASH_REMATCH[0]}"
    fi

    local stripped=$(tds_strip_ansi "$text")
    local truncated="${stripped:0:$((max_width - ${#ellipsis}))}"

    echo "${ansi_prefix}${truncated}${ellipsis}"
}

# Repeat a character/string N times
# Args: char, count
tds_repeat() {
    local char="$1"
    local count="$2"
    printf "%*s" "$count" "" | tr ' ' "$char"
}

# Export functions
export -f tds_strip_ansi tds_visual_width tds_center_padding tds_pad tds_truncate tds_repeat
