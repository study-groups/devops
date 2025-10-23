#!/usr/bin/env bash

# TDS Border and Panel Utilities
# Box-drawing characters and panel builders with ANSI-aware alignment

# Source dependencies
TDS_CORE="${TDS_SRC:-$(dirname "$(dirname "${BASH_SOURCE[0]}")")}/core"
source "$TDS_CORE/ansi.sh"

# Box drawing characters
declare -g TDS_BOX_TL="╔"  # Top-left
declare -g TDS_BOX_TR="╗"  # Top-right
declare -g TDS_BOX_BL="╚"  # Bottom-left
declare -g TDS_BOX_BR="╝"  # Bottom-right
declare -g TDS_BOX_H="═"   # Horizontal
declare -g TDS_BOX_V="║"   # Vertical

# Simple box variants
declare -g TDS_BOX_SIMPLE_TL="┌"
declare -g TDS_BOX_SIMPLE_TR="┐"
declare -g TDS_BOX_SIMPLE_BL="└"
declare -g TDS_BOX_SIMPLE_BR="┘"
declare -g TDS_BOX_SIMPLE_H="─"
declare -g TDS_BOX_SIMPLE_V="│"

# Render top border
# Args: width, [style=double]
tds_border_top() {
    local width="$1"
    local style="${2:-double}"

    if [[ "$style" == "double" ]]; then
        printf "%s%s%s\n" "$TDS_BOX_TL" "$(tds_repeat "$TDS_BOX_H" $((width - 2)))" "$TDS_BOX_TR"
    else
        printf "%s%s%s\n" "$TDS_BOX_SIMPLE_TL" "$(tds_repeat "$TDS_BOX_SIMPLE_H" $((width - 2)))" "$TDS_BOX_SIMPLE_TR"
    fi
}

# Render bottom border
# Args: width, [style=double]
tds_border_bottom() {
    local width="$1"
    local style="${2:-double}"

    if [[ "$style" == "double" ]]; then
        printf "%s%s%s\n" "$TDS_BOX_BL" "$(tds_repeat "$TDS_BOX_H" $((width - 2)))" "$TDS_BOX_BR"
    else
        printf "%s%s%s\n" "$TDS_BOX_SIMPLE_BL" "$(tds_repeat "$TDS_BOX_SIMPLE_H" $((width - 2)))" "$TDS_BOX_SIMPLE_BR"
    fi
}

# Render bordered line with ANSI-aware centering
# Args: content, width, [align=center], [style=double]
tds_border_line() {
    local content="$1"
    local width="$2"
    local align="${3:-center}"
    local style="${4:-double}"

    local v_char="$TDS_BOX_V"
    [[ "$style" == "simple" ]] && v_char="$TDS_BOX_SIMPLE_V"

    local inner_width=$((width - 2))
    local padded=$(tds_pad "$content" "$inner_width" "$align")

    printf "%s%s%s\n" "$v_char" "$padded" "$v_char"
}

# Render complete panel with title
# Args: title, [width=40], [style=double]
tds_panel_header() {
    local title="$1"
    local width="${2:-40}"
    local style="${3:-double}"

    tds_border_top "$width" "$style"
    tds_border_line "$title" "$width" "center" "$style"
    tds_border_bottom "$width" "$style"
}

# Render panel with title and content lines
# Args: title, width, style, content_lines...
tds_panel() {
    local title="$1"
    local width="${2:-40}"
    local style="${3:-double}"
    shift 3
    local content_lines=("$@")

    # Top border and title
    tds_border_top "$width" "$style"
    tds_border_line "$title" "$width" "center" "$style"

    # Empty line separator
    tds_border_line "" "$width" "center" "$style"

    # Content lines
    for line in "${content_lines[@]}"; do
        tds_border_line "$line" "$width" "left" "$style"
    done

    # Bottom border
    tds_border_bottom "$width" "$style"
}

# Simple horizontal rule
# Args: [width=80], [char=-]
tds_hr() {
    local width="${1:-${COLUMNS:-80}}"
    local char="${2:--}"
    tds_repeat "$char" "$width"
    echo
}

# Export functions
export -f tds_border_top tds_border_bottom tds_border_line tds_panel_header tds_panel tds_hr
