#!/usr/bin/env bash
# REPL Library - Entry Point
# Universal REPL system for all Tetra modules

# Global check
if [[ -z "$TETRA_SRC" ]]; then
    echo "Error: TETRA_SRC must be set" >&2
    return 1
fi

# Library paths
REPL_SRC="${REPL_SRC:-$TETRA_SRC/bash/repl}"

# Source dependencies
source "$TETRA_SRC/bash/color/color.sh"
source "$TETRA_SRC/bash/tcurses/tcurses_input.sh"

# Source REPL components
source "$REPL_SRC/core/mode.sh"
source "$REPL_SRC/core/input.sh"
source "$REPL_SRC/core/loop.sh"
source "$REPL_SRC/prompt_manager.sh"
source "$REPL_SRC/symbol_parser.sh"
source "$REPL_SRC/command_processor.sh"
source "$REPL_SRC/adapters/symbol_ui.sh" 2>/dev/null || true

# REPL state
REPL_MODE=""                    # basic/enhanced/tui (auto-detected)
REPL_HISTORY_BASE=""            # Base history path set by module
REPL_HISTORY_FILE=""            # Active history file (switches with mode)
REPL_HISTORY_FILE_SHELL=""      # Shell mode history
REPL_HISTORY_FILE_REPL=""       # REPL mode history
REPL_OUTPUT_HANDLER=""          # For TUI mode
REPL_PROMPT_BUILDERS=()         # Registered prompt builders
REPL_SLASH_COMMANDS=()          # Registered slash commands
declare -A REPL_SLASH_HANDLERS  # command -> handler function

# Get current history file based on execution mode
repl_get_history_file() {
    if repl_is_takeover; then
        echo "$REPL_HISTORY_FILE_REPL"
    else
        echo "$REPL_HISTORY_FILE_SHELL"
    fi
}

# Terminal cleanup function
_repl_cleanup() {
    # Restore terminal to sane state
    stty sane 2>/dev/null
    stty echo 2>/dev/null
    tput cnorm 2>/dev/null || printf '\033[?25h'  # Show cursor
    echo ""  # Newline for clean exit
}

# Main entry point
repl_run() {
    local mode="${1:-$(repl_detect_mode)}"

    # Save original terminal settings
    local original_stty
    original_stty=$(stty -g 2>/dev/null)

    # Setup cleanup handlers for all exit scenarios
    # Note: INT (Ctrl-C) is handled inside the loop, not here
    trap '_repl_cleanup; trap - EXIT TERM; [[ -n "$original_stty" ]] && stty "$original_stty" 2>/dev/null' EXIT TERM HUP QUIT

    # Detect mode if not specified
    REPL_MODE="$mode"

    # Initialize history files
    if [[ -z "$REPL_HISTORY_BASE" ]]; then
        REPL_HISTORY_BASE="${TETRA_DIR}/repl/history"
    fi

    # Set mode-specific history files
    REPL_HISTORY_FILE_SHELL="${REPL_HISTORY_BASE}.shell"
    REPL_HISTORY_FILE_REPL="${REPL_HISTORY_BASE}.repl"

    # Set active history based on current execution mode
    REPL_HISTORY_FILE=$(repl_get_history_file)

    # Ensure directories exist
    mkdir -p "$(dirname "$REPL_HISTORY_FILE_SHELL")"
    touch "$REPL_HISTORY_FILE_SHELL"
    touch "$REPL_HISTORY_FILE_REPL"

    # Run main loop
    # NOTE: No subshell wrapper - associative arrays cannot be exported to subshells
    set -E  # Inherit ERR trap
    repl_main_loop || {
        # Emergency cleanup if main loop crashes
        _repl_cleanup
        [[ -n "$original_stty" ]] && stty "$original_stty" 2>/dev/null
        echo "REPL crashed - terminal restored" >&2
        return 1
    }

    # Normal cleanup
    trap - EXIT INT TERM HUP QUIT
    _repl_cleanup
    [[ -n "$original_stty" ]] && stty "$original_stty" 2>/dev/null
}

# Export functions
export -f repl_run
export -f repl_get_history_file
