#!/usr/bin/env bash

# TCurses V2 - Clean rewrite with state machine

TCURSES_DIR="$(dirname "${BASH_SOURCE[0]}")"

# Source modules
source "$TCURSES_DIR/tcurses_screen.sh"
source "$TCURSES_DIR/tcurses_input_sm.sh"
source "$TCURSES_DIR/tcurses_buffer.sh"

# TCurses version
TCURSES_VERSION="2.0.0-sm"

# Initialize TCurses
tcurses_init() {
    # Check Bash version
    if [[ "${BASH_VERSINFO[0]}" -lt 5 ]] || { [[ "${BASH_VERSINFO[0]}" -eq 5 ]] && [[ "${BASH_VERSINFO[1]}" -lt 2 ]]; }; then
        echo "Error: TCurses requires Bash 5.2+ (found $BASH_VERSION)" >&2
        return 1
    fi

    # Initialize screen
    if ! tcurses_screen_init; then
        echo "tcurses: failed to initialize screen" >&2
        return 1
    fi

    # Initialize buffer system
    tcurses_buffer_init "$(tcurses_screen_height)" "$(tcurses_screen_width)"

    # Initialize input state machine
    input_sm_init

    return 0
}

# Cleanup TCurses
tcurses_cleanup() {
    tcurses_screen_cleanup
}

# Simple event loop with state machine
# Usage: tcurses_loop RENDER_CALLBACK INPUT_CALLBACK
#
# RENDER_CALLBACK: called as render_callback FIRST_RENDER
# INPUT_CALLBACK: called as input_callback KEY, returns 0 to continue, 1 to exit
tcurses_loop() {
    local render_callback="$1"
    local input_callback="$2"

    if [[ -z "$render_callback" || -z "$input_callback" ]]; then
        echo "tcurses_loop: missing callbacks" >&2
        return 1
    fi

    # Initial render
    "$render_callback" true

    # Main loop
    local loop_count=0
    while true; do
        ((loop_count++))

        # Read one complete input using state machine
        local key=""
        key=$(input_sm_read_input)

        # Sanity check
        if [[ -z "$key" ]]; then
            echo "tcurses_loop: WARNING: got empty input at iteration $loop_count" >&2
            continue
        fi

        # Call input handler
        if ! "$input_callback" "$key"; then
            # Handler returned non-zero, exit loop
            break
        fi

        # Re-render
        "$render_callback" false
    done
}

# REPL mode - line-based input with history
# Usage: tcurses_repl RENDER_CALLBACK LINE_CALLBACK [HISTORY_FILE]
#
# RENDER_CALLBACK: called as render_callback FIRST_RENDER
# LINE_CALLBACK: called as line_callback LINE, returns 0 to continue, 1 to exit
tcurses_repl() {
    local render_callback="$1"
    local line_callback="$2"
    local history_file="${3:-}"

    # Use default history location if not provided
    if [[ -z "$history_file" ]]; then
        local repl_tmp="/tmp/tcurses/repl/$$"
        mkdir -p "$repl_tmp"
        history_file="$repl_tmp/history"
    fi

    # Ensure history file directory exists
    local history_dir=$(dirname "$history_file")
    mkdir -p "$history_dir" 2>/dev/null || true

    # Initial render
    "$render_callback" true

    # REPL loop
    while true; do
        # Show cursor
        tput cnorm 2>/dev/null || printf '\033[?25h'

        # Temporarily restore canonical mode for line editing
        stty echo icanon </dev/tty 2>/dev/null

        # Read line with history
        local line=""
        read -r -e -p "> " line </dev/tty

        # Save to history
        if [[ -n "$line" ]]; then
            echo "$line" >> "$history_file"
        fi

        # Restore raw mode
        stty -echo -icanon </dev/tty 2>/dev/null

        # Hide cursor
        tput civis 2>/dev/null || printf '\033[?25l'

        # Call line handler
        if ! "$line_callback" "$line"; then
            break
        fi

        # Re-render
        "$render_callback" false
    done
}

# Get version
tcurses_version() {
    echo "TCurses v$TCURSES_VERSION (State Machine)"
}

# Setup cleanup trap
tcurses_setup_cleanup_trap() {
    trap 'tcurses_cleanup; exit' EXIT INT TERM
}

# Export main functions
export -f tcurses_init
export -f tcurses_cleanup
export -f tcurses_loop
export -f tcurses_repl
export -f tcurses_version
export -f tcurses_setup_cleanup_trap
