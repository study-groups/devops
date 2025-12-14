#!/usr/bin/env bash
# TDS Theme: Electric (Violet/Fuchsia Temperature)
# Used by: deploy module
#
# PALETTE STRUCTURE (TDS 8x4):
#   ENV   - ALTERNATE: violet ↔ fuchsia (theme-specific)
#   MODE  - SEMANTIC: bad/warning/good/info + dims (electric-tinted)
#   VERBS - RAINBOW: universal 8-color cycle for collections
#   NOUNS - GRADIENT: zinc dark→bright (theme-specific)

tds_theme_electric() {
    # Theme metadata
    THEME_NAME="electric"
    THEME_DESCRIPTION="Electric violet/fuchsia temperature for deploy module"
    THEME_TEMPERATURE="electric"

    # ========================================================================
    # BASE PALETTE
    # ========================================================================

    # Violet family (ENV hue A)
    local violet_900="#4c1d95"
    local violet_700="#6d28d9"
    local violet_500="#8b5cf6"
    local violet_300="#c4b5fd"

    # Fuchsia family (ENV hue B)
    local fuchsia_900="#701a75"
    local fuchsia_700="#a21caf"
    local fuchsia_500="#d946ef"
    local fuchsia_300="#f0abfc"

    # Zinc family (NOUNS gradient)
    local zinc_900="#18181b"
    local zinc_700="#3f3f46"
    local zinc_600="#52525b"
    local zinc_500="#71717a"
    local zinc_400="#a1a1aa"
    local zinc_300="#d4d4d8"
    local zinc_200="#e4e4e7"
    local zinc_50="#fafafa"

    # ========================================================================
    # ENV_PRIMARY - ALTERNATE: Violet ↔ Fuchsia
    # ========================================================================
    ENV_PRIMARY=(
        "$violet_500"  # 0: A primary
        "$fuchsia_500" # 1: B primary
        "$violet_300"  # 2: A light
        "$fuchsia_300" # 3: B light
        "$violet_700"  # 4: A muted
        "$fuchsia_700" # 5: B muted
        "$violet_900"  # 6: A dim
        "$fuchsia_900" # 7: B dim
    )

    # ========================================================================
    # MODE_PRIMARY - SEMANTIC: electric-tinted states
    # [0]=bad [1]=warning [2]=good [3]=info [4-7]=dim via desaturate_hex
    # ========================================================================
    local mode_bad="6d28d9"       # deep violet (electric "bad")
    local mode_warning="a21caf"   # fuchsia muted
    local mode_good="d946ef"      # bright fuchsia (electric "good")
    local mode_info="a855f7"      # purple

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
    # NOUNS_PRIMARY - GRADIENT: zinc dark→bright
    # ========================================================================
    NOUNS_PRIMARY=(
        "$zinc_900"    # 0: darkest
        "$zinc_700"    # 1: dark
        "$zinc_600"    # 2: dim
        "$zinc_500"    # 3: muted
        "$zinc_400"    # 4: subtle
        "$zinc_300"    # 5: light
        "$zinc_200"    # 6: pale
        "$zinc_50"     # 7: brightest
    )

    # Apply semantic colors using palette arrays
    tds_apply_semantic_colors
}

# Register theme
tds_register_theme "electric" "tds_theme_electric" "Electric purple temperature for deploy"

# Export
export -f tds_theme_electric
