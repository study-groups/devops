#!/usr/bin/env bash

# TDS - Tetra Display System
# A layered display framework for terminal UIs with semantic color tokens

# Determine TDS directory
TDS_SRC="${TDS_SRC:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
export TDS_SRC

# Layer 0: ANSI utilities (width calculation, alignment)
source "$TDS_SRC/core/ansi.sh"

# Layer 1: Color foundation (from tetra/bash/color)
COLOR_SRC="${COLOR_SRC:-$(dirname "$TDS_SRC")/color}"
if [[ -f "$COLOR_SRC/color_core.sh" ]]; then
    source "$COLOR_SRC/color_core.sh"
else
    echo "Error: Color system not found at $COLOR_SRC" >&2
    return 1
fi

# Layer 1.5: Semantic colors (must load before themes)
# Themes need tds_apply_semantic_colors() function
source "$TDS_SRC/core/semantic_colors.sh"

# Layer 2: Theme system (load themes after semantic_colors.sh)
source "$TDS_SRC/themes/theme_registry.sh"
source "$TDS_SRC/themes/default.sh"
source "$TDS_SRC/themes/tokyo_night.sh"
source "$TDS_SRC/themes/neon.sh"

# Load active theme (sets palette arrays and semantic colors)
TDS_ACTIVE_THEME="${TDS_ACTIVE_THEME:-default}"
# Quiet load during initialization
TDS_QUIET_LOAD=1 tds_switch_theme "$TDS_ACTIVE_THEME" 2>/dev/null || {
    echo "Warning: Failed to load theme '$TDS_ACTIVE_THEME', falling back to default" >&2
    TDS_QUIET_LOAD=1 tds_switch_theme "default" 2>/dev/null
}

# Layer 3: Color tokens (existing palette → semantic mapping)
source "$TDS_SRC/tokens/color_tokens.sh"
source "$TDS_SRC/tokens/repl_tokens.sh"
source "$TDS_SRC/tokens/unicode_explorer_tokens.sh"

# Layer 4: Layout utilities (borders, panels, spacing)
source "$TDS_SRC/layout/borders.sh"
source "$TDS_SRC/layout/spacing.sh"

# Layer 5: Components (pre-built panels and UI elements)
source "$TDS_SRC/components/panels.sh"

# Layer 6: Display semantics (typography, spacing, emphasis)
source "$TDS_SRC/semantics/typography.sh"
source "$TDS_SRC/semantics/repl_ui.sh"

# Layer 7: Content renderers (markdown, code, tables, etc.)
source "$TDS_SRC/renderers/markdown.sh"
source "$TDS_SRC/renderers/toml.sh"

# Layer 8: Message Sequence Charts (co-developed with bash/msc)
# TDS acts as shepherd for MSC library
MSC_SRC="${MSC_SRC:-$(dirname "$TDS_SRC")/msc}"
if [[ -f "$MSC_SRC/includes.sh" ]]; then
    source "$MSC_SRC/includes.sh"
else
    # MSC not yet installed, skip silently
    :
fi

# TDS initialized
export TDS_LOADED=true

# Version info
export TDS_VERSION="1.0.0"
