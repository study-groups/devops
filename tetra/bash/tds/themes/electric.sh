#!/usr/bin/env bash
# TDS Theme: Electric (Purple/Magenta Temperature)
# Used by: deploy module
# Creates energetic, action-oriented atmosphere for deployment

tds_theme_electric() {
    # Theme metadata
    THEME_NAME="electric"
    THEME_DESCRIPTION="Electric purple/magenta temperature for deploy module"
    THEME_TEMPERATURE="electric"

    # ========================================================================
    # BASE PALETTE - Electric tones
    # ========================================================================

    # Primary electric (violet)
    PALETTE_PRIMARY_100="#ede9fe"      # Pale violet
    PALETTE_PRIMARY_200="#ddd6fe"      # Light violet
    PALETTE_PRIMARY_300="#c4b5fd"      # Violet
    PALETTE_PRIMARY_400="#a78bfa"      # Bright violet
    PALETTE_PRIMARY_500="#8b5cf6"      # Deep violet (primary)
    PALETTE_PRIMARY_600="#7c3aed"      # Dark violet
    PALETTE_PRIMARY_700="#6d28d9"      # Darker violet
    PALETTE_PRIMARY_800="#5b21b6"      # Deep purple
    PALETTE_PRIMARY_900="#4c1d95"      # Almost black purple

    # Secondary electric (purple)
    PALETTE_SECONDARY_100="#fae8ff"    # Pale fuchsia
    PALETTE_SECONDARY_200="#f5d0fe"    # Light fuchsia
    PALETTE_SECONDARY_300="#f0abfc"    # Fuchsia
    PALETTE_SECONDARY_400="#e879f9"    # Bright fuchsia
    PALETTE_SECONDARY_500="#d946ef"    # Deep fuchsia (secondary)
    PALETTE_SECONDARY_600="#c026d3"    # Dark fuchsia
    PALETTE_SECONDARY_700="#a21caf"    # Darker fuchsia
    PALETTE_SECONDARY_800="#86198f"    # Deep magenta
    PALETTE_SECONDARY_900="#701a75"    # Dark magenta

    # Accent electric (pink)
    PALETTE_ACCENT_100="#fce7f3"       # Pale pink
    PALETTE_ACCENT_200="#fbcfe8"       # Light pink
    PALETTE_ACCENT_300="#f9a8d4"       # Pink
    PALETTE_ACCENT_400="#f472b6"       # Bright pink
    PALETTE_ACCENT_500="#ec4899"       # Deep pink (accent)
    PALETTE_ACCENT_600="#db2777"       # Dark pink
    PALETTE_ACCENT_700="#be185d"       # Darker pink
    PALETTE_ACCENT_800="#9f1239"       # Deep rose
    PALETTE_ACCENT_900="#881337"       # Dark rose

    # Neutrals (purple-tinted grays)
    PALETTE_NEUTRAL_100="#fafaf9"      # Almost white
    PALETTE_NEUTRAL_200="#f5f3ff"      # Very light purple-gray
    PALETTE_NEUTRAL_300="#e9d5ff"      # Light purple-gray
    PALETTE_NEUTRAL_400="#d8b4fe"      # Medium light
    PALETTE_NEUTRAL_500="#a78bfa"      # Medium purple-gray
    PALETTE_NEUTRAL_600="#7c3aed"      # Medium dark
    PALETTE_NEUTRAL_700="#6d28d9"      # Dark purple-gray
    PALETTE_NEUTRAL_800="#5b21b6"      # Darker
    PALETTE_NEUTRAL_900="#4c1d95"      # Almost black

    # State colors (electric variants)
    PALETTE_SUCCESS="#10b981"          # Green (contrast)
    PALETTE_WARNING="#f59e0b"          # Amber (contrast)
    PALETTE_ERROR="#ef4444"            # Red
    PALETTE_INFO="#d946ef"             # Fuchsia

    # ========================================================================
    # PALETTE ARRAYS - Map to TDS token system
    # ========================================================================

    # ENV_PRIMARY - Used for environment indicators and success states
    ENV_PRIMARY=(
        "$PALETTE_PRIMARY_500"   # 0: Deep violet (primary electric)
        "$PALETTE_PRIMARY_400"   # 1: Bright violet
        "$PALETTE_PRIMARY_300"   # 2: Violet
        "$PALETTE_PRIMARY_600"   # 3: Dark violet
        "$PALETTE_NEUTRAL_500"   # 4: Medium purple-gray
        "$PALETTE_NEUTRAL_600"   # 5: Medium dark
        "$PALETTE_NEUTRAL_700"   # 6: Dark purple-gray
        "$PALETTE_NEUTRAL_100"   # 7: Almost white
    )

    # MODE_PRIMARY - Used for mode indicators and structural elements
    MODE_PRIMARY=(
        "$PALETTE_SECONDARY_500" # 0: Deep fuchsia (secondary)
        "$PALETTE_SECONDARY_400" # 1: Bright fuchsia
        "$PALETTE_SECONDARY_300" # 2: Fuchsia
        "$PALETTE_SECONDARY_600" # 3: Dark fuchsia
        "$PALETTE_NEUTRAL_400"   # 4: Medium light
        "$PALETTE_NEUTRAL_500"   # 5: Medium purple-gray
        "$PALETTE_NEUTRAL_600"   # 6: Medium dark
        "$PALETTE_NEUTRAL_200"   # 7: Very light purple-gray
    )

    # VERBS_PRIMARY - Used for actions and interactive elements
    VERBS_PRIMARY=(
        "$PALETTE_ERROR"         # 0: Red (errors)
        "$PALETTE_ACCENT_500"    # 1: Deep pink
        "$PALETTE_ACCENT_400"    # 2: Bright pink
        "$PALETTE_WARNING"       # 3: Amber (for warnings)
        "$PALETTE_PRIMARY_400"   # 4: Bright violet
        "$PALETTE_NEUTRAL_600"   # 5: Medium dark
        "$PALETTE_NEUTRAL_700"   # 6: Dark
        "$PALETTE_NEUTRAL_300"   # 7: Light purple-gray
    )

    # NOUNS_PRIMARY - Used for data/noun elements
    NOUNS_PRIMARY=(
        "$PALETTE_ACCENT_500"    # 0: Deep pink
        "$PALETTE_ACCENT_400"    # 1: Bright pink
        "$PALETTE_SECONDARY_400" # 2: Bright fuchsia
        "$PALETTE_PRIMARY_400"   # 3: Bright violet
        "$PALETTE_NEUTRAL_300"   # 4: Light purple-gray
        "$PALETTE_NEUTRAL_400"   # 5: Medium light
        "$PALETTE_NEUTRAL_500"   # 6: Medium purple-gray
        "$PALETTE_NEUTRAL_200"   # 7: Very light
    )

    # Apply semantic colors using palette arrays
    tds_apply_semantic_colors
}

# Register theme
tds_register_theme "electric" "tds_theme_electric" "Electric purple temperature for deploy"

# Export
export -f tds_theme_electric
