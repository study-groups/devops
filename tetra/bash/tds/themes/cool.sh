#!/usr/bin/env bash
# TDS Theme: Cool (Blue/Cyan Temperature)
# Used by: logs module
#
# PALETTE STRUCTURE (TDS 8x4):
#   ENV   - ALTERNATE: cyan ↔ blue (theme-specific)
#   MODE  - SEMANTIC: bad/warning/good/info + dims (cool-tinted)
#   VERBS - RAINBOW: universal 8-color cycle for collections
#   NOUNS - GRADIENT: slate dark→bright (theme-specific)

# Source guard
[[ "${__TDS_THEME_COOL_LOADED:-}" == "true" ]] && return 0
__TDS_THEME_COOL_LOADED=true

tds_theme_cool() {
    # Theme metadata
    THEME_NAME="cool"
    THEME_DESCRIPTION="Cool blue/cyan temperature for logs module"
    THEME_TEMPERATURE="cool"

    # ========================================================================
    # BASE PALETTE
    # ========================================================================

    # Cyan family (ENV hue A)
    local cyan_900="#164e63"
    local cyan_700="#0e7490"
    local cyan_500="#06b6d4"
    local cyan_300="#67e8f9"

    # Blue family (ENV hue B)
    local blue_900="#1e3a8a"
    local blue_700="#1d4ed8"
    local blue_500="#3b82f6"
    local blue_300="#93c5fd"

    # Slate family (NOUNS gradient)
    local slate_900="#0f172a"
    local slate_700="#334155"
    local slate_600="#475569"
    local slate_500="#64748b"
    local slate_400="#94a3b8"
    local slate_300="#cbd5e1"
    local slate_200="#e2e8f0"
    local slate_50="#f8fafc"

    # ========================================================================
    # ENV_PRIMARY - ALTERNATE: Cyan ↔ Blue
    # ========================================================================
    ENV_PRIMARY=(
        "$cyan_500"    # 0: A primary
        "$blue_500"    # 1: B primary
        "$cyan_300"    # 2: A light
        "$blue_300"    # 3: B light
        "$cyan_700"    # 4: A muted
        "$blue_700"    # 5: B muted
        "$cyan_900"    # 6: A dim
        "$blue_900"    # 7: B dim
    )

    # ========================================================================
    # MODE_PRIMARY - SEMANTIC: cool-tinted states
    # [0]=bad [1]=warning [2]=good [3]=info [4-7]=dim via desaturate_hex
    # ========================================================================
    local mode_bad="1d4ed8"       # blue (cool "bad")
    local mode_warning="6366f1"   # indigo
    local mode_good="06b6d4"      # cyan (cool "good")
    local mode_info="0ea5e9"      # sky

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
    # ========================================================================
    tds_apply_verbs_rainbow

    # ========================================================================
    # NOUNS_PRIMARY - GRADIENT: slate dark→bright
    # ========================================================================
    NOUNS_PRIMARY=(
        "$slate_900"   # 0: darkest
        "$slate_700"   # 1: dark
        "$slate_600"   # 2: dim
        "$slate_500"   # 3: muted
        "$slate_400"   # 4: subtle
        "$slate_300"   # 5: light
        "$slate_200"   # 6: pale
        "$slate_50"    # 7: brightest
    )

    tds_apply_semantic_colors
}

# Register theme
tds_register_theme "cool" "tds_theme_cool" "Cool blue temperature for logs"

# Export
export -f tds_theme_cool
