#!/usr/bin/env bash
# TDS Theme: Electric (Violet/Fuchsia)
# Used by: deploy module
#
# NEW PALETTE STRUCTURE:
#   BACKGROUND   - Anchor color (zinc dark)
#   TINT         - Surface saturation %
#   PRIMARY[0-7] - Universal rainbow
#   SECONDARY[0-7] - Theme accent (violet ↔ fuchsia)
#   SEMANTIC[0-7] - Derived: error/warning/success/info
#   SURFACE[0-7]  - Derived: tinted bg→fg gradient

# Source guard
[[ "${__TDS_THEME_ELECTRIC_LOADED:-}" == "true" ]] && return 0
__TDS_THEME_ELECTRIC_LOADED=true

tds_theme_electric() {
    # Theme metadata
    THEME_NAME="electric"
    THEME_DESCRIPTION="Electric violet/fuchsia temperature for deploy module"
    THEME_TEMPERATURE="electric"

    # ========================================================================
    # THEME INPUTS
    # ========================================================================

    # Background anchor - zinc dark with electric undertone
    BACKGROUND="1A1A2E"

    # Surface tint - noticeable purple undertone
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
    # SECONDARY - Theme accent: violet ↔ fuchsia alternating
    # ========================================================================
    SECONDARY=(
        "8B5CF6"  # 0: violet 500
        "D946EF"  # 1: fuchsia 500
        "C4B5FD"  # 2: violet 300
        "F0ABFC"  # 3: fuchsia 300
        "6D28D9"  # 4: violet 700
        "A21CAF"  # 5: fuchsia 700
        "4C1D95"  # 6: violet 900
        "701A75"  # 7: fuchsia 900
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
tds_register_theme "electric" "tds_theme_electric" "Electric purple temperature for deploy"

# Export
export -f tds_theme_electric
