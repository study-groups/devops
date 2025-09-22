#!/usr/bin/env bash

# TView REPL - Tetra View with Modal Navigation
# Modular version with separated concerns

# Source all modules
TVIEW_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$TVIEW_DIR/tview_data.sh"
source "$TVIEW_DIR/tview_render.sh"
source "$TVIEW_DIR/tview_modes.sh"
source "$TVIEW_DIR/tview_actions.sh"

# Also source the core navigation from existing tview_core.sh
source "$TVIEW_DIR/tview_core.sh"

# Main entry point - just calls the core function
tview_repl() {
    # All the heavy lifting is done in tview_core.sh
    # This keeps the main file clean and focused
    tview_repl_main "$@"
}

# Alias for backwards compatibility
alias tdash_repl=tview_repl

# Export main function
export -f tview_repl