#!/usr/bin/env bash
# Tetra TUI - Layout & Dimensions
# Terminal size calculation and region management

# Terminal dimensions (with defaults)
declare -g TUI_HEIGHT=24
declare -g TUI_WIDTH=80

# Dynamic split position (row where separator lives, 0 = auto)
declare -g TUI_SPLIT_ROW=0

# Region sizes (calculated dynamically)
declare -g HEADER_LINES=0
declare -g SEPARATOR_LINES=1
declare -g FOOTER_LINES=1
declare -g CONTENT_AREA_HEIGHT=0
declare -g CLI_AREA_HEIGHT=0
declare -g CONTENT_VIEWPORT_HEIGHT=0

# Layout calculation
calculate_layout() {
    # Get current terminal size
    local h w
    if [[ -e /dev/tty ]]; then
        read h w < <(stty size </dev/tty 2>/dev/null) || true
    fi
    TUI_HEIGHT="${h:-$(tput lines 2>/dev/null || echo 24)}"
    TUI_WIDTH="${w:-$(tput cols 2>/dev/null || echo 80)}"

    # Ensure valid integers
    [[ ! "$TUI_HEIGHT" =~ ^[0-9]+$ ]] && TUI_HEIGHT=24
    [[ ! "$TUI_WIDTH" =~ ^[0-9]+$ ]] && TUI_WIDTH=80

    # If split row not set (0) or invalid, default to row 5
    if [[ "$TUI_SPLIT_ROW" -le 0 || "$TUI_SPLIT_ROW" -ge "$TUI_HEIGHT" ]]; then
        TUI_SPLIT_ROW=5
    fi

    # Clamp split row to valid range (min 2, max HEIGHT-4)
    [[ $TUI_SPLIT_ROW -lt 2 ]] && TUI_SPLIT_ROW=2
    [[ $TUI_SPLIT_ROW -gt $((TUI_HEIGHT - 4)) ]] && TUI_SPLIT_ROW=$((TUI_HEIGHT - 4))

    # Calculate areas based on split position
    CONTENT_AREA_HEIGHT=$((TUI_SPLIT_ROW))
    CLI_AREA_HEIGHT=$((TUI_HEIGHT - TUI_SPLIT_ROW - FOOTER_LINES - 1))

    # Legacy compatibility
    CONTENT_VIEWPORT_HEIGHT=$CONTENT_AREA_HEIGHT

    # Update buffer regions
    tui_region_update 2>/dev/null || true
}

# Set split row from CC value (0-127 → row 3 to HEIGHT-3)
set_split_from_cc() {
    local cc_val="$1"
    local min_row=3
    local max_row=$((TUI_HEIGHT - 3))

    # Map 0-127 to row range
    TUI_SPLIT_ROW=$(( min_row + (cc_val * (max_row - min_row) / 127) ))
    calculate_layout
}

# Resize handler
handle_resize() {
    TUI_SPLIT_ROW=0  # Reset to auto on resize
    calculate_layout
    needs_redraw=true
    is_first_render=true
}
