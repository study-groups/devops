#!/usr/bin/env bash
# REPL Layout System - Presets
# Pre-defined layout configurations for common use cases

# Ensure regions.sh is loaded
if ! command -v repl_region_define >/dev/null 2>&1; then
    source "${TETRA_SRC}/bash/repl/layout/regions.sh"
fi

# Standard layout preset
# Status at top, info below, items in middle, prompt at bottom
# Usage: repl_layout_preset_standard [term_height] [term_width]
repl_layout_preset_standard() {
    local term_height="${1:-$REPL_TERM_HEIGHT}"
    local term_width="${2:-$REPL_TERM_WIDTH}"

    # Row 0: status line (1 row)
    repl_region_define "status" 0 0 1 "$term_width"

    # Row 1-2: info area (2 rows)
    repl_region_define "info" 1 0 2 "$term_width"

    # Row 3 to height-2: items area
    local items_height=$((term_height - 5))
    [[ $items_height -lt 3 ]] && items_height=3
    repl_region_define "items" 3 0 "$items_height" "$term_width"

    # Last row: prompt
    repl_region_define "prompt" $((term_height - 2)) 0 1 "$term_width"
}

# Compact layout preset (for small terminals)
# Minimal header, more room for items
# Usage: repl_layout_preset_compact [term_height] [term_width]
repl_layout_preset_compact() {
    local term_height="${1:-$REPL_TERM_HEIGHT}"
    local term_width="${2:-$REPL_TERM_WIDTH}"

    # Row 0: status line (1 row)
    repl_region_define "status" 0 0 1 "$term_width"

    # Row 1 to height-2: items area (no info section)
    local items_height=$((term_height - 3))
    [[ $items_height -lt 3 ]] && items_height=3
    repl_region_define "items" 1 0 "$items_height" "$term_width"

    # Last row: prompt
    repl_region_define "prompt" $((term_height - 2)) 0 1 "$term_width"
}

# Split layout preset (status panel on right)
# Items on left 2/3, status/info on right 1/3
# Usage: repl_layout_preset_split [term_height] [term_width]
repl_layout_preset_split() {
    local term_height="${1:-$REPL_TERM_HEIGHT}"
    local term_width="${2:-$REPL_TERM_WIDTH}"

    local main_width=$((term_width * 2 / 3))
    local side_width=$((term_width - main_width - 1))  # -1 for separator

    # Left side: items (full height minus prompt)
    local items_height=$((term_height - 2))
    repl_region_define "items" 0 0 "$items_height" "$main_width"

    # Right side top: status (3 rows)
    repl_region_define "status" 0 $((main_width + 1)) 3 "$side_width"

    # Right side middle: info (remaining height)
    local info_height=$((term_height - 5))
    [[ $info_height -lt 1 ]] && info_height=1
    repl_region_define "info" 3 $((main_width + 1)) "$info_height" "$side_width"

    # Bottom: prompt (full width)
    repl_region_define "prompt" $((term_height - 2)) 0 1 "$term_width"
}

# Full screen layout preset
# Single items region covering entire screen except prompt
# Usage: repl_layout_preset_fullscreen [term_height] [term_width]
repl_layout_preset_fullscreen() {
    local term_height="${1:-$REPL_TERM_HEIGHT}"
    local term_width="${2:-$REPL_TERM_WIDTH}"

    # Full area for items
    local items_height=$((term_height - 2))
    repl_region_define "items" 0 0 "$items_height" "$term_width"

    # Last row: prompt
    repl_region_define "prompt" $((term_height - 2)) 0 1 "$term_width"
}

# Panel layout preset (inspired by MIDI status display)
# Log footer at bottom, scrolling content above
# Usage: repl_layout_preset_panel [term_height] [term_width]
repl_layout_preset_panel() {
    local term_height="${1:-$REPL_TERM_HEIGHT}"
    local term_width="${2:-$REPL_TERM_WIDTH}"

    # Top: status line
    repl_region_define "status" 0 0 1 "$term_width"

    # Middle: items area (scrolling content)
    local items_height=$((term_height - 7))
    [[ $items_height -lt 3 ]] && items_height=3
    repl_region_define "items" 1 0 "$items_height" "$term_width"

    # Bottom area: log/info footer (4 lines)
    local log_start=$((term_height - 6))
    repl_region_define "log" "$log_start" 0 4 "$term_width"

    # Last row: prompt
    repl_region_define "prompt" $((term_height - 2)) 0 1 "$term_width"
}

# Header-content layout
# Title bar, content area, status bar
# Usage: repl_layout_preset_header [term_height] [term_width]
repl_layout_preset_header() {
    local term_height="${1:-$REPL_TERM_HEIGHT}"
    local term_width="${2:-$REPL_TERM_WIDTH}"

    # Row 0: header/title bar
    repl_region_define "header" 0 0 1 "$term_width"

    # Middle: main content
    local content_height=$((term_height - 4))
    [[ $content_height -lt 3 ]] && content_height=3
    repl_region_define "items" 1 0 "$content_height" "$term_width"

    # Status bar above prompt
    repl_region_define "status" $((term_height - 3)) 0 1 "$term_width"

    # Last row: prompt
    repl_region_define "prompt" $((term_height - 2)) 0 1 "$term_width"
}

# Export functions
export -f repl_layout_preset_standard
export -f repl_layout_preset_compact
export -f repl_layout_preset_split
export -f repl_layout_preset_fullscreen
export -f repl_layout_preset_panel
export -f repl_layout_preset_header
