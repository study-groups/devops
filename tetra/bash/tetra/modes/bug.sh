#!/usr/bin/env bash
# Bug Mode - Unicode Playground Easter Egg
# Embeds unicode_explorer_v2.sh for interactive glyph exploration

# Source the unicode explorer
UNICODE_EXPLORER_SRC="$TETRA_SRC/bash/repl/experiments/unicode_explorer_v2.sh"

# Launch bug mode (unicode explorer)
tetra_bug_mode() {
    if [[ -f "$UNICODE_EXPLORER_SRC" ]]; then
        # Source and run unicode explorer
        source "$UNICODE_EXPLORER_SRC"
        unicode_explorer_repl
    else
        echo "⁘ Bug Mode - Unicode Explorer not found"
        echo
        echo "Expected location: $UNICODE_EXPLORER_SRC"
        echo
        echo "Press any key to return to Tetra TUI..."
        read -rsn1
    fi
}

# Export function
export -f tetra_bug_mode
