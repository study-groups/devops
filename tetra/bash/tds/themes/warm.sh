#!/usr/bin/env bash
# TDS Theme: Warm (Amber/Orange Temperature)
# Used by: org module
#
# PALETTE STRUCTURE (TDS 8x4):
#   ENV   - ALTERNATE: amber ↔ orange (theme-specific)
#   MODE  - SEMANTIC: bad/warning/good/info + dims (warm-tinted)
#   VERBS - RAINBOW: universal 8-color cycle for collections
#   NOUNS - GRADIENT: stone dark→bright (theme-specific)

# Source guard
[[ "${__TDS_THEME_WARM_LOADED:-}" == "true" ]] && return 0
__TDS_THEME_WARM_LOADED=true

tds_theme_warm() {
    # Theme metadata
    THEME_NAME="warm"
    THEME_DESCRIPTION="Warm amber/orange temperature for org module"
    THEME_TEMPERATURE="warm"

    # ========================================================================
    # BASE PALETTE
    # ========================================================================

    # Amber family (ENV hue A)
    local amber_900="#78350f"
    local amber_700="#b45309"
    local amber_500="#f59e0b"
    local amber_300="#fcd34d"

    # Orange family (ENV hue B)
    local orange_900="#7c2d12"
    local orange_700="#c2410c"
    local orange_500="#f97316"
    local orange_300="#fdba74"

    # Stone family (NOUNS gradient)
    local stone_900="#1c1917"
    local stone_700="#44403c"
    local stone_600="#57534e"
    local stone_500="#78716c"
    local stone_400="#a8a29e"
    local stone_300="#d6d3d1"
    local stone_200="#e7e5e4"
    local stone_50="#fafaf9"

    # ========================================================================
    # ENV_PRIMARY - ALTERNATE: Amber ↔ Orange
    # ========================================================================
    ENV_PRIMARY=(
        "$amber_500"   # 0: A primary
        "$orange_500"  # 1: B primary
        "$amber_300"   # 2: A light
        "$orange_300"  # 3: B light
        "$amber_700"   # 4: A muted
        "$orange_700"  # 5: B muted
        "$amber_900"   # 6: A dim
        "$orange_900"  # 7: B dim
    )

    # ========================================================================
    # MODE_PRIMARY - SEMANTIC: warm-tinted states
    # [0]=bad [1]=warning [2]=good [3]=info [4-7]=dim versions
    # Dim versions computed via desaturate_hex (level 3)
    # ========================================================================
    local mode_bad="c2410c"       # burnt orange
    local mode_warning="d97706"   # amber
    local mode_good="65a30d"      # warm green/lime
    local mode_info="0891b2"      # warm cyan

    MODE_PRIMARY=(
        "$mode_bad"                           # 0: bad
        "$mode_warning"                       # 1: warning
        "$mode_good"                          # 2: good
        "$mode_info"                          # 3: info
        "$(desaturate_hex "$mode_bad" 3)"     # 4: bad dim
        "$(desaturate_hex "$mode_warning" 3)" # 5: warning dim
        "$(desaturate_hex "$mode_good" 3)"    # 6: good dim
        "$(desaturate_hex "$mode_info" 3)"    # 7: info dim
    )

    # ========================================================================
    # VERBS_PRIMARY - RAINBOW: universal 8-color cycle
    # Same for all themes - maximally distinct for collections
    # ========================================================================
    tds_apply_verbs_rainbow

    # ========================================================================
    # NOUNS_PRIMARY - GRADIENT: stone dark→bright
    # ========================================================================
    NOUNS_PRIMARY=(
        "$stone_900"   # 0: darkest
        "$stone_700"   # 1: dark
        "$stone_600"   # 2: dim
        "$stone_500"   # 3: muted
        "$stone_400"   # 4: subtle
        "$stone_300"   # 5: light
        "$stone_200"   # 6: pale
        "$stone_50"    # 7: brightest
    )

    tds_apply_semantic_colors
}

# Register theme
tds_register_theme "warm" "tds_theme_warm" "Warm amber temperature for org"

# Export
export -f tds_theme_warm
