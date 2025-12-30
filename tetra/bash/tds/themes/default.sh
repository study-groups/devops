#!/usr/bin/env bash
# TDS Default Theme
# Uses color_palettes.sh defaults - neutral dark with full rainbow

tds_load_theme_default() {
    # Theme metadata
    THEME_NAME="default"
    THEME_DESCRIPTION="Default Tetra color scheme"

    # Source existing color palettes (defines defaults)
    local color_src="${COLOR_SRC:-$(dirname "$TDS_SRC")/color}"

    if [[ -f "$color_src/color_palettes.sh" ]]; then
        source "$color_src/color_palettes.sh"
    else
        # Fallback: define defaults inline
        BACKGROUND="1A1A2E"
        TINT=10

        PRIMARY=(
            "E53935" "FB8C00" "FDD835" "43A047"
            "00ACC1" "1E88E5" "8E24AA" "EC407A"
        )

        SECONDARY=(
            "E56335" "C8A400" "7DBB00" "00A86B"
            "007BA7" "4169E1" "A347A3" "E5355E"
        )

        tds_derive
    fi

    # Legacy compatibility
    _tds_legacy_compat 2>/dev/null || true

    return 0
}

# Export function
export -f tds_load_theme_default
