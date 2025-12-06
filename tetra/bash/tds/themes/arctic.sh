#!/usr/bin/env bash
# TDS Theme: Arctic (Reference Implementation)
#
# PALETTE STRUCTURE:
#   ENV_PRIMARY   - ALTERNATE: two bright hue families (A↔B)
#   MODE_PRIMARY  - STATUS: error/warning/success/info + dim versions
#   VERBS_PRIMARY - ACTIONS: primary/secondary/destructive/constructive + ACCENT
#   NOUNS_PRIMARY - GRADIENT: intensity ramp dark→light
#
# ENV - ALTERNATE pattern:
#   [0] A primary   [1] B primary
#   [2] A light     [3] B light
#   [4] A muted     [5] B muted
#   [6] A dim       [7] B dim
#
# MODE - STATUS pattern:
#   [0] error       [1] warning     [2] success     [3] info
#   [4] error-dim   [5] warning-dim [6] success-dim [7] info-dim
#
# VERBS - ACTIONS + ACCENT pattern:
#   [0] primary     [1] secondary   [2] destructive [3] constructive
#   [4] accent      [5] highlight   [6] focus       [7] muted
#
# NOUNS - GRADIENT pattern:
#   [0] darkest → [7] lightest

tds_theme_arctic() {
    # Theme metadata
    THEME_NAME="arctic"
    THEME_DESCRIPTION="Arctic blue/cyan - reference implementation"
    THEME_TEMPERATURE="cool"

    # ========================================================================
    # BASE PALETTE - Arctic tones
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

    # Status colors (MODE)
    local red_500="#ef4444"
    local red_700="#b91c1c"
    local amber_500="#f59e0b"
    local amber_700="#b45309"
    local green_500="#22c55e"
    local green_700="#15803d"
    local sky_500="#0ea5e9"
    local sky_700="#0369a1"

    # Action colors (VERBS) - arctic tinted
    local action_primary="#0ea5e9"      # sky - primary action
    local action_secondary="#6366f1"    # indigo - secondary
    local action_destructive="#ef4444"  # red - destructive
    local action_constructive="#22c55e" # green - constructive
    local action_accent="#8b5cf6"       # violet - accent
    local action_highlight="#f472b6"    # pink - highlight
    local action_focus="#38bdf8"        # sky light - focus
    local action_muted="#64748b"        # slate - muted

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
    # MODE_PRIMARY - STATUS: error/warning/success/info + dims
    # ========================================================================
    MODE_PRIMARY=(
        "$red_500"     # 0: error
        "$amber_500"   # 1: warning
        "$green_500"   # 2: success
        "$sky_500"     # 3: info
        "$red_700"     # 4: error-dim
        "$amber_700"   # 5: warning-dim
        "$green_700"   # 6: success-dim
        "$sky_700"     # 7: info-dim
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
    # NOUNS_PRIMARY - GRADIENT: dark→light
    # ========================================================================
    NOUNS_PRIMARY=(
        "$slate_900"   # 0: darkest
        "$slate_700"   # 1: dark
        "$slate_600"   # 2: medium-dark
        "$slate_500"   # 3: medium
        "$slate_400"   # 4: medium-light
        "$slate_300"   # 5: light
        "$slate_200"   # 6: pale
        "$slate_50"    # 7: lightest
    )

    # Apply semantic colors using palette arrays
    tds_apply_semantic_colors
}

# Register theme
tds_register_theme "arctic" "tds_theme_arctic" "Arctic blue - reference implementation"

# Export
export -f tds_theme_arctic
