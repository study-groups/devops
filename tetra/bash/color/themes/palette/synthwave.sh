#!/usr/bin/env bash
# Synthwave Color Palette
# Neon pink, cyan, and purple aesthetic for vocal synthesis apps
# Inspired by 80s synthwave/vaporwave aesthetics

# Override palettes with Synthwave colors
ENV_PRIMARY=(
    "FF1493"  # Deep pink (hot pink)
    "FF69B4"  # Pink (hot pink lighter)
    "FF00FF"  # Magenta (fuchsia)
    "DA70D6"  # Orchid
    "EE82EE"  # Violet
    "DDA0DD"  # Plum
    "FFB6C1"  # Light pink
    "FFC0CB"  # Pink (pastel)
)

MODE_PRIMARY=(
    "00FFFF"  # Cyan (aqua)
    "00CED1"  # Dark turquoise
    "48D1CC"  # Medium turquoise
    "40E0D0"  # Turquoise
    "7FFFD4"  # Aquamarine
    "00FA9A"  # Medium spring green
    "00FF7F"  # Spring green
    "98FB98"  # Pale green
)

VERBS_PRIMARY=(
    "FF1493"  # Hot pink
    "FF00FF"  # Magenta
    "BA55D3"  # Medium orchid
    "9370DB"  # Medium purple
    "8A2BE2"  # Blue violet
    "9400D3"  # Dark violet
    "9932CC"  # Dark orchid
    "8B008B"  # Dark magenta
)

NOUNS_PRIMARY=(
    "FF6EC7"  # Neon pink
    "FF10F0"  # Electric magenta
    "D946EF"  # Fuchsia
    "C026D3"  # Purple
    "A855F7"  # Light purple
    "9333EA"  # Violet
    "7C3AED"  # Deep violet
    "6B21A8"  # Dark purple
)

# REPL colors for Synthwave theme
REPL_ENV_LOCAL="FF1493"       # Hot pink
REPL_ENV_DEV="FF69B4"         # Pink
REPL_ENV_STAGING="DA70D6"     # Orchid
REPL_ENV_PRODUCTION="FF00FF"  # Magenta

REPL_MODE_INSPECT="00FFFF"    # Cyan
REPL_MODE_TRANSFER="48D1CC"   # Medium turquoise
REPL_MODE_EXECUTE="7FFFD4"    # Aquamarine

REPL_ACTION_ACTIVE="FF1493"   # Hot pink
REPL_ACTION_NONE="666666"     # Gray

REPL_BRACKET="00CED1"         # Dark turquoise
REPL_SEPARATOR="FF69B4"       # Pink
REPL_ARROW="FF00FF"           # Magenta

# Generate complements (from color_palettes.sh)
if command -v generate_complements >/dev/null 2>&1; then
    generate_complements ENV_PRIMARY ENV_COMPLEMENT
    generate_complements MODE_PRIMARY MODE_COMPLEMENT
    generate_complements VERBS_PRIMARY VERBS_COMPLEMENT
    generate_complements NOUNS_PRIMARY NOUNS_COMPLEMENT
fi
