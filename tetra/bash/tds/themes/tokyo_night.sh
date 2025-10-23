#!/usr/bin/env bash

# TDS Tokyo Night Theme
# Dark theme with vibrant colors inspired by Tokyo Night VS Code theme
# https://github.com/enkia/tokyo-night-vscode-theme

tds_load_theme_tokyo_night() {
    # ENV palette (greens/cyans) - Tokyo Night nature colors
    declare -ga ENV_PRIMARY=(
        "9ECE6A"  # Green - success, growth
        "73DACA"  # Cyan - local, development
        "41A6B5"  # Teal - staging
        "7DCFFF"  # Light cyan - information
        "2AC3DE"  # Bright cyan - active
        "449DAB"  # Medium teal - muted
        "1ABC9C"  # Emerald - vibrant
        "0DB9D7"  # Sky blue - highlight
    )

    # MODE palette (blues/purples) - Tokyo Night sky colors
    declare -ga MODE_PRIMARY=(
        "7AA2F7"  # Blue - primary mode
        "2AC3DE"  # Cyan - secondary
        "0DB9D7"  # Sky - tertiary
        "89DDFF"  # Light blue - accent
        "3D59A1"  # Dark blue - subtle
        "565F89"  # Gray-blue - muted
        "9AA5CE"  # Lavender - soft
        "C0CAF5"  # Light text - primary text
    )

    # VERBS palette (reds/oranges) - Tokyo Night warm colors
    declare -ga VERBS_PRIMARY=(
        "F7768E"  # Red - error, danger
        "FF9E64"  # Orange - warning
        "E0AF68"  # Yellow-orange - caution
        "FFAA00"  # Bright orange - attention
        "DB4B4B"  # Dark red - critical
        "FF5D62"  # Pink-red - alert
        "BB9AF7"  # Purple - special
        "FFC777"  # Gold - highlight
    )

    # NOUNS palette (purples/magentas) - Tokyo Night mystical colors
    declare -ga NOUNS_PRIMARY=(
        "BB9AF7"  # Purple - primary noun
        "9D7CD8"  # Dark purple - secondary
        "C099FF"  # Light purple - accent
        "AD8EE6"  # Lavender - soft
        "A9B1D6"  # Gray-purple - muted
        "7982B9"  # Muted purple - subtle
        "565F89"  # Blue-gray - very muted
        "9AA5CE"  # Periwinkle - text
    )

    # Generate complementary colors
    declare -ga ENV_COMPLEMENT MODE_COMPLEMENT VERBS_COMPLEMENT NOUNS_COMPLEMENT

    # Use color_core.sh functions if available
    if declare -f generate_complements >/dev/null 2>&1; then
        generate_complements ENV_PRIMARY ENV_COMPLEMENT
        generate_complements MODE_PRIMARY MODE_COMPLEMENT
        generate_complements VERBS_PRIMARY VERBS_COMPLEMENT
        generate_complements NOUNS_PRIMARY NOUNS_COMPLEMENT
    else
        # Fallback: manually computed complements (opposite colors)
        ENV_COMPLEMENT=(
            "631695" "8C2535" "BE594A" "823000"
            "D53C21" "BB6254" "E54363" "F24628"
        )
        MODE_COMPLEMENT=(
            "855D08" "D53C21" "F24628" "762200"
            "C2A65E" "A9A076" "655231" "3F350A"
        )
        VERBS_COMPLEMENT=(
            "088971" "00619B" "1F5097" "0055FF"
            "24B4B4" "00A29D" "4465 08" "003888"
        )
        NOUNS_COMPLEMENT=(
            "446508" "628327" "3F6600" "527119"
            "564E29" "867D46" "A9A076" "655A31"
        )
    fi

    # Apply semantic color mappings from palettes
    if declare -f tds_apply_semantic_colors >/dev/null 2>&1; then
        tds_apply_semantic_colors
    fi

    # Theme metadata
    TDS_THEME_NAME="Tokyo Night"
    TDS_THEME_AUTHOR="Enkia (adapted for TDS)"
    TDS_THEME_DESCRIPTION="Dark theme with vibrant colors inspired by Tokyo at night"

    return 0
}

# Export function
export -f tds_load_theme_tokyo_night
