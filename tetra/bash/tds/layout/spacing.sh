#!/usr/bin/env bash

# TDS Spacing and Layout Utilities
# Consistent spacing, margins, padding

# Source dependencies
TDS_CORE="${TDS_SRC:-$(dirname "$(dirname "${BASH_SOURCE[0]}")")}/core"
source "$TDS_CORE/ansi.sh"

# Spacing scale (in spaces)
declare -g TDS_SPACE_NONE=0
declare -g TDS_SPACE_XS=1
declare -g TDS_SPACE_SM=2
declare -g TDS_SPACE_MD=4
declare -g TDS_SPACE_LG=8
declare -g TDS_SPACE_XL=12

# Vertical spacing (blank lines)
# Args: [scale=md]
tds_vspace() {
    local scale="${1:-md}"
    local lines=1

    case "$scale" in
        none|0) return ;;
        xs|1)   lines=1 ;;
        sm|2)   lines=1 ;;
        md|4)   lines=2 ;;
        lg|8)   lines=3 ;;
        xl|12)  lines=4 ;;
        *)      lines="$scale" ;;
    esac

    for ((i=0; i<lines; i++)); do
        echo
    done
}

# Horizontal spacing (inline spaces)
# Args: [scale=md]
tds_hspace() {
    local scale="${1:-md}"
    local spaces=4

    case "$scale" in
        none|0) return ;;
        xs|1)   spaces=1 ;;
        sm|2)   spaces=2 ;;
        md|4)   spaces=4 ;;
        lg|8)   spaces=8 ;;
        xl|12)  spaces=12 ;;
        *)      spaces="$scale" ;;
    esac

    printf "%*s" "$spaces" ""
}

# Indent text block
# Args: text, [indent_level=1]
tds_indent() {
    local text="$1"
    local indent_level="${2:-1}"
    local spaces=$((indent_level * TDS_SPACE_MD))

    while IFS= read -r line; do
        printf "%*s%s\n" "$spaces" "" "$line"
    done <<< "$text"
}

# Create a spacer line (for visual separation)
# Args: [width=80], [char= ]
tds_spacer() {
    local width="${1:-${COLUMNS:-80}}"
    local char="${2:- }"

    printf "%*s\n" "$width" "" | tr ' ' "$char"
}

# Export functions
export -f tds_vspace tds_hspace tds_indent tds_spacer
