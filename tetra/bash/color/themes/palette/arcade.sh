#!/usr/bin/env bash
# Arcade Color Palette
# Bright, bold primary colors for retro arcade game aesthetics
# High contrast, saturated colors like classic arcade cabinets

# Override palettes with Arcade colors
ENV_PRIMARY=(
    "FF0000"  # Pure red
    "FF4500"  # Orange red
    "FF6B00"  # Orange
    "FF8C00"  # Dark orange
    "FFA500"  # Orange
    "FFB700"  # Amber
    "FFCC00"  # Gold
    "FFFF00"  # Yellow
)

MODE_PRIMARY=(
    "0000FF"  # Pure blue
    "0033FF"  # Electric blue
    "0066FF"  # Bright blue
    "0099FF"  # Sky blue
    "00CCFF"  # Cyan blue
    "00FFFF"  # Cyan
    "33FFFF"  # Light cyan
    "66FFFF"  # Very light cyan
)

VERBS_PRIMARY=(
    "FF0000"  # Red (action)
    "FF3300"  # Red-orange
    "FF6600"  # Orange
    "FF9900"  # Bright orange
    "FFAA00"  # Orange-yellow
    "FFCC00"  # Gold
    "FFDD00"  # Golden yellow
    "FFEE00"  # Bright yellow
)

NOUNS_PRIMARY=(
    "00FF00"  # Lime green (objects)
    "33FF33"  # Bright green
    "66FF66"  # Light green
    "99FF33"  # Yellow-green
    "CCFF33"  # Lime yellow
    "CCFF66"  # Light lime
    "99FF99"  # Pale green
    "66FFCC"  # Mint
)

# REPL colors for Arcade theme
REPL_ENV_LOCAL="00FF00"       # Lime green
REPL_ENV_DEV="33FF33"         # Bright green
REPL_ENV_STAGING="66FF66"     # Light green
REPL_ENV_PRODUCTION="FFFF00"  # Yellow (warning!)

REPL_MODE_INSPECT="0099FF"    # Sky blue
REPL_MODE_TRANSFER="00CCFF"   # Cyan blue
REPL_MODE_EXECUTE="FF0000"    # Red (execute!)

REPL_ACTION_ACTIVE="FF6600"   # Orange
REPL_ACTION_NONE="666666"     # Gray

REPL_BRACKET="00FFFF"         # Cyan
REPL_SEPARATOR="FFFF00"       # Yellow
REPL_ARROW="FF0000"           # Red

# Generate complements (from color_palettes.sh)
if command -v generate_complements >/dev/null 2>&1; then
    generate_complements ENV_PRIMARY ENV_COMPLEMENT
    generate_complements MODE_PRIMARY MODE_COMPLEMENT
    generate_complements VERBS_PRIMARY VERBS_COMPLEMENT
    generate_complements NOUNS_PRIMARY NOUNS_COMPLEMENT
fi
