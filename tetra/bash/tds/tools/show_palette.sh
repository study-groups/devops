#!/usr/bin/env bash
# TDS Palette Visualization Tool
# Shows exactly what colors are active in each theme

# Source TDS
TDS_SRC="${TDS_SRC:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
source "$TDS_SRC/tds.sh"

show_hex_color() {
    local hex="$1"
    local label="$2"

    # Use TDS color functions (256-color mode for compatibility)
    bg_only "$hex"
    printf "   "
    reset_color
    printf " #%s  %s\n" "${hex#\#}" "$label"
}

show_palette_array() {
    local name="$1"
    local -n arr="$1"

    echo
    echo "=== $name ==="
    for i in "${!arr[@]}"; do
        printf "[%d] " "$i"
        show_hex_color "${arr[$i]}" ""
    done
}

show_theme_palette() {
    local theme="$1"

    echo
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "THEME: $theme"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    # Switch to theme
    TDS_QUIET_LOAD=1 tds_switch_theme "$theme" 2>/dev/null || {
        echo "ERROR: Failed to load theme: $theme"
        return 1
    }

    # Show all 4 palette arrays
    show_palette_array "PRIMARY"
    show_palette_array "SECONDARY"
    show_palette_array "SEMANTIC"
    show_palette_array "SURFACE"

    # Show key tokens
    echo
    echo "=== KEY TOKENS ==="
    for token in "repl.prompt" "content.dim" "marker.primary"; do
        local hex=$(tds_resolve_color "$token")
        printf "%-20s " "$token"
        show_hex_color "$hex" ""
    done
}

# Main
if [[ $# -eq 0 ]]; then
    echo "Usage: $0 <theme1> [theme2] ..."
    echo "Example: $0 warm cool neutral electric"
    exit 1
fi

for theme in "$@"; do
    show_theme_palette "$theme"
done

echo
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
