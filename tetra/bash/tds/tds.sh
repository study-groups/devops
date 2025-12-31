#!/usr/bin/env bash
# TDS - Tetra Display System
# A layered display framework for terminal UIs with semantic color tokens

# Determine TDS directory
TDS_SRC="${TDS_SRC:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
export TDS_SRC

# Fallback colors used when palette/token resolution fails
declare -g TDS_FALLBACK_GRAY="888888"
declare -g TDS_FALLBACK_TEXT="C0CAF5"
export TDS_FALLBACK_GRAY TDS_FALLBACK_TEXT

# =============================================================================
# LAYER 0: ANSI utilities (width calculation, alignment)
# =============================================================================
source "$TDS_SRC/core/ansi.sh"

# =============================================================================
# LAYER 1: Color foundation (from tetra/bash/color)
# =============================================================================
COLOR_SRC="${COLOR_SRC:-$(dirname "$TDS_SRC")/color}"
if [[ -f "$COLOR_SRC/color_core.sh" ]]; then
    source "$COLOR_SRC/color_core.sh"
else
    echo "Error: Color system not found at $COLOR_SRC" >&2
    return 1
fi

# =============================================================================
# LAYER 2: Semantic colors (must load before themes)
# =============================================================================
source "$TDS_SRC/core/semantic_colors.sh"
source "$TDS_SRC/core/color_guide.sh"
source "$TDS_SRC/core/theme_validation.sh"
source "$TDS_SRC/core/theme_stack.sh"
source "$TDS_SRC/core/token_validation.sh"
source "$TDS_SRC/core/module_config.sh"
source "$TDS_SRC/core/pattern_registry.sh"

# =============================================================================
# LAYER 3: Theme system
# =============================================================================
source "$TDS_SRC/themes/theme_registry.sh"
source "$TDS_SRC/themes/default.sh"

# Register temperature themes (lazy-loaded)
tds_register_lazy_theme "warm" "tds_theme_warm" "Warm amber temperature"
tds_register_lazy_theme "cool" "tds_theme_cool" "Cool blue temperature"
tds_register_lazy_theme "arctic" "tds_theme_arctic" "Arctic blue structured"
tds_register_lazy_theme "neutral" "tds_theme_neutral" "Neutral green temperature"
tds_register_lazy_theme "electric" "tds_theme_electric" "Electric purple temperature"

# Load saved state and activate theme
tds_load_current
TDS_ACTIVE_THEME="${TDS_ACTIVE_THEME:-default}"
if ! TDS_QUIET_LOAD=1 tds_switch_theme "$TDS_ACTIVE_THEME" 2>/dev/null; then
    # Saved theme failed, fall back to default
    TDS_QUIET_LOAD=1 tds_switch_theme "default" 2>/dev/null || \
        echo "Warning: Failed to load any TDS theme" >&2
fi

# =============================================================================
# LAYER 4: Tokens
# =============================================================================
source "$TDS_SRC/tokens/color_tokens.sh"
source "$TDS_SRC/tokens/repl_tokens.sh"
source "$TDS_SRC/tokens/unicode_explorer_tokens.sh"

# =============================================================================
# LAYER 5: Layout utilities
# =============================================================================
source "$TDS_SRC/layout/borders.sh"
source "$TDS_SRC/layout/spacing.sh"

# =============================================================================
# LAYER 6: Components
# =============================================================================
source "$TDS_SRC/components/panels.sh"

# =============================================================================
# LAYER 7: Display semantics
# =============================================================================
source "$TDS_SRC/semantics/typography.sh"
source "$TDS_SRC/semantics/repl_ui.sh"

# =============================================================================
# LAYER 8: Content renderers
# =============================================================================
source "$TDS_SRC/renderers/markdown.sh"
source "$TDS_SRC/renderers/toml.sh"

# =============================================================================
# LAYER 9: MSC integration (optional)
# =============================================================================
MSC_SRC="${MSC_SRC:-$(dirname "$TDS_SRC")/msc}"
[[ -f "$MSC_SRC/includes.sh" ]] && source "$MSC_SRC/includes.sh"

# =============================================================================
# LAYER 10: REPL and completion
# =============================================================================
source "$TDS_SRC/tds_repl.sh"
source "$TDS_SRC/tds_complete.sh"

# =============================================================================
# LAYER 11: Command interface
# =============================================================================
source "$TDS_SRC/cmd/help.sh"
source "$TDS_SRC/cmd/theme.sh"
source "$TDS_SRC/cmd/palette.sh"
source "$TDS_SRC/cmd/token.sh"
source "$TDS_SRC/cmd/modules.sh"
source "$TDS_SRC/cmd/doctor.sh"

# =============================================================================
# MAIN COMMAND
# =============================================================================

tds() {
    local resource="${1:-}"
    shift 2>/dev/null || true

    case "$resource" in
        # Resources
        theme)    _tds_theme "$@" ;;
        palette)  _tds_palette "$@" ;;
        token)    _tds_token "$@" ;;
        pattern)  _tds_pattern "$@" ;;
        modules)  tds_modules "$@" ;;
        hex)      _tds_hex "$@" ;;

        # Tools
        doctor)        _tds_cmd_doctor ;;
        repl)          tds_repl ;;
        guide)         tds_color_guide ;;
        guide-compact) tds_color_guide_compact ;;

        # Help
        help|--help|-h|"")
            _tds_cmd_help
            ;;

        *)
            echo "Unknown: tds $resource"
            echo "Resources: theme, palette, token, pattern, modules, hex"
            echo "Tools: doctor, repl, guide"
            return 1
            ;;
    esac
}

# =============================================================================
# EXPORTS
# =============================================================================
export TDS_LOADED=true
export TDS_VERSION="1.1.0"
export -f tds

# Auto-export all tds* functions
while IFS= read -r func; do
    export -f "$func"
done < <(declare -F | awk '{print $3}' | grep -E '^tds_')
