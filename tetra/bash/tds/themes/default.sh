#!/usr/bin/env bash

# TDS Default Theme
# Uses existing Tetra color palettes from bash/color/

tds_load_theme_default() {
    # Source existing color palettes
    local color_src="${COLOR_SRC:-$(dirname "$TDS_SRC")/color}"

    if [[ -f "$color_src/color_palettes.sh" ]]; then
        source "$color_src/color_palettes.sh"
    else
        echo "Error: color_palettes.sh not found at $color_src" >&2
        return 1
    fi

    # Palettes are already defined by color_palettes.sh:
    # - ENV_PRIMARY (8 colors)
    # - MODE_PRIMARY (8 colors)
    # - VERBS_PRIMARY (8 colors)
    # - NOUNS_PRIMARY (8 colors)
    # - Complement arrays

    # Apply semantic color mappings from palettes
    if declare -f tds_apply_semantic_colors >/dev/null 2>&1; then
        tds_apply_semantic_colors
    fi

    # Theme metadata
    TDS_THEME_NAME="Default"
    TDS_THEME_AUTHOR="Tetra"
    TDS_THEME_DESCRIPTION="Default Tetra color scheme"

    return 0
}

# Export function
export -f tds_load_theme_default
