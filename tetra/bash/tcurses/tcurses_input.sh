#!/usr/bin/env bash

# TCurses Input Module
# Handles keyboard input, escape sequences, and special keys

# Include guard
[[ -n "${_TCURSES_INPUT_LOADED:-}" ]] && return
declare -g _TCURSES_INPUT_LOADED=1

# Initialize input system
tcurses_input_init() {
    # Nothing to initialize for now
    return 0
}

# Cleanup input system
tcurses_input_cleanup() {
    # Nothing to cleanup for now
    return 0
}

# Key Constants
declare -g TCURSES_KEY_UP=$'\x1b[A'
declare -g TCURSES_KEY_DOWN=$'\x1b[B'
declare -g TCURSES_KEY_RIGHT=$'\x1b[C'
declare -g TCURSES_KEY_LEFT=$'\x1b[D'
declare -g TCURSES_KEY_ESC=$'\x1b'
declare -g TCURSES_KEY_ENTER=$'\n'
declare -g TCURSES_KEY_CTRL_C=$'\x03'
declare -g TCURSES_KEY_CTRL_D=$'\x04'
declare -g TCURSES_KEY_CTRL_Z=$'\x1a'
declare -g TCURSES_KEY_BACKSPACE=$'\x7f'
declare -g TCURSES_KEY_TAB=$'\t'
declare -g TCURSES_KEY_SHIFT_TAB=$'\x1b[Z'
declare -g TCURSES_KEY_SPACE=' '

# Read a single key from stdin with timeout
# Usage: tcurses_input_read_key [timeout_seconds]
# Returns: 0 if key read, 1 if timeout/error
# Output: The key character(s) read
tcurses_input_read_key() {
    local timeout="${1:-0.05}"
    local key=""

    # Read single character with timeout from /dev/tty
    if IFS= read -rsn1 -t "$timeout" key </dev/tty 2>/dev/null; then
        # Check if it's an escape sequence
        if [[ "$key" == $'\x1b' ]]; then
            # Try to read the next 2 characters for arrow keys, etc.
            local seq=""
            if read -rsn2 -t 0.01 seq </dev/tty 2>/dev/null; then
                echo -n "$key$seq"
                return 0
            fi
            # Just ESC alone
            echo -n "$key"
            return 0
        fi
        # Regular character (including space and potentially empty for Enter)
        echo -n "$key"
        return 0
    fi

    # Timeout or error
    return 1
}

# Read a key with blocking (no timeout)
# Usage: tcurses_input_read_key_blocking
# Output: The key character(s) read
tcurses_input_read_key_blocking() {
    local key=""

    # Blocking read from /dev/tty
    if IFS= read -rsn1 key </dev/tty 2>/dev/null; then
        # Check if it's an escape sequence
        if [[ "$key" == $'\x1b' ]]; then
            local seq=""
            if read -rsn2 -t 0.01 seq </dev/tty 2>/dev/null; then
                echo -n "$key$seq"
                return 0
            fi
            echo -n "$key"
            return 0
        fi
        echo -n "$key"
        return 0
    fi

    return 1
}

# Read a line of text (for REPL-style input)
# Usage: tcurses_input_read_line [prompt] [history_file]
# Output: The line read
#
# History behavior:
# - If history_file provided: Use that path (persistent)
# - If not provided: Use /tmp/tcurses/repl/<pid>/history (ephemeral, per-instance)
#
# Uses read -e for basic line editing (Emacs-style keybindings).
# For full readline features, wrap entire program with rlwrap.
tcurses_input_read_line() {
    local prompt="${1:-}"
    local history_file="${2:-}"
    local line=""

    # Auto-manage ephemeral history if not provided
    if [[ -z "$history_file" ]]; then
        local tcurses_tmp="/tmp/tcurses/repl/$$"
        mkdir -p "$tcurses_tmp"
        history_file="$tcurses_tmp/history"
    fi

    # Ensure history file directory exists
    local history_dir=$(dirname "$history_file")
    mkdir -p "$history_dir" 2>/dev/null || true
    touch "$history_file" 2>/dev/null

    # Load history from file into bash's history buffer
    # This enables up/down arrow navigation
    if [[ -f "$history_file" ]]; then
        history -c  # Clear current history buffer
        history -r "$history_file"  # Read from file
    fi

    # Save original terminal state for safe restoration
    local saved_stty
    saved_stty=$(stty -g 2>/dev/null)

    # Setup trap to ensure terminal is restored even if interrupted
    trap 'stty echo icanon 2>/dev/null; tput cnorm 2>/dev/null || printf "\033[?25h" >&2; [[ -n "$saved_stty" ]] && stty "$saved_stty" 2>/dev/null' RETURN INT TERM

    # Temporarily enable echo and canonical mode
    stty echo icanon </dev/tty 2>/dev/null

    # Show cursor
    tput cnorm 2>/dev/null >&2 || printf '\033[?25h' >&2

    # Read line with editing support
    if [[ -n "$prompt" ]]; then
        read -r -e -p "$prompt" line </dev/tty
    else
        read -r -e line </dev/tty
    fi
    local read_status=$?

    # Save to history file and bash history buffer
    if [[ -n "$line" && -n "$history_file" ]]; then
        echo "$line" >> "$history_file"
        history -s "$line"  # Add to history buffer for immediate access
    fi

    # Restore raw mode
    stty -echo -icanon </dev/tty 2>/dev/null

    # Hide cursor
    tput civis 2>/dev/null >&2 || printf '\033[?25l' >&2

    # Clear trap - normal completion
    trap - RETURN INT TERM

    echo "$line"
    return $read_status
}

# Helper: Wrap a tcurses program with rlwrap for enhanced editing
# Usage: tcurses_input_with_rlwrap SCRIPT_PATH [ARGS...]
#
# This is the recommended way to add readline features to tcurses programs.
# Instead of running: ./my_tcurses_app.sh
# Run: tcurses_input_with_rlwrap ./my_tcurses_app.sh
tcurses_input_with_rlwrap() {
    local script="$1"
    shift
    local args=("$@")

    if [[ "$TCURSES_HAS_RLWRAP" == "true" ]]; then
        exec rlwrap -a -N -c "$script" "${args[@]}"
    else
        # Fall back to direct execution
        echo "Note: rlwrap not available, running without enhanced editing" >&2
        exec "$script" "${args[@]}"
    fi
}

# Check if a key is an arrow key
# Usage: tcurses_input_is_arrow_key KEY
tcurses_input_is_arrow_key() {
    local key="$1"
    case "$key" in
        "$TCURSES_KEY_UP"|"$TCURSES_KEY_DOWN"|"$TCURSES_KEY_LEFT"|"$TCURSES_KEY_RIGHT")
            return 0
            ;;
    esac
    return 1
}

# Check if a key is a control key
# Usage: tcurses_input_is_control_key KEY
tcurses_input_is_control_key() {
    local key="$1"
    case "$key" in
        "$TCURSES_KEY_CTRL_C"|"$TCURSES_KEY_CTRL_D"|"$TCURSES_KEY_CTRL_Z")
            return 0
            ;;
    esac
    return 1
}

# Get a human-readable name for a key
# Usage: tcurses_input_key_name KEY
tcurses_input_key_name() {
    local key="$1"
    case "$key" in
        "$TCURSES_KEY_UP") echo "Up" ;;
        "$TCURSES_KEY_DOWN") echo "Down" ;;
        "$TCURSES_KEY_LEFT") echo "Left" ;;
        "$TCURSES_KEY_RIGHT") echo "Right" ;;
        "$TCURSES_KEY_ESC") echo "Esc" ;;
        "$TCURSES_KEY_ENTER") echo "Enter" ;;
        "$TCURSES_KEY_CTRL_C") echo "Ctrl-C" ;;
        "$TCURSES_KEY_CTRL_D") echo "Ctrl-D" ;;
        "$TCURSES_KEY_CTRL_Z") echo "Ctrl-Z" ;;
        "$TCURSES_KEY_BACKSPACE") echo "Backspace" ;;
        "$TCURSES_KEY_TAB") echo "Tab" ;;
        '') echo "(none)" ;;
        *)
            # Print as character or hex
            if [[ ${#key} -eq 1 ]]; then
                echo "'$key'"
            else
                echo "$(echo -n "$key" | od -An -tx1 | tr -d ' ')"
            fi
            ;;
    esac
}

# Advanced: Multiplexed input from keyboard and optional pipe
# This is for integrating gamepad or other input sources
# Usage: tcurses_input_read_multiplexed TIMEOUT [PIPE_FD]
tcurses_input_read_multiplexed() {
    local timeout="${1:-0.05}"
    local pipe_fd="${2:-}"
    local key=""

    # First check pipe (if provided)
    if [[ -n "$pipe_fd" ]]; then
        if read -t 0 -u "$pipe_fd" -n 1 key 2>/dev/null; then
            # Got character from pipe - check for escape sequence
            if [[ "$key" == $'\x1b' ]]; then
                local seq=""
                if read -t 0.01 -u "$pipe_fd" -n 2 seq 2>/dev/null; then
                    echo -n "$key$seq"
                    return 0
                fi
            fi
            echo -n "$key"
            return 0
        fi
    fi

    # Fall back to keyboard
    tcurses_input_read_key "$timeout"
}

# Debug: Show key codes for testing
# Usage: tcurses_input_debug_keys
# Press 'q' to quit
tcurses_input_debug_keys() {
    echo "TCurses Key Debugger - Press keys to see codes (q to quit)"
    echo ""

    while true; do
        local key=$(tcurses_input_read_key_blocking)
        local name=$(tcurses_input_key_name "$key")
        local hex=$(echo -n "$key" | od -An -tx1 | tr -d ' ')

        printf "Key: %-15s  Hex: %-10s  Raw: '%s'\n" "$name" "$hex" "$key"

        [[ "$key" == "q" || "$key" == "Q" ]] && break
    done

    echo ""
    echo "Debug session ended."
}

# Export key constants for use in applications
export TCURSES_KEY_UP TCURSES_KEY_DOWN TCURSES_KEY_RIGHT TCURSES_KEY_LEFT
export TCURSES_KEY_ESC TCURSES_KEY_ENTER TCURSES_KEY_CTRL_C TCURSES_KEY_CTRL_D
export TCURSES_KEY_CTRL_Z TCURSES_KEY_BACKSPACE TCURSES_KEY_TAB
