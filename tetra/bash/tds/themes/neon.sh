#!/usr/bin/env bash

# TDS Neon Theme
# High-contrast cyberpunk neon theme with electric colors

tds_load_theme_neon() {
    # ENV palette (neon greens/cyans) - Electric nature
    declare -ga ENV_PRIMARY=(
        "00FF00"  # Pure neon green
        "00FF88"  # Mint green neon
        "88FF00"  # Lime neon
        "00FFAA"  # Aqua green neon
        "00FFFF"  # Pure cyan neon
        "00AAFF"  # Cyan-blue neon
        "88FFFF"  # Light cyan neon
        "AAFFFF"  # Pale cyan neon
    )

    # MODE palette (neon blues/purples) - Electric sky
    declare -ga MODE_PRIMARY=(
        "0088FF"  # Electric blue
        "00AAFF"  # Bright blue neon
        "00CCFF"  # Sky blue neon
        "00EEFF"  # Pale blue neon
        "8800FF"  # Electric purple
        "AA00FF"  # Bright purple neon
        "CC00FF"  # Magenta-purple neon
        "EE00FF"  # Pink-purple neon
    )

    # VERBS palette (neon pinks/oranges) - Electric fire
    declare -ga VERBS_PRIMARY=(
        "FF0044"  # Hot pink neon
        "FF0088"  # Magenta neon
        "FF00CC"  # Pink-magenta neon
        "FF00FF"  # Pure magenta neon
        "FF4400"  # Orange-red neon
        "FF8800"  # Orange neon
        "FFCC00"  # Yellow-orange neon
        "FFFF00"  # Pure yellow neon
    )

    # NOUNS palette (neon magentas/violets) - Electric mystique
    declare -ga NOUNS_PRIMARY=(
        "FF00FF"  # Pure magenta neon
        "FF88FF"  # Light magenta neon
        "CC00FF"  # Violet-magenta neon
        "AA00FF"  # Deep purple neon
        "8800FF"  # Electric violet
        "4400FF"  # Blue-violet neon
        "8888FF"  # Light violet neon
        "AAAAFF"  # Pale violet neon
    )

    # Generate complementary colors (opposite on color wheel)
    declare -ga ENV_COMPLEMENT MODE_COMPLEMENT VERBS_COMPLEMENT NOUNS_COMPLEMENT

    if declare -f generate_complements >/dev/null 2>&1; then
        generate_complements ENV_PRIMARY ENV_COMPLEMENT
        generate_complements MODE_PRIMARY MODE_COMPLEMENT
        generate_complements VERBS_PRIMARY VERBS_COMPLEMENT
        generate_complements NOUNS_PRIMARY NOUNS_COMPLEMENT
    else
        # Fallback: manually computed complements
        ENV_COMPLEMENT=(
            "FF00FF" "FF0077" "7700FF" "FF0055"
            "FF0000" "FF5500" "770000" "550000"
        )
        MODE_COMPLEMENT=(
            "FF7700" "FF5500" "FF3300" "FF1100"
            "77FF00" "55FF00" "33FF00" "11FF00"
        )
        VERBS_COMPLEMENT=(
            "00FFBB" "00FF77" "00FF33" "00FF00"
            "00BBFF" "0077FF" "0033FF" "0000FF"
        )
        NOUNS_COMPLEMENT=(
            "00FF00" "007700" "33FF00" "55FF00"
            "77FF00" "BBFF00" "777700" "555500"
        )
    fi

    # Apply semantic color mappings from palettes
    if declare -f tds_apply_semantic_colors >/dev/null 2>&1; then
        tds_apply_semantic_colors
    fi

    # Theme metadata
    TDS_THEME_NAME="Neon"
    TDS_THEME_AUTHOR="Tetra"
    TDS_THEME_DESCRIPTION="High-contrast cyberpunk neon theme with electric colors"

    return 0
}

# Export function
export -f tds_load_theme_neon
