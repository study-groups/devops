#!/usr/bin/env bash
# TDS Theme: Neutral (Green/Gray Temperature)
# Used by: tsm module
# Creates balanced, operational atmosphere for service management

tds_theme_neutral() {
    # Theme metadata
    THEME_NAME="neutral"
    THEME_DESCRIPTION="Neutral green/gray temperature for tsm module"
    THEME_TEMPERATURE="neutral"

    # ========================================================================
    # BASE PALETTE - Neutral tones
    # ========================================================================

    # Primary neutral (sage green)
    PALETTE_PRIMARY_100="#dcfce7"      # Pale green
    PALETTE_PRIMARY_200="#bbf7d0"      # Light green
    PALETTE_PRIMARY_300="#86efac"      # Green
    PALETTE_PRIMARY_400="#4ade80"      # Bright green
    PALETTE_PRIMARY_500="#22c55e"      # Deep green (primary)
    PALETTE_PRIMARY_600="#16a34a"      # Dark green
    PALETTE_PRIMARY_700="#15803d"      # Darker green
    PALETTE_PRIMARY_800="#166534"      # Deep forest
    PALETTE_PRIMARY_900="#14532d"      # Almost black green

    # Secondary neutral (emerald)
    PALETTE_SECONDARY_100="#d1fae5"    # Pale emerald
    PALETTE_SECONDARY_200="#a7f3d0"    # Light emerald
    PALETTE_SECONDARY_300="#6ee7b7"    # Emerald
    PALETTE_SECONDARY_400="#34d399"    # Bright emerald
    PALETTE_SECONDARY_500="#10b981"    # Deep emerald (secondary)
    PALETTE_SECONDARY_600="#059669"    # Dark emerald
    PALETTE_SECONDARY_700="#047857"    # Darker emerald
    PALETTE_SECONDARY_800="#065f46"    # Deep teal
    PALETTE_SECONDARY_900="#064e3b"    # Dark teal

    # Accent neutral (teal)
    PALETTE_ACCENT_100="#ccfbf1"       # Pale teal
    PALETTE_ACCENT_200="#99f6e4"       # Light teal
    PALETTE_ACCENT_300="#5eead4"       # Teal
    PALETTE_ACCENT_400="#2dd4bf"       # Bright teal
    PALETTE_ACCENT_500="#14b8a6"       # Deep teal (accent)
    PALETTE_ACCENT_600="#0d9488"       # Dark teal
    PALETTE_ACCENT_700="#0f766e"       # Darker teal
    PALETTE_ACCENT_800="#115e59"       # Deep teal
    PALETTE_ACCENT_900="#134e4a"       # Dark teal

    # Neutrals (true grays - balanced)
    PALETTE_NEUTRAL_100="#f9fafb"      # Almost white
    PALETTE_NEUTRAL_200="#f3f4f6"      # Very light gray
    PALETTE_NEUTRAL_300="#e5e7eb"      # Light gray
    PALETTE_NEUTRAL_400="#d1d5db"      # Medium light
    PALETTE_NEUTRAL_500="#9ca3af"      # Medium gray
    PALETTE_NEUTRAL_600="#6b7280"      # Medium dark
    PALETTE_NEUTRAL_700="#4b5563"      # Dark gray
    PALETTE_NEUTRAL_800="#374151"      # Darker
    PALETTE_NEUTRAL_900="#1f2937"      # Almost black

    # State colors (neutral variants)
    PALETTE_SUCCESS="#22c55e"          # Green
    PALETTE_WARNING="#f59e0b"          # Amber
    PALETTE_ERROR="#ef4444"            # Red
    PALETTE_INFO="#10b981"             # Emerald

    # ========================================================================
    # PALETTE ARRAYS - Map to TDS token system
    # ========================================================================

    # ENV_PRIMARY - Used for environment indicators and success states
    ENV_PRIMARY=(
        "$PALETTE_PRIMARY_500"   # 0: Deep green (primary neutral)
        "$PALETTE_PRIMARY_400"   # 1: Bright green
        "$PALETTE_PRIMARY_300"   # 2: Green
        "$PALETTE_PRIMARY_600"   # 3: Dark green
        "$PALETTE_NEUTRAL_500"   # 4: Medium gray
        "$PALETTE_NEUTRAL_600"   # 5: Medium dark gray
        "$PALETTE_NEUTRAL_700"   # 6: Dark gray
        "$PALETTE_NEUTRAL_100"   # 7: Almost white
    )

    # MODE_PRIMARY - Used for mode indicators and structural elements
    MODE_PRIMARY=(
        "$PALETTE_SECONDARY_500" # 0: Deep emerald (secondary)
        "$PALETTE_SECONDARY_400" # 1: Bright emerald
        "$PALETTE_SECONDARY_300" # 2: Emerald
        "$PALETTE_SECONDARY_600" # 3: Dark emerald
        "$PALETTE_NEUTRAL_400"   # 4: Medium light gray
        "$PALETTE_NEUTRAL_500"   # 5: Medium gray
        "$PALETTE_NEUTRAL_600"   # 6: Medium dark gray
        "$PALETTE_NEUTRAL_200"   # 7: Very light gray
    )

    # VERBS_PRIMARY - Used for actions and interactive elements
    VERBS_PRIMARY=(
        "$PALETTE_ERROR"         # 0: Red (errors)
        "$PALETTE_WARNING"       # 1: Amber (warnings)
        "$PALETTE_ACCENT_400"    # 2: Bright teal
        "$PALETTE_ACCENT_500"    # 3: Deep teal
        "$PALETTE_PRIMARY_400"   # 4: Bright green
        "$PALETTE_NEUTRAL_600"   # 5: Medium dark
        "$PALETTE_NEUTRAL_700"   # 6: Dark
        "$PALETTE_NEUTRAL_300"   # 7: Light gray
    )

    # NOUNS_PRIMARY - Used for data/noun elements
    NOUNS_PRIMARY=(
        "$PALETTE_ACCENT_500"    # 0: Deep teal
        "$PALETTE_ACCENT_400"    # 1: Bright teal
        "$PALETTE_SECONDARY_400" # 2: Bright emerald
        "$PALETTE_PRIMARY_400"   # 3: Bright green
        "$PALETTE_NEUTRAL_300"   # 4: Light gray
        "$PALETTE_NEUTRAL_400"   # 5: Medium light
        "$PALETTE_NEUTRAL_500"   # 6: Medium gray
        "$PALETTE_NEUTRAL_200"   # 7: Very light
    )

    # Apply semantic colors using palette arrays
    tds_apply_semantic_colors
}

# Register theme
tds_register_theme "neutral" "tds_theme_neutral" "Neutral green temperature for tsm"

# Export
export -f tds_theme_neutral
