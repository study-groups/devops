#!/usr/bin/env bash
# TDS Theme: Electric (Violet/Fuchsia Temperature)
# Used by: deploy module
#
# PALETTE STRUCTURE:
#   ENV   - ALTERNATE: violet ↔ fuchsia
#   MODE  - STATUS: error/warning/success/info + dims
#   VERBS - ACTIONS + ACCENT
#   NOUNS - GRADIENT: zinc dark→light

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

    # Status colors (MODE)
    local red_500="#ef4444"
    local red_700="#b91c1c"
    local amber_500="#f59e0b"
    local amber_700="#b45309"
    local green_500="#22c55e"
    local green_700="#15803d"
    local purple_500="#a855f7"
    local purple_700="#7e22ce"

    # Action colors (VERBS) - electric tinted
    local action_primary="#d946ef"      # fuchsia
    local action_secondary="#a855f7"    # purple
    local action_destructive="#ef4444"  # red
    local action_constructive="#22c55e" # green
    local action_accent="#06b6d4"       # cyan (complementary)
    local action_highlight="#f0abfc"    # fuchsia light
    local action_focus="#c4b5fd"        # violet light
    local action_muted="#71717a"        # zinc

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
    # MODE_PRIMARY - STATUS + dims
    # ========================================================================
    MODE_PRIMARY=(
        "$red_500"     # 0: error
        "$amber_500"   # 1: warning
        "$green_500"   # 2: success
        "$purple_500"  # 3: info (electric tint)
        "$red_700"     # 4: error-dim
        "$amber_700"   # 5: warning-dim
        "$green_700"   # 6: success-dim
        "$purple_700"  # 7: info-dim
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
        "$zinc_900"    # 0: darkest
        "$zinc_700"    # 1: dark
        "$zinc_600"    # 2: medium-dark
        "$zinc_500"    # 3: medium
        "$zinc_400"    # 4: medium-light
        "$zinc_300"    # 5: light
        "$zinc_200"    # 6: pale
        "$zinc_50"     # 7: lightest
    )

    # Apply semantic colors using palette arrays
    tds_apply_semantic_colors
}

# Register theme
tds_register_theme "electric" "tds_theme_electric" "Electric purple temperature for deploy"

# Export
export -f tds_theme_electric
