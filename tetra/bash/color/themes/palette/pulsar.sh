#!/usr/bin/env bash
# Pulsar Color Palette
# Electric blue and purple energy wave aesthetic
# Inspired by electromagnetic pulses and energy fields

# Override palettes with Pulsar colors
ENV_PRIMARY=(
    "4169E1"  # Royal blue
    "4682B4"  # Steel blue
    "5F9EA0"  # Cadet blue
    "6495ED"  # Cornflower blue
    "6A5ACD"  # Slate blue
    "7B68EE"  # Medium slate blue
    "836FFF"  # Slate blue (light)
    "9370DB"  # Medium purple
)

MODE_PRIMARY=(
    "8A2BE2"  # Blue violet
    "9400D3"  # Dark violet
    "9932CC"  # Dark orchid
    "BA55D3"  # Medium orchid
    "C71585"  # Medium violet red
    "D946EF"  # Fuchsia
    "E535AB"  # Pink purple
    "FF00FF"  # Magenta
)

VERBS_PRIMARY=(
    "00BFFF"  # Deep sky blue (energy)
    "1E90FF"  # Dodger blue
    "4169E1"  # Royal blue
    "6495ED"  # Cornflower blue
    "7B68EE"  # Medium slate blue
    "8A2BE2"  # Blue violet
    "9370DB"  # Medium purple
    "9966FF"  # Amethyst
)

NOUNS_PRIMARY=(
    "7B68EE"  # Medium slate blue (objects)
    "836FFF"  # Slate blue light
    "9370DB"  # Medium purple
    "9966FF"  # Amethyst
    "A47AE2"  # Light purple
    "B19CD9"  # Lavender purple
    "C4A0FF"  # Bright lavender
    "D4BBFF"  # Pale lavender
)

# REPL colors for Pulsar theme
REPL_ENV_LOCAL="00BFFF"       # Deep sky blue
REPL_ENV_DEV="1E90FF"         # Dodger blue
REPL_ENV_STAGING="4169E1"     # Royal blue
REPL_ENV_PRODUCTION="6A5ACD"  # Slate blue

REPL_MODE_INSPECT="8A2BE2"    # Blue violet
REPL_MODE_TRANSFER="9932CC"   # Dark orchid
REPL_MODE_EXECUTE="BA55D3"    # Medium orchid

REPL_ACTION_ACTIVE="00BFFF"   # Deep sky blue
REPL_ACTION_NONE="666666"     # Gray

REPL_BRACKET="7B68EE"         # Medium slate blue
REPL_SEPARATOR="9370DB"       # Medium purple
REPL_ARROW="00BFFF"           # Deep sky blue

# Generate complements (from color_palettes.sh)
if command -v generate_complements >/dev/null 2>&1; then
    generate_complements ENV_PRIMARY ENV_COMPLEMENT
    generate_complements MODE_PRIMARY MODE_COMPLEMENT
    generate_complements VERBS_PRIMARY VERBS_COMPLEMENT
    generate_complements NOUNS_PRIMARY NOUNS_COMPLEMENT
fi
