#!/usr/bin/env bash
# TDS Theme: Warm (Amber/Orange)
# Used by: org module
#
# NEW PALETTE STRUCTURE:
#   BACKGROUND   - Anchor color (stone dark)
#   TINT         - Surface saturation %
#   PRIMARY[0-7] - Universal rainbow
#   SECONDARY[0-7] - Theme accent (amber ↔ orange)
#   SEMANTIC[0-7] - Derived: error/warning/success/info
#   SURFACE[0-7]  - Derived: tinted bg→fg gradient

# Source guard
[[ "${__TDS_THEME_WARM_LOADED:-}" == "true" ]] && return 0
__TDS_THEME_WARM_LOADED=true

tds_theme_warm() {
    # Theme metadata
    THEME_NAME="warm"
    THEME_DESCRIPTION="Warm amber/orange temperature for org module"
    THEME_TEMPERATURE="warm"

    # ========================================================================
    # THEME INPUTS
    # ========================================================================

    # Background anchor - stone dark (warm gray)
    BACKGROUND="1C1917"

    # Surface tint - warm undertone
    TINT=12

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
    # SECONDARY - Theme accent: amber ↔ orange alternating
    # ========================================================================
    SECONDARY=(
        "F59E0B"  # 0: amber 500
        "F97316"  # 1: orange 500
        "FCD34D"  # 2: amber 300
        "FDBA74"  # 3: orange 300
        "B45309"  # 4: amber 700
        "C2410C"  # 5: orange 700
        "78350F"  # 6: amber 900
        "7C2D12"  # 7: orange 900
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
tds_register_theme "warm" "tds_theme_warm" "Warm amber temperature for org"

# Export
export -f tds_theme_warm
