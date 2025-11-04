#!/usr/bin/env bash
# TDS Theme: Warm (Amber/Orange Temperature)
# Used by: org module
# Creates warm, inviting atmosphere for organization management

# Source guard - prevent multiple sourcing
[[ "${__TDS_THEME_WARM_LOADED:-}" == "true" ]] && return 0
__TDS_THEME_WARM_LOADED=true

tds_theme_warm() {
    # Theme metadata
    THEME_NAME="warm"
    THEME_DESCRIPTION="Warm amber/orange temperature for org module"
    THEME_TEMPERATURE="warm"

    # ========================================================================
    # BASE PALETTE - Warm tones
    # ========================================================================

    # Primary warm colors
    PALETTE_PRIMARY_100="#fef3c7"      # Pale amber
    PALETTE_PRIMARY_200="#fde68a"      # Light amber
    PALETTE_PRIMARY_300="#fcd34d"      # Amber
    PALETTE_PRIMARY_400="#fbbf24"      # Rich amber
    PALETTE_PRIMARY_500="#f59e0b"      # Deep amber (primary)
    PALETTE_PRIMARY_600="#d97706"      # Dark amber
    PALETTE_PRIMARY_700="#b45309"      # Darker amber
    PALETTE_PRIMARY_800="#92400e"      # Deep amber brown
    PALETTE_PRIMARY_900="#78350f"      # Almost brown

    # Secondary warm (orange)
    PALETTE_SECONDARY_100="#fed7aa"    # Pale orange
    PALETTE_SECONDARY_200="#fdba74"    # Light orange
    PALETTE_SECONDARY_300="#fb923c"    # Orange
    PALETTE_SECONDARY_400="#f97316"    # Bright orange
    PALETTE_SECONDARY_500="#ea580c"    # Deep orange (secondary)
    PALETTE_SECONDARY_600="#c2410c"    # Dark orange
    PALETTE_SECONDARY_700="#9a3412"    # Darker orange
    PALETTE_SECONDARY_800="#7c2d12"    # Deep orange brown
    PALETTE_SECONDARY_900="#431407"    # Almost maroon

    # Accent warm (red-orange)
    PALETTE_ACCENT_100="#fecaca"       # Pale red
    PALETTE_ACCENT_200="#fca5a5"       # Light red
    PALETTE_ACCENT_300="#f87171"       # Red
    PALETTE_ACCENT_400="#ef4444"       # Bright red
    PALETTE_ACCENT_500="#dc2626"       # Deep red (accent)
    PALETTE_ACCENT_600="#b91c1c"       # Dark red
    PALETTE_ACCENT_700="#991b1b"       # Darker red
    PALETTE_ACCENT_800="#7f1d1d"       # Deep maroon
    PALETTE_ACCENT_900="#450a0a"       # Almost black

    # Neutrals (warm grays)
    PALETTE_NEUTRAL_100="#fafaf9"      # Almost white
    PALETTE_NEUTRAL_200="#f5f5f4"      # Very light warm gray
    PALETTE_NEUTRAL_300="#e7e5e4"      # Light warm gray
    PALETTE_NEUTRAL_400="#d6d3d1"      # Medium light
    PALETTE_NEUTRAL_500="#a8a29e"      # Medium warm gray
    PALETTE_NEUTRAL_600="#78716c"      # Medium dark
    PALETTE_NEUTRAL_700="#57534e"      # Dark warm gray
    PALETTE_NEUTRAL_800="#44403c"      # Darker
    PALETTE_NEUTRAL_900="#292524"      # Almost black

    # State colors (warm variants)
    PALETTE_SUCCESS="#16a34a"          # Warm green
    PALETTE_WARNING="#ea580c"          # Orange
    PALETTE_ERROR="#dc2626"            # Red
    PALETTE_INFO="#f59e0b"             # Amber

    # ========================================================================
    # PALETTE ARRAYS - Map to TDS token system
    # ========================================================================
    # The TDS token system expects these 4 palette arrays (8 colors each)
    # We map warm colors to create a cohesive warm temperature aesthetic

    # ENV_PRIMARY - Used for environment indicators and success states
    ENV_PRIMARY=(
        "$PALETTE_PRIMARY_500"   # 0: Deep amber (primary warm)
        "$PALETTE_PRIMARY_400"   # 1: Rich amber
        "$PALETTE_PRIMARY_300"   # 2: Amber
        "$PALETTE_PRIMARY_600"   # 3: Dark amber
        "$PALETTE_NEUTRAL_500"   # 4: Medium warm gray
        "$PALETTE_NEUTRAL_600"   # 5: Medium dark gray
        "$PALETTE_NEUTRAL_700"   # 6: Dark warm gray
        "$PALETTE_NEUTRAL_100"   # 7: Almost white
    )

    # MODE_PRIMARY - Used for mode indicators and structural elements
    MODE_PRIMARY=(
        "$PALETTE_SECONDARY_500" # 0: Deep orange (secondary)
        "$PALETTE_SECONDARY_400" # 1: Bright orange
        "$PALETTE_SECONDARY_300" # 2: Orange
        "$PALETTE_SECONDARY_600" # 3: Dark orange
        "$PALETTE_NEUTRAL_400"   # 4: Medium light gray
        "$PALETTE_NEUTRAL_500"   # 5: Medium warm gray
        "$PALETTE_NEUTRAL_600"   # 6: Medium dark gray
        "$PALETTE_NEUTRAL_200"   # 7: Very light warm gray
    )

    # VERBS_PRIMARY - Used for actions and interactive elements
    VERBS_PRIMARY=(
        "$PALETTE_ACCENT_500"    # 0: Deep red (accent)
        "$PALETTE_ACCENT_400"    # 1: Bright red
        "$PALETTE_ACCENT_300"    # 2: Red
        "$PALETTE_SECONDARY_500" # 3: Deep orange (for warnings)
        "$PALETTE_PRIMARY_400"   # 4: Rich amber
        "$PALETTE_NEUTRAL_600"   # 5: Medium dark
        "$PALETTE_NEUTRAL_700"   # 6: Dark
        "$PALETTE_NEUTRAL_300"   # 7: Light warm gray
    )

    # NOUNS_PRIMARY - Used for data/noun elements
    NOUNS_PRIMARY=(
        "$PALETTE_PRIMARY_400"   # 0: Rich amber
        "$PALETTE_PRIMARY_300"   # 1: Amber
        "$PALETTE_SECONDARY_400" # 2: Bright orange
        "$PALETTE_ACCENT_300"    # 3: Red
        "$PALETTE_NEUTRAL_300"   # 4: Light warm gray
        "$PALETTE_NEUTRAL_400"   # 5: Medium light
        "$PALETTE_NEUTRAL_500"   # 6: Medium warm gray
        "$PALETTE_NEUTRAL_200"   # 7: Very light
    )

    # Apply semantic colors using palette arrays
    tds_apply_semantic_colors
}

# Register theme
tds_register_theme "warm" "tds_theme_warm" "Warm amber temperature for org"

# Export
export -f tds_theme_warm
