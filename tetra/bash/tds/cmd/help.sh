#!/usr/bin/env bash
# TDS Help Commands

_tds_cmd_help() {
    echo
    echo "TDS - Tetra Design System"
    echo
    echo "RESOURCES"
    echo "  theme     list get set create delete copy edit path save validate"
    echo "  palette   list get set"
    echo "  token     list get set validate"
    echo "  modules   list show edit init reload"
    echo "  hex       <#RRGGBB>"
    echo
    echo "TOOLS"
    echo "  doctor    Health check and diagnostics"
    echo "  repl      Interactive color explorer"
    echo "  guide     Color design guide"
    echo
    echo "EXAMPLES"
    echo "  tds theme list"
    echo "  tds theme set warm"
    echo "  tds token get status.error"
    echo "  tds modules edit tsm"
    echo "  tds hex #3b82f6"
    echo
}

# Hex color utility
_tds_hex() {
    local hex="${1:-}"

    if [[ -z "$hex" ]]; then
        echo "Usage: tds hex <#RRGGBB>"
        echo "Show color swatch and RGB values"
        return 1
    fi

    hex="${hex#\#}"
    if ! [[ "$hex" =~ ^[0-9a-fA-F]{6}$ ]]; then
        echo "Invalid hex color: #$hex"
        echo "Format: #RRGGBB (e.g., #3b82f6)"
        return 1
    fi

    echo
    if declare -f text_color >/dev/null 2>&1; then
        text_color "#$hex"
        bg_only "#$hex"
        printf "                    \n"
        printf "   #%-14s \n" "$hex"
        printf "                    \n"
        reset_color
    else
        echo "  #$hex"
    fi

    local r=$((16#${hex:0:2}))
    local g=$((16#${hex:2:2}))
    local b=$((16#${hex:4:2}))
    echo
    echo "RGB: ($r, $g, $b)"
}

export -f _tds_cmd_help _tds_hex
