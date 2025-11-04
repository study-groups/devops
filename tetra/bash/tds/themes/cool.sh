#!/usr/bin/env bash
# TDS Theme: Cool (Blue/Cyan Temperature)
# Used by: logs module
# Creates analytical, focused atmosphere for log analysis

tds_theme_cool() {
    # Theme metadata
    THEME_NAME="cool"
    THEME_DESCRIPTION="Cool blue/cyan temperature for logs module"
    THEME_TEMPERATURE="cool"

    # ========================================================================
    # BASE PALETTE - Cool tones
    # ========================================================================

    # Primary cool (cyan/sky)
    PALETTE_PRIMARY_100="#e0f2fe"      # Pale sky
    PALETTE_PRIMARY_200="#bae6fd"      # Light sky
    PALETTE_PRIMARY_300="#7dd3fc"      # Sky
    PALETTE_PRIMARY_400="#38bdf8"      # Bright sky
    PALETTE_PRIMARY_500="#0ea5e9"      # Deep sky (primary)
    PALETTE_PRIMARY_600="#0284c7"      # Dark sky
    PALETTE_PRIMARY_700="#0369a1"      # Darker sky
    PALETTE_PRIMARY_800="#075985"      # Deep blue
    PALETTE_PRIMARY_900="#0c4a6e"      # Navy

    # Secondary cool (blue)
    PALETTE_SECONDARY_100="#dbeafe"    # Pale blue
    PALETTE_SECONDARY_200="#bfdbfe"    # Light blue
    PALETTE_SECONDARY_300="#93c5fd"    # Blue
    PALETTE_SECONDARY_400="#60a5fa"    # Bright blue
    PALETTE_SECONDARY_500="#3b82f6"    # Deep blue (secondary)
    PALETTE_SECONDARY_600="#2563eb"    # Dark blue
    PALETTE_SECONDARY_700="#1d4ed8"    # Darker blue
    PALETTE_SECONDARY_800="#1e40af"    # Deep blue
    PALETTE_SECONDARY_900="#1e3a8a"    # Navy blue

    # Accent cool (cyan)
    PALETTE_ACCENT_100="#cffafe"       # Pale cyan
    PALETTE_ACCENT_200="#a5f3fc"       # Light cyan
    PALETTE_ACCENT_300="#67e8f9"       # Cyan
    PALETTE_ACCENT_400="#22d3ee"       # Bright cyan
    PALETTE_ACCENT_500="#06b6d4"       # Deep cyan (accent)
    PALETTE_ACCENT_600="#0891b2"       # Dark cyan
    PALETTE_ACCENT_700="#0e7490"       # Darker cyan
    PALETTE_ACCENT_800="#155e75"       # Deep teal
    PALETTE_ACCENT_900="#164e63"       # Dark teal

    # Neutrals (cool grays)
    PALETTE_NEUTRAL_100="#f8fafc"      # Almost white
    PALETTE_NEUTRAL_200="#f1f5f9"      # Very light cool gray
    PALETTE_NEUTRAL_300="#e2e8f0"      # Light cool gray
    PALETTE_NEUTRAL_400="#cbd5e1"      # Medium light
    PALETTE_NEUTRAL_500="#94a3b8"      # Medium cool gray
    PALETTE_NEUTRAL_600="#64748b"      # Medium dark
    PALETTE_NEUTRAL_700="#475569"      # Dark cool gray
    PALETTE_NEUTRAL_800="#334155"      # Darker
    PALETTE_NEUTRAL_900="#1e293b"      # Almost black

    # State colors (cool variants)
    PALETTE_SUCCESS="#10b981"          # Cool green
    PALETTE_WARNING="#0ea5e9"          # Sky blue
    PALETTE_ERROR="#ef4444"            # Red
    PALETTE_INFO="#06b6d4"             # Cyan

    # ========================================================================
    # PALETTE ARRAYS - Map to TDS token system
    # ========================================================================

    # ENV_PRIMARY - Used for environment indicators and success states
    ENV_PRIMARY=(
        "$PALETTE_PRIMARY_500"   # 0: Deep sky (primary cool)
        "$PALETTE_PRIMARY_400"   # 1: Bright sky
        "$PALETTE_PRIMARY_300"   # 2: Sky
        "$PALETTE_PRIMARY_600"   # 3: Dark sky
        "$PALETTE_NEUTRAL_500"   # 4: Medium cool gray
        "$PALETTE_NEUTRAL_600"   # 5: Medium dark gray
        "$PALETTE_NEUTRAL_700"   # 6: Dark cool gray
        "$PALETTE_NEUTRAL_100"   # 7: Almost white
    )

    # MODE_PRIMARY - Used for mode indicators and structural elements
    MODE_PRIMARY=(
        "$PALETTE_SECONDARY_500" # 0: Deep blue (secondary)
        "$PALETTE_SECONDARY_400" # 1: Bright blue
        "$PALETTE_SECONDARY_300" # 2: Blue
        "$PALETTE_SECONDARY_600" # 3: Dark blue
        "$PALETTE_NEUTRAL_400"   # 4: Medium light gray
        "$PALETTE_NEUTRAL_500"   # 5: Medium cool gray
        "$PALETTE_NEUTRAL_600"   # 6: Medium dark gray
        "$PALETTE_NEUTRAL_200"   # 7: Very light cool gray
    )

    # VERBS_PRIMARY - Used for actions and interactive elements
    VERBS_PRIMARY=(
        "$PALETTE_ERROR"         # 0: Red (errors)
        "$PALETTE_ACCENT_400"    # 1: Bright cyan
        "$PALETTE_ACCENT_300"    # 2: Cyan
        "$PALETTE_PRIMARY_500"   # 3: Deep sky (for warnings)
        "$PALETTE_PRIMARY_400"   # 4: Bright sky
        "$PALETTE_NEUTRAL_600"   # 5: Medium dark
        "$PALETTE_NEUTRAL_700"   # 6: Dark
        "$PALETTE_NEUTRAL_300"   # 7: Light cool gray
    )

    # NOUNS_PRIMARY - Used for data/noun elements
    NOUNS_PRIMARY=(
        "$PALETTE_ACCENT_500"    # 0: Deep cyan
        "$PALETTE_ACCENT_400"    # 1: Bright cyan
        "$PALETTE_PRIMARY_400"   # 2: Bright sky
        "$PALETTE_SECONDARY_400" # 3: Bright blue
        "$PALETTE_NEUTRAL_300"   # 4: Light cool gray
        "$PALETTE_NEUTRAL_400"   # 5: Medium light
        "$PALETTE_NEUTRAL_500"   # 6: Medium cool gray
        "$PALETTE_NEUTRAL_200"   # 7: Very light
    )

    # Apply semantic colors using palette arrays
    tds_apply_semantic_colors
}

# Register theme
tds_register_theme "cool" "tds_theme_cool" "Cool blue temperature for logs"

# Export
export -f tds_theme_cool
