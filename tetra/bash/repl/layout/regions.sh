#!/usr/bin/env bash
# REPL Layout System - Region Management
# Provides declarative region-based layout with cell-level precision

# Ensure TETRA_SRC is set
if [[ -z "$TETRA_SRC" ]]; then
    echo "Error: TETRA_SRC must be set" >&2
    return 1
fi

# Region definitions
declare -gA REPL_REGIONS=()           # name -> "row:col:height:width"
declare -gA REPL_REGION_CALLBACKS=()  # name -> render_function
declare -g  REPL_LAYOUT_INITIALIZED=0
declare -g  REPL_LAYOUT_PRESET=""     # current preset name

# Terminal dimensions (updated on resize)
declare -g REPL_TERM_HEIGHT=24
declare -g REPL_TERM_WIDTH=80

# Layout constants (overridable per-module)
declare -g REPL_LAYOUT_COLS_PER_ROW=3
declare -g REPL_LAYOUT_ITEM_WIDTH=18

# Initialize layout system with resize handler
repl_layout_init() {
    repl_layout_update_dimensions
    trap 'repl_layout_on_resize' WINCH
    REPL_LAYOUT_INITIALIZED=1
}

# Update terminal dimensions
repl_layout_update_dimensions() {
    if command -v stty >/dev/null 2>&1; then
        read -r REPL_TERM_HEIGHT REPL_TERM_WIDTH < <(stty size 2>/dev/null || echo "24 80")
    else
        REPL_TERM_HEIGHT=24
        REPL_TERM_WIDTH=80
    fi
}

# Handle resize signal (SIGWINCH)
repl_layout_on_resize() {
    repl_layout_update_dimensions

    # Re-apply current preset with new dimensions
    if [[ -n "$REPL_LAYOUT_PRESET" ]]; then
        local preset_fn="repl_layout_preset_${REPL_LAYOUT_PRESET}"
        if command -v "$preset_fn" >/dev/null 2>&1; then
            "$preset_fn" "$REPL_TERM_HEIGHT" "$REPL_TERM_WIDTH"
        fi
    fi

    # Re-render all regions
    repl_layout_render
}

# Define a region (row-based structure with cell-level precision)
# Usage: repl_region_define <name> <row> <col> <height> <width>
repl_region_define() {
    local name="$1" row="$2" col="$3" height="$4" width="$5"

    if [[ -z "$name" || -z "$row" || -z "$col" || -z "$height" || -z "$width" ]]; then
        echo "Error: repl_region_define requires name, row, col, height, width" >&2
        return 1
    fi

    REPL_REGIONS[$name]="$row:$col:$height:$width"
}

# Set callback for region rendering
# Callback signature: callback(name, row, col, height, width)
# Usage: repl_region_set_callback <name> <callback_function>
repl_region_set_callback() {
    local name="$1" callback="$2"

    if [[ -z "$name" || -z "$callback" ]]; then
        echo "Error: repl_region_set_callback requires name and callback" >&2
        return 1
    fi

    if ! command -v "$callback" >/dev/null 2>&1; then
        echo "Warning: callback '$callback' not found (may be defined later)" >&2
    fi

    REPL_REGION_CALLBACKS[$name]="$callback"
}

# Get region bounds
# Usage: repl_region_get <name> [field]
# Returns: "row col height width" or specific field value
repl_region_get() {
    local name="$1"
    local field="${2:-}"

    local spec="${REPL_REGIONS[$name]}"
    if [[ -z "$spec" ]]; then
        echo "Error: region '$name' not defined" >&2
        return 1
    fi

    local row col height width
    IFS=: read -r row col height width <<< "$spec"

    case "$field" in
        row)    echo "$row" ;;
        col)    echo "$col" ;;
        height) echo "$height" ;;
        width)  echo "$width" ;;
        *)      echo "$row $col $height $width" ;;
    esac
}

# Check if region exists
# Usage: repl_region_exists <name>
repl_region_exists() {
    local name="$1"
    [[ -n "${REPL_REGIONS[$name]+x}" ]]
}

# Position cursor at absolute row:col within region
# Usage: repl_region_goto <name> [local_row] [local_col]
repl_region_goto() {
    local name="$1" local_row="${2:-0}" local_col="${3:-0}"

    local spec="${REPL_REGIONS[$name]}"
    if [[ -z "$spec" ]]; then
        echo "Error: region '$name' not defined" >&2
        return 1
    fi

    local base_row base_col height width
    IFS=: read -r base_row base_col height width <<< "$spec"

    # Use tput for cursor positioning (1-based)
    tput cup $((base_row + local_row)) $((base_col + local_col))
}

# Cell-level write: precise text placement within region
# Usage: repl_cell_write <name> <row> <col> <text>
repl_cell_write() {
    local name="$1" row="$2" col="$3" text="$4"

    repl_region_goto "$name" "$row" "$col"
    printf '%s' "$text"
}

# Write text at start of region row
# Usage: repl_region_write <name> <row> <text>
repl_region_write() {
    local name="$1" row="$2" text="$3"

    repl_cell_write "$name" "$row" 0 "$text"
}

# Write text right-aligned within region
# Usage: repl_region_write_right <name> <row> <text>
repl_region_write_right() {
    local name="$1" row="$2" text="$3"

    local width
    width=$(repl_region_get "$name" width)

    # Strip ANSI codes to get visible length
    local visible_text="${text//$'\033'[[0-9;]*m/}"
    local text_len="${#visible_text}"
    local col=$((width - text_len))
    [[ $col -lt 0 ]] && col=0

    repl_cell_write "$name" "$row" "$col" "$text"
}

# Clear entire region
# Usage: repl_region_clear <name>
repl_region_clear() {
    local name="$1"

    local spec="${REPL_REGIONS[$name]}"
    if [[ -z "$spec" ]]; then
        echo "Error: region '$name' not defined" >&2
        return 1
    fi

    local base_row base_col height width
    IFS=: read -r base_row base_col height width <<< "$spec"

    # Create blank line of appropriate width
    local blank
    printf -v blank '%*s' "$width" ''

    # Clear each row in region
    for ((r=0; r<height; r++)); do
        tput cup $((base_row + r)) "$base_col"
        printf '%s' "$blank"
    done
}

# Clear a single row within region
# Usage: repl_region_clear_row <name> <row>
repl_region_clear_row() {
    local name="$1" row="$2"

    local width
    width=$(repl_region_get "$name" width)

    local blank
    printf -v blank '%*s' "$width" ''

    repl_cell_write "$name" "$row" 0 "$blank"
}

# Render all regions (calls callbacks with parameters)
# Usage: repl_layout_render
repl_layout_render() {
    for name in "${!REPL_REGION_CALLBACKS[@]}"; do
        local callback="${REPL_REGION_CALLBACKS[$name]}"

        if ! command -v "$callback" >/dev/null 2>&1; then
            continue
        fi

        local spec="${REPL_REGIONS[$name]}"
        if [[ -z "$spec" ]]; then
            continue
        fi

        local row col height width
        IFS=: read -r row col height width <<< "$spec"

        # Call callback with parameters: name, row, col, height, width
        "$callback" "$name" "$row" "$col" "$height" "$width"
    done
}

# Render a specific region
# Usage: repl_region_render <name>
repl_region_render() {
    local name="$1"
    local callback="${REPL_REGION_CALLBACKS[$name]}"

    if [[ -z "$callback" ]] || ! command -v "$callback" >/dev/null 2>&1; then
        return 1
    fi

    local spec="${REPL_REGIONS[$name]}"
    if [[ -z "$spec" ]]; then
        return 1
    fi

    local row col height width
    IFS=: read -r row col height width <<< "$spec"

    "$callback" "$name" "$row" "$col" "$height" "$width"
}

# Remove a region
# Usage: repl_region_remove <name>
repl_region_remove() {
    local name="$1"
    unset "REPL_REGIONS[$name]"
    unset "REPL_REGION_CALLBACKS[$name]"
}

# List all defined regions
# Usage: repl_region_list
repl_region_list() {
    for name in "${!REPL_REGIONS[@]}"; do
        local spec="${REPL_REGIONS[$name]}"
        local callback="${REPL_REGION_CALLBACKS[$name]:-<none>}"
        echo "$name: $spec (callback: $callback)"
    done
}

# Apply a layout preset
# Usage: repl_layout_apply_preset <preset_name>
repl_layout_apply_preset() {
    local preset="$1"
    local preset_fn="repl_layout_preset_${preset}"

    if ! command -v "$preset_fn" >/dev/null 2>&1; then
        echo "Error: preset '$preset' not found" >&2
        return 1
    fi

    # Store preset name for resize handling
    REPL_LAYOUT_PRESET="$preset"

    # Apply preset with current dimensions
    "$preset_fn" "$REPL_TERM_HEIGHT" "$REPL_TERM_WIDTH"
}

# Cleanup layout system
# Usage: repl_layout_cleanup
repl_layout_cleanup() {
    trap - WINCH
    REPL_LAYOUT_INITIALIZED=0
    REPL_LAYOUT_PRESET=""
    REPL_REGIONS=()
    REPL_REGION_CALLBACKS=()
}

# Debug: dump layout state
# Usage: repl_layout_debug
repl_layout_debug() {
    echo "=== REPL Layout Debug ==="
    echo "Initialized: $REPL_LAYOUT_INITIALIZED"
    echo "Preset: ${REPL_LAYOUT_PRESET:-<none>}"
    echo "Terminal: ${REPL_TERM_HEIGHT}x${REPL_TERM_WIDTH}"
    echo ""
    echo "Regions:"
    repl_region_list | sed 's/^/  /'
    echo ""
    echo "Layout Constants:"
    echo "  REPL_LAYOUT_COLS_PER_ROW=$REPL_LAYOUT_COLS_PER_ROW"
    echo "  REPL_LAYOUT_ITEM_WIDTH=$REPL_LAYOUT_ITEM_WIDTH"
}

# Export functions
export -f repl_layout_init
export -f repl_layout_update_dimensions
export -f repl_layout_on_resize
export -f repl_region_define
export -f repl_region_set_callback
export -f repl_region_get
export -f repl_region_exists
export -f repl_region_goto
export -f repl_cell_write
export -f repl_region_write
export -f repl_region_write_right
export -f repl_region_clear
export -f repl_region_clear_row
export -f repl_layout_render
export -f repl_region_render
export -f repl_region_remove
export -f repl_region_list
export -f repl_layout_apply_preset
export -f repl_layout_cleanup
export -f repl_layout_debug
