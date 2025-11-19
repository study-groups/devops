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

# Layer 1.6: Theme validation and stack management
source "$TDS_SRC/core/theme_validation.sh"
source "$TDS_SRC/core/theme_stack.sh"
source "$TDS_SRC/core/token_validation.sh"

# Layer 2: Theme system (load themes after semantic_colors.sh)
source "$TDS_SRC/themes/theme_registry.sh"
source "$TDS_SRC/themes/default.sh"

# Temperature themes (for module phase-shifts)
# Register them lazily - themes will be sourced on-demand when first used
tds_register_lazy_theme "warm" "tds_theme_warm" "Warm amber temperature for org"
tds_register_lazy_theme "cool" "tds_theme_cool" "Cool blue temperature for logs"
tds_register_lazy_theme "neutral" "tds_theme_neutral" "Neutral green temperature for tsm"
tds_register_lazy_theme "electric" "tds_theme_electric" "Electric purple temperature for deploy"

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

# NOTE: Chroma is now a separate module at bash/chroma
# It can be loaded via: tmod load chroma

# Version info
export TDS_VERSION="1.0.0"

# ============================================================================
# TDS COMMAND INTERFACE
# ============================================================================

# Load REPL
source "$TDS_SRC/tds_repl.sh"

# Main tds command
tds() {
    local action="${1:-help}"

    case "$action" in
        repl)
            # Launch TDS REPL
            tds_repl
            ;;

        themes)
            # Quick theme list
            tds_list_themes
            ;;

        switch)
            # Switch theme
            local theme="$2"
            if [[ -z "$theme" ]]; then
                echo "Usage: tds switch <theme-name>"
                echo "Available: $(echo ${!TDS_THEME_REGISTRY[@]} | tr ' ' ', ')"
                return 1
            fi
            tds_switch_theme "$theme"
            ;;

        palette)
            # Show palette
            if [[ -f "$TDS_SRC/tools/show_palette.sh" ]]; then
                bash "$TDS_SRC/tools/show_palette.sh" "${2:-$(tds_active_theme)}"
            else
                echo "Palette tool not found"
                return 1
            fi
            ;;

        help|--help|-h)
            cat <<EOF

TDS - Tetra Design System

COMMANDS
  repl              Launch interactive TDS explorer
  themes            List available themes
  switch <theme>    Switch to a theme
  palette [theme]   Show theme palette

EXAMPLES
  tds repl          Interactive color/theme explorer
  tds themes        Show all themes
  tds switch warm   Switch to warm temperature
  tds palette cool  Show cool theme colors

EOF
            ;;

        *)
            echo "Unknown command: $action"
            echo "Try: tds help"
            return 1
            ;;
    esac
}

export -f tds
