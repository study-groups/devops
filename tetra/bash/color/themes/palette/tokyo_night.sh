#!/usr/bin/env bash
# Tokyo Night Color Palette
# Inspired by https://github.com/tokyo-night/tokyo-night-vscode-theme

# Override palettes with Tokyo Night colors
ENV_PRIMARY=(
    "73DACA"  # Cyan (light)
    "2AC3DE"  # Cyan (medium)
    "1ABC9C"  # Teal
    "0DB9D7"  # Dark cyan
    "B4F9F8"  # Very light cyan
    "89DDFF"  # Sky blue
    "7DCFFF"  # Light blue
    "7AA2F7"  # Blue
)

MODE_PRIMARY=(
    "7AA2F7"  # Blue (primary)
    "BB9AF7"  # Purple
    "9D7CD8"  # Dark purple
    "A9B1D6"  # Gray-blue
    "C0CAF5"  # Very light blue
    "B4B5FE"  # Lavender
    "E0AF68"  # Orange
    "FF9E64"  # Bright orange
)

VERBS_PRIMARY=(
    "F7768E"  # Red
    "FF757F"  # Light red
    "DB4B4B"  # Dark red
    "FF9E64"  # Orange
    "E0AF68"  # Yellow-orange
    "FFC777"  # Yellow
    "FFD580"  # Light yellow
    "DCA561"  # Muted yellow
)

NOUNS_PRIMARY=(
    "9D7CD8"  # Purple
    "BB9AF7"  # Light purple
    "C099FF"  # Bright purple
    "A9A1E1"  # Lavender
    "AD8EE6"  # Medium purple
    "CBA6F7"  # Magenta
    "F7B2F7"  # Pink
    "E5C890"  # Tan
)

# Generate complements (from color_palettes.sh)
if command -v generate_complements >/dev/null 2>&1; then
    generate_complements ENV_PRIMARY ENV_COMPLEMENT
    generate_complements MODE_PRIMARY MODE_COMPLEMENT
    generate_complements VERBS_PRIMARY VERBS_COMPLEMENT
    generate_complements NOUNS_PRIMARY NOUNS_COMPLEMENT
fi
