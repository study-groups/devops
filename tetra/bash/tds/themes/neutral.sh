#!/usr/bin/env bash
# TDS Theme: Neutral (Green/Gray)
# Used by: tsm module
#
# NEW PALETTE STRUCTURE:
#   BACKGROUND   - Anchor color (gray dark)
#   TINT         - Surface saturation %
#   PRIMARY[0-7] - Universal rainbow
#   SECONDARY[0-7] - Theme accent (green ↔ emerald)
#   SEMANTIC[0-7] - Derived: error/warning/success/info
#   SURFACE[0-7]  - Derived: tinted bg→fg gradient

# Source guard
[[ "${__TDS_THEME_NEUTRAL_LOADED:-}" == "true" ]] && return 0
__TDS_THEME_NEUTRAL_LOADED=true

tds_theme_neutral() {
    # Theme metadata
    THEME_NAME="neutral"
    THEME_DESCRIPTION="Neutral green/gray temperature for tsm module"
    THEME_TEMPERATURE="neutral"

    # ========================================================================
    # THEME INPUTS
    # ========================================================================

    # Background anchor - true gray dark
    BACKGROUND="111827"

    # Surface tint - minimal (nearly pure gray)
    TINT=5

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
    # SECONDARY - Theme accent: green ↔ emerald alternating
    # ========================================================================
    SECONDARY=(
        "22C55E"  # 0: green 500
        "10B981"  # 1: emerald 500
        "86EFAC"  # 2: green 300
        "6EE7B7"  # 3: emerald 300
        "15803D"  # 4: green 700
        "047857"  # 5: emerald 700
        "14532D"  # 6: green 900
        "064E3B"  # 7: emerald 900
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
tds_register_theme "neutral" "tds_theme_neutral" "Neutral green temperature for tsm"

# Export
export -f tds_theme_neutral
