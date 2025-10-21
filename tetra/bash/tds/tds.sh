#!/usr/bin/env bash

# TDS - Tetra Display System
# A layered display framework for terminal UIs with semantic color tokens

# Determine TDS directory
TDS_SRC="${TDS_SRC:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
export TDS_SRC

# Layer 0: Color foundation (from tetra/bash/color)
COLOR_SRC="${COLOR_SRC:-$(dirname "$TDS_SRC")/color}"
if [[ -f "$COLOR_SRC/color_core.sh" ]]; then
    source "$COLOR_SRC/color_core.sh"
    source "$COLOR_SRC/color_palettes.sh"
else
    echo "Error: Color system not found at $COLOR_SRC" >&2
    return 1
fi

# Layer 1: Color tokens (semantic → palette mapping)
source "$TDS_SRC/tokens/color_tokens.sh"
source "$TDS_SRC/tokens/repl_tokens.sh"

# Layer 2: Display semantics (typography, spacing, emphasis)
source "$TDS_SRC/semantics/typography.sh"
source "$TDS_SRC/semantics/repl_ui.sh"

# Layer 3: Content renderers (markdown, code, tables, etc.)
source "$TDS_SRC/renderers/markdown.sh"

# TDS initialized
export TDS_LOADED=true
