#!/usr/bin/env bash
# Chroma - Color output utilities
# Part of the chroma modular markdown renderer

# Color codes (uses TDS or built-in palette)
_chroma_color() {
    local token="$1"
    (( CHROMA_NO_COLOR )) && return

    # Emphasis tokens need ANSI attributes, not colors
    # Handle these specially regardless of TDS
    case "$token" in
        content.emphasis.strong|bold)
            printf '\033[1m'  # Bold attribute
            return
            ;;
        content.emphasis.em|italic)
            printf '\033[3m'  # Italic attribute
            return
            ;;
    esac

    # Try TDS first for color tokens
    if declare -F tds_text_color &>/dev/null; then
        tds_text_color "$token"
        return
    fi

    # Use built-in palette
    local code="${_CHROMA_PALETTES[$token]}"
    if [[ -n "$code" ]]; then
        printf '%b' "$code"
        return
    fi

    # Fallback for heading levels not in palette
    case "$token" in
        content.heading.*)
            # Use h4 as fallback for h5/h6
            code="${_CHROMA_PALETTES[content.heading.h4]}"
            [[ -n "$code" ]] && printf '%b' "$code"
            ;;
        *)
            # Default to text.primary
            code="${_CHROMA_PALETTES[text.primary]}"
            [[ -n "$code" ]] && printf '%b' "$code" || printf '\033[38;5;252m'
            ;;
    esac
}

_chroma_reset() {
    (( CHROMA_NO_COLOR )) && return

    if declare -F reset_color &>/dev/null; then
        reset_color
    else
        printf '\033[0m'
    fi
}

# Get TDS token for element type
_chroma_token() {
    local elem="$1"
    echo "${CHROMA_TOKENS[$elem]:-text.primary}"
}
