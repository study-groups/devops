#!/usr/bin/env bash
# TDS Theme: Cool (Blue/Cyan)
# Used by: logs module
#
# NEW PALETTE STRUCTURE:
#   BACKGROUND   - Anchor color (slate dark)
#   TINT         - Surface saturation %
#   PRIMARY[0-7] - Universal rainbow
#   SECONDARY[0-7] - Theme accent (cyan ↔ blue)
#   SEMANTIC[0-7] - Derived: error/warning/success/info
#   SURFACE[0-7]  - Derived: tinted bg→fg gradient

# Source guard
[[ "${__TDS_THEME_COOL_LOADED:-}" == "true" ]] && return 0
__TDS_THEME_COOL_LOADED=true

tds_theme_cool() {
    # Theme metadata
    THEME_NAME="cool"
    THEME_DESCRIPTION="Cool blue/cyan temperature for logs module"
    THEME_TEMPERATURE="cool"

    # ========================================================================
    # THEME INPUTS
    # ========================================================================

    # Background anchor - slate dark (cool gray)
    BACKGROUND="0F172A"

    # Surface tint - cool undertone
    TINT=10

    # ========================================================================
    # PRIMARY - Universal rainbow (same for all themes)
    # ========================================================================
    PRIMARY=(
        "E53935"  # 0: red (0°)
        "FB8C00"  # 1: orange (30°)
        "FDD835"  # 2: yellow (60°)
        "43A047"  # 3: green (120°)
        "00ACC1"  # 4: cyan (180°)
        "1E88E5"  # 5: blue (210°)
        "8E24AA"  # 6: purple (270°)
        "EC407A"  # 7: pink (330°)
    )

    # ========================================================================
    # SECONDARY - Theme accent: cyan ↔ blue alternating
    # ========================================================================
    SECONDARY=(
        "06B6D4"  # 0: cyan 500
        "3B82F6"  # 1: blue 500
        "67E8F9"  # 2: cyan 300
        "93C5FD"  # 3: blue 300
        "0E7490"  # 4: cyan 700
        "1D4ED8"  # 5: blue 700
        "164E63"  # 6: cyan 900
        "1E3A8A"  # 7: blue 900
    )

    # ========================================================================
    # DERIVED PALETTES
    # ========================================================================
    # SEMANTIC and SURFACE computed from PRIMARY + BACKGROUND
    tds_derive

    # Legacy compatibility
    _tds_legacy_compat 2>/dev/null || true
}

# Register theme
tds_register_theme "cool" "tds_theme_cool" "Cool blue temperature for logs"

# Export
export -f tds_theme_cool
