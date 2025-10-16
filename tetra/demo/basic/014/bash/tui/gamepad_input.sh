#!/usr/bin/env bash

# Gamepad Input Module for Tetra TUI
# Reads keyboard events from named pipe written by Node.js gamepad handler

# Gamepad configuration
GAMEPAD_PIPE="${TETRA_GAMEPAD_PIPE:-/tmp/tetra-gamepad.fifo}"
GAMEPAD_FD=""
GAMEPAD_ENABLED=false

# Initialize gamepad input system
gamepad_init() {
    # Check if pipe exists
    if [[ ! -p "$GAMEPAD_PIPE" ]]; then
        echo "⚠️  Gamepad pipe not found: $GAMEPAD_PIPE" >&2
        echo "   Start gamepad handler: node ~/src/devops/tetra/server/gamepad-handler.js" >&2
        return 1
    fi

    # Open pipe for reading with file descriptor
    exec {GAMEPAD_FD}<>"$GAMEPAD_PIPE"

    if [[ -z "$GAMEPAD_FD" ]]; then
        echo "❌ Failed to open gamepad pipe" >&2
        return 1
    fi

    GAMEPAD_ENABLED=true
    echo "🎮 Gamepad input enabled (fd: $GAMEPAD_FD)" >&2
    return 0
}

# Check if gamepad input is available (non-blocking)
gamepad_has_input() {
    [[ "$GAMEPAD_ENABLED" != "true" ]] && return 1
    [[ -z "$GAMEPAD_FD" ]] && return 1

    # Use read with timeout to check for data
    read -t 0 -u "$GAMEPAD_FD" 2>/dev/null
    return $?
}

# Read a single character from gamepad pipe (non-blocking)
gamepad_read_char() {
    [[ "$GAMEPAD_ENABLED" != "true" ]] && return 1
    [[ -z "$GAMEPAD_FD" ]] && return 1

    local char=""

    # Read with zero timeout (non-blocking)
    if read -t 0 -u "$GAMEPAD_FD" -n 1 char 2>/dev/null; then
        echo -n "$char"
        return 0
    fi

    return 1
}

# Read full escape sequence from gamepad pipe
gamepad_read_sequence() {
    [[ "$GAMEPAD_ENABLED" != "true" ]] && return 1

    local first_char=""
    if ! read -t 0 -u "$GAMEPAD_FD" -n 1 first_char 2>/dev/null; then
        return 1
    fi

    # Check if it's an escape sequence
    if [[ "$first_char" == $'\x1b' ]]; then
        # Try to read next 2 characters for arrow keys
        local seq=""
        if read -t 0.01 -u "$GAMEPAD_FD" -n 2 seq 2>/dev/null; then
            echo -n "$first_char$seq"
            return 0
        fi
    fi

    # Single character
    echo -n "$first_char"
    return 0
}

# Get input from either keyboard or gamepad (multiplexed)
# Returns: key pressed (from stdin or gamepad pipe)
get_input_multiplexed() {
    local timeout="${1:-0.05}"
    local key=""

    # First check gamepad (non-blocking)
    if [[ "$GAMEPAD_ENABLED" == "true" ]]; then
        key=$(gamepad_read_sequence 2>/dev/null)
        if [[ -n "$key" ]]; then
            echo -n "$key"
            return 0
        fi
    fi

    # Then check keyboard with timeout
    if read -rsn1 -t "$timeout" key; then
        # Handle escape sequences from keyboard
        if [[ "$key" == $'\x1b' ]]; then
            local seq=""
            if read -rsn2 -t 0.01 seq 2>/dev/null; then
                echo -n "$key$seq"
                return 0
            fi
        fi
        echo -n "$key"
        return 0
    fi

    # No input from either source
    return 1
}

# Cleanup gamepad resources
gamepad_cleanup() {
    if [[ -n "$GAMEPAD_FD" ]]; then
        exec {GAMEPAD_FD}>&-
        GAMEPAD_FD=""
    fi
    GAMEPAD_ENABLED=false
}

# Enable gamepad input
gamepad_enable() {
    gamepad_init
}

# Disable gamepad input
gamepad_disable() {
    gamepad_cleanup
}

# Check if gamepad is enabled
gamepad_is_enabled() {
    [[ "$GAMEPAD_ENABLED" == "true" ]]
}

# Get gamepad status for display
gamepad_status() {
    if [[ "$GAMEPAD_ENABLED" == "true" ]]; then
        echo "🎮 enabled"
    else
        echo "⌨️  keyboard only"
    fi
}
