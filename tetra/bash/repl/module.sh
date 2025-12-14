#!/usr/bin/env bash
# REPL Module Helper
# Unified module initialization pattern for REPL-based apps

# Ensure TETRA_SRC is set
if [[ -z "$TETRA_SRC" ]]; then
    echo "Error: TETRA_SRC must be set" >&2
    return 1
fi

# Track if module system is loaded
declare -g REPL_MODULE_LOADED=1

# Source layout system
source "$TETRA_SRC/bash/repl/layout/regions.sh"
source "$TETRA_SRC/bash/repl/layout/presets.sh"
source "$TETRA_SRC/bash/repl/layout/items.sh"

# Default layout configuration
declare -gA REPL_DEFAULT_LAYOUT=(
    [preset]="standard"
    [cols]=3
    [item_width]=18
)

# Unified module initialization
# Usage: repl_module_init <name> <commands> <help_namespace> [layout_opts_name]
#
# Parameters:
#   name            - Module name (e.g., "formant", "midi")
#   commands        - Space-separated list of commands
#   help_namespace  - Nav tree namespace (e.g., "help.game.formant")
#   layout_opts_name - Name of associative array with layout options (optional)
#
# Layout options (associative array):
#   [preset]     - Layout preset name (standard, compact, split, fullscreen, panel, header)
#   [cols]       - Number of columns for items
#   [item_width] - Width of each item column
#
# Example:
#   declare -A MY_LAYOUT=([preset]="standard" [cols]=4 [item_width]=20)
#   repl_module_init "myapp" "cmd1 cmd2 cmd3" "help.myapp" MY_LAYOUT
#
repl_module_init() {
    local name="$1"
    local commands="$2"
    local help_namespace="$3"
    local layout_opts_name="${4:-REPL_DEFAULT_LAYOUT}"

    # Get layout options via nameref
    local -n layout_opts="$layout_opts_name"

    # 1. Load TDS with semantic colors
    if [[ -z "$TDS_LOADED" ]]; then
        if [[ -f "$TETRA_SRC/bash/tds/tds.sh" ]]; then
            source "$TETRA_SRC/bash/tds/tds.sh"
        fi
    fi

    # Apply semantic colors if TDS is loaded
    if command -v tds_apply_semantic_colors >/dev/null 2>&1; then
        tds_apply_semantic_colors
    fi

    # 2. Register module with REPL system
    if command -v repl_register_module >/dev/null 2>&1; then
        repl_register_module "$name" "$commands" "$help_namespace"
    fi

    if command -v repl_set_module_context >/dev/null 2>&1; then
        repl_set_module_context "$name"
    fi

    # 3. Register nav completion
    if command -v repl_register_nav_completion >/dev/null 2>&1; then
        repl_register_nav_completion "$help_namespace"
    fi

    # 4. Initialize layout system
    repl_layout_init

    # 5. Apply layout preset if specified
    local preset="${layout_opts[preset]:-standard}"
    if [[ -n "$preset" ]]; then
        repl_layout_apply_preset "$preset"
    fi

    # 6. Override layout constants if specified
    if [[ -n "${layout_opts[cols]:-}" ]]; then
        REPL_ITEMS_COLS="${layout_opts[cols]}"
        REPL_LAYOUT_COLS_PER_ROW="${layout_opts[cols]}"
    fi

    if [[ -n "${layout_opts[item_width]:-}" ]]; then
        REPL_ITEMS_WIDTH="${layout_opts[item_width]}"
        REPL_LAYOUT_ITEM_WIDTH="${layout_opts[item_width]}"
    fi

    # 7. Set item colors from TDS if available
    if [[ -v TDS_SEMANTIC_COLORS ]]; then
        # Selected item: use interactive.active color
        local active_color="${TDS_SEMANTIC_COLORS[interactive.active]:-}"
        if [[ -n "$active_color" ]]; then
            REPL_ITEMS_SELECTED_COLOR=$'\033[38;2;'"${active_color//[^0-9;]/}"'m'
        fi
    fi

    return 0
}

# Module cleanup
# Usage: repl_module_cleanup
repl_module_cleanup() {
    repl_layout_cleanup

    # Unset any module-specific callbacks
    unset -f repl_build_prompt 2>/dev/null || true
    unset -f repl_process_input 2>/dev/null || true
}

# Quick module setup with sensible defaults
# Usage: repl_module_quick <name> <help_namespace>
repl_module_quick() {
    local name="$1"
    local help_namespace="$2"

    repl_module_init "$name" "" "$help_namespace"
}

# Get module info
# Usage: repl_module_info
repl_module_info() {
    echo "=== REPL Module Info ==="
    echo "Layout System: $(command -v repl_layout_init >/dev/null && echo 'loaded' || echo 'not loaded')"
    echo "Nav Completion: $(command -v repl_register_nav_completion >/dev/null && echo 'loaded' || echo 'not loaded')"
    echo "TDS Colors: $(command -v tds_apply_semantic_colors >/dev/null && echo 'loaded' || echo 'not loaded')"
    echo ""
    echo "Current Settings:"
    echo "  Items Cols: $REPL_ITEMS_COLS"
    echo "  Items Width: $REPL_ITEMS_WIDTH"
    echo "  Layout Preset: ${REPL_LAYOUT_PRESET:-<none>}"
    echo ""
    if [[ "${REPL_LAYOUT_INITIALIZED:-0}" == "1" ]]; then
        echo "Defined Regions:"
        repl_region_list | sed 's/^/  /'
    fi
}

# Export functions
export -f repl_module_init
export -f repl_module_cleanup
export -f repl_module_quick
export -f repl_module_info
