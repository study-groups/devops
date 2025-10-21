#!/usr/bin/env bash
# Nord Color Palette
# Inspired by https://www.nordtheme.com/

# Override palettes with Nord colors
ENV_PRIMARY=(
    "8FBCBB"  # Frost cyan (light)
    "88C0D0"  # Frost blue-cyan
    "81A1C1"  # Frost blue
    "5E81AC"  # Frost dark blue
    "A3BE8C"  # Aurora green
    "B48EAD"  # Aurora purple
    "D08770"  # Aurora orange
    "EBCB8B"  # Aurora yellow
)

MODE_PRIMARY=(
    "5E81AC"  # Frost dark blue (primary)
    "81A1C1"  # Frost blue
    "88C0D0"  # Frost blue-cyan
    "8FBCBB"  # Frost cyan
    "4C566A"  # Polar night gray
    "3B4252"  # Polar night dark gray
    "2E3440"  # Polar night darkest
    "D8DEE9"  # Snow light gray
)

VERBS_PRIMARY=(
    "BF616A"  # Aurora red
    "D08770"  # Aurora orange
    "EBCB8B"  # Aurora yellow
    "A3BE8C"  # Aurora green
    "B48EAD"  # Aurora purple
    "88C0D0"  # Frost blue-cyan
    "8FBCBB"  # Frost cyan
    "5E81AC"  # Frost dark blue
)

NOUNS_PRIMARY=(
    "B48EAD"  # Aurora purple (primary)
    "A3BE8C"  # Aurora green
    "EBCB8B"  # Aurora yellow
    "D08770"  # Aurora orange
    "BF616A"  # Aurora red
    "8FBCBB"  # Frost cyan
    "88C0D0"  # Frost blue-cyan
    "81A1C1"  # Frost blue
)

# Generate complements
if command -v generate_complements >/dev/null 2>&1; then
    generate_complements ENV_PRIMARY ENV_COMPLEMENT
    generate_complements MODE_PRIMARY MODE_COMPLEMENT
    generate_complements VERBS_PRIMARY VERBS_COMPLEMENT
    generate_complements NOUNS_PRIMARY NOUNS_COMPLEMENT
fi
