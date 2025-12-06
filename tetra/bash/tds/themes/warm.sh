#!/usr/bin/env bash
# TDS Theme: Warm (Amber/Orange Temperature)
# Used by: org module
#
# PALETTE STRUCTURE:
#   ENV   - ALTERNATE: amber ↔ orange
#   MODE  - STATUS: error/warning/success/info + dims
#   VERBS - ACTIONS + ACCENT
#   NOUNS - GRADIENT: stone dark→light

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

    # Status colors (MODE)
    local red_500="#ef4444"
    local red_700="#b91c1c"
    local yellow_500="#eab308"
    local yellow_700="#a16207"
    local green_500="#22c55e"
    local green_700="#15803d"
    local amber_info="#f59e0b"
    local amber_info_dim="#b45309"

    # Action colors (VERBS) - warm tinted
    local action_primary="#f97316"      # orange
    local action_secondary="#f59e0b"    # amber
    local action_destructive="#ef4444"  # red
    local action_constructive="#22c55e" # green
    local action_accent="#f472b6"       # pink
    local action_highlight="#fb923c"    # orange light
    local action_focus="#fbbf24"        # amber light
    local action_muted="#78716c"        # stone

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
    # MODE_PRIMARY - STATUS + dims
    # ========================================================================
    MODE_PRIMARY=(
        "$red_500"         # 0: error
        "$yellow_500"      # 1: warning
        "$green_500"       # 2: success
        "$amber_info"      # 3: info (warm tint)
        "$red_700"         # 4: error-dim
        "$yellow_700"      # 5: warning-dim
        "$green_700"       # 6: success-dim
        "$amber_info_dim"  # 7: info-dim
    )

    # ========================================================================
    # VERBS_PRIMARY - ACTIONS + ACCENT
    # ========================================================================
    VERBS_PRIMARY=(
        "$action_primary"      # 0: primary
        "$action_secondary"    # 1: secondary
        "$action_destructive"  # 2: destructive
        "$action_constructive" # 3: constructive
        "$action_accent"       # 4: accent
        "$action_highlight"    # 5: highlight
        "$action_focus"        # 6: focus
        "$action_muted"        # 7: muted
    )

    # ========================================================================
    # NOUNS_PRIMARY - GRADIENT
    # ========================================================================
    NOUNS_PRIMARY=(
        "$stone_900"   # 0: darkest
        "$stone_700"   # 1: dark
        "$stone_600"   # 2: medium-dark
        "$stone_500"   # 3: medium
        "$stone_400"   # 4: medium-light
        "$stone_300"   # 5: light
        "$stone_200"   # 6: pale
        "$stone_50"    # 7: lightest
    )

    tds_apply_semantic_colors
}

# Register theme
tds_register_theme "warm" "tds_theme_warm" "Warm amber temperature for org"

# Export
export -f tds_theme_warm
