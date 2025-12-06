#!/usr/bin/env bash
# TDS Theme: Neutral (Green/Gray Temperature)
# Used by: tsm module
#
# PALETTE STRUCTURE:
#   ENV   - ALTERNATE: green ↔ emerald
#   MODE  - STATUS: error/warning/success/info + dims
#   VERBS - ACTIONS + ACCENT
#   NOUNS - GRADIENT: gray dark→light

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

    # Status colors (MODE)
    local red_500="#ef4444"
    local red_700="#b91c1c"
    local amber_500="#f59e0b"
    local amber_700="#b45309"
    local green_status="#22c55e"
    local green_status_dim="#15803d"
    local teal_500="#14b8a6"
    local teal_700="#0f766e"

    # Action colors (VERBS) - neutral tinted
    local action_primary="#10b981"      # emerald
    local action_secondary="#14b8a6"    # teal
    local action_destructive="#ef4444"  # red
    local action_constructive="#22c55e" # green
    local action_accent="#8b5cf6"       # violet
    local action_highlight="#34d399"    # emerald light
    local action_focus="#2dd4bf"        # teal light
    local action_muted="#6b7280"        # gray

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
    # MODE_PRIMARY - STATUS + dims
    # ========================================================================
    MODE_PRIMARY=(
        "$red_500"           # 0: error
        "$amber_500"         # 1: warning
        "$green_status"      # 2: success
        "$teal_500"          # 3: info
        "$red_700"           # 4: error-dim
        "$amber_700"         # 5: warning-dim
        "$green_status_dim"  # 6: success-dim
        "$teal_700"          # 7: info-dim
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
        "$gray_900"    # 0: darkest
        "$gray_700"    # 1: dark
        "$gray_600"    # 2: medium-dark
        "$gray_500"    # 3: medium
        "$gray_400"    # 4: medium-light
        "$gray_300"    # 5: light
        "$gray_200"    # 6: pale
        "$gray_50"     # 7: lightest
    )

    tds_apply_semantic_colors
}

# Register theme
tds_register_theme "neutral" "tds_theme_neutral" "Neutral green temperature for tsm"

# Export
export -f tds_theme_neutral
