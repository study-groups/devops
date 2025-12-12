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
source "$TETRA_SRC/bash/tcurses/tcurses_completion.sh"
source "$TETRA_SRC/bash/tcurses/tcurses_readline.sh"

# Source tree completion integration
source "$REPL_SRC/tree_completion.sh"

# Source REPL metadata system
source "$REPL_SRC/repl_metadata.sh"

# Source REPL components
source "$REPL_SRC/core/mode.sh"
source "$REPL_SRC/core/input.sh"
source "$REPL_SRC/core/loop.sh"
source "$REPL_SRC/prompt_manager.sh"
source "$REPL_SRC/symbol_parser.sh"
source "$REPL_SRC/command_processor.sh"
source "$REPL_SRC/adapters/symbol_ui.sh" 2>/dev/null || true

# Smart hints removed - native tab completion is handled by tcurses_readline

# REPL state
REPL_MODE=""                    # simple/readline (auto-detected)
REPL_HISTORY_BASE=""            # Base history path set by module
REPL_HISTORY_FILE=""            # History file (single file for hybrid mode)
REPL_PROMPT_BUILDERS=()         # Registered prompt builders
REPL_SLASH_COMMANDS=()          # Registered slash commands
declare -gA REPL_SLASH_HANDLERS  # command -> handler function

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

    # Initialize history file (single file for hybrid mode)
    if [[ -z "$REPL_HISTORY_BASE" ]]; then
        REPL_HISTORY_BASE="${TETRA_DIR}/repl/history"
    fi

    # Single history file for hybrid execution mode
    REPL_HISTORY_FILE="${REPL_HISTORY_BASE}.history"

    # Ensure directory exists
    mkdir -p "$(dirname "$REPL_HISTORY_FILE")"
    touch "$REPL_HISTORY_FILE"

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
