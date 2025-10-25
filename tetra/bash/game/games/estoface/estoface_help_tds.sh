#!/usr/bin/env bash
# estoface_help_tds.sh - TDS-bordered help display for estoface

# Source dependencies
source "$TETRA_SRC/bash/tree/core.sh"
source "$TETRA_SRC/bash/tree/help.sh"
source "$TETRA_SRC/bash/tds/layout/borders.sh"
source "$TETRA_SRC/bash/game/games/estoface/estoface_help.sh"

# Override max lines for tighter display
TREE_HELP_MAX_LINES=12

# Display help with TDS borders (no pagination, just output)
# Usage: estoface_help_tds [topic]
estoface_help_tds() {
    local topic="${1:-help.estoface}"
    local width="${COLUMNS:-80}"

    # Ensure topic starts with help.
    [[ "$topic" != help.* ]] && topic="help.estoface.$topic"

    # Get help content (no pagination, direct output)
    local content
    content=$(tree_help_show "$topic" --no-pagination 2>&1)

    # Top border
    tds_border_top "$width" "simple"

    # Content with side borders
    while IFS= read -r line; do
        # Strip ANSI for length calculation
        local visible_len
        visible_len=$(tds_strip_ansi "$line" | wc -c | tr -d ' ')
        visible_len=$((visible_len - 1))  # Remove newline

        # Calculate padding
        local padding=$((width - visible_len - 4))  # 4 = 2 borders + 2 spaces
        [[ $padding -lt 0 ]] && padding=0

        # Print line with borders
        printf "%s %s%*s %s\n" "$TDS_BOX_SIMPLE_V" "$line" "$padding" "" "$TDS_BOX_SIMPLE_V"
    done <<< "$content"

    # Bottom border
    tds_border_bottom "$width" "simple"
}

# Export function
export -f estoface_help_tds
