#!/usr/bin/env bash
# TDS Theme: Neutral (Green/Gray Temperature)
# Used by: tsm module
#
# PALETTE STRUCTURE (TDS 8x4):
#   ENV   - ALTERNATE: green ↔ emerald (theme-specific)
#   MODE  - SEMANTIC: bad/warning/good/info + dims (neutral-tinted)
#   VERBS - RAINBOW: universal 8-color cycle for collections
#   NOUNS - GRADIENT: gray dark→bright (theme-specific)

tds_theme_neutral() {
    # Theme metadata
    THEME_NAME="neutral"
    THEME_DESCRIPTION="Neutral green/gray temperature for tsm module"
    THEME_TEMPERATURE="neutral"

    # ========================================================================
    # BASE PALETTE
    # ========================================================================

    # Green family (ENV hue A)
    local green_900="#14532d"
    local green_700="#15803d"
    local green_500="#22c55e"
    local green_300="#86efac"

    # Emerald family (ENV hue B)
    local emerald_900="#064e3b"
    local emerald_700="#047857"
    local emerald_500="#10b981"
    local emerald_300="#6ee7b7"

    # Gray family (NOUNS gradient - true neutrals)
    local gray_900="#111827"
    local gray_700="#374151"
    local gray_600="#4b5563"
    local gray_500="#6b7280"
    local gray_400="#9ca3af"
    local gray_300="#d1d5db"
    local gray_200="#e5e7eb"
    local gray_50="#f9fafb"

    # ========================================================================
    # ENV_PRIMARY - ALTERNATE: Green ↔ Emerald
    # ========================================================================
    ENV_PRIMARY=(
        "$green_500"   # 0: A primary
        "$emerald_500" # 1: B primary
        "$green_300"   # 2: A light
        "$emerald_300" # 3: B light
        "$green_700"   # 4: A muted
        "$emerald_700" # 5: B muted
        "$green_900"   # 6: A dim
        "$emerald_900" # 7: B dim
    )

    # ========================================================================
    # MODE_PRIMARY - SEMANTIC: neutral-tinted states
    # [0]=bad [1]=warning [2]=good [3]=info [4-7]=dim via desaturate_hex
    # ========================================================================
    local mode_bad="15803d"       # dark green (neutral "bad")
    local mode_warning="047857"   # emerald muted
    local mode_good="22c55e"      # bright green (neutral "good")
    local mode_info="10b981"      # emerald

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
    VERBS_PRIMARY=(
        "#E53935"  # 0: red (0°)
        "#FB8C00"  # 1: orange (30°)
        "#FDD835"  # 2: yellow (60°)
        "#43A047"  # 3: green (120°)
        "#00ACC1"  # 4: cyan (180°)
        "#1E88E5"  # 5: blue (210°)
        "#8E24AA"  # 6: purple (270°)
        "#EC407A"  # 7: pink (330°)
    )

    # ========================================================================
    # NOUNS_PRIMARY - GRADIENT: gray dark→bright
    # ========================================================================
    NOUNS_PRIMARY=(
        "$gray_900"    # 0: darkest
        "$gray_700"    # 1: dark
        "$gray_600"    # 2: dim
        "$gray_500"    # 3: muted
        "$gray_400"    # 4: subtle
        "$gray_300"    # 5: light
        "$gray_200"    # 6: pale
        "$gray_50"     # 7: brightest
    )

    tds_apply_semantic_colors
}

# Register theme
tds_register_theme "neutral" "tds_theme_neutral" "Neutral green temperature for tsm"

# Export
export -f tds_theme_neutral
