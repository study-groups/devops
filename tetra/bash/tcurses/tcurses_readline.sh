#!/usr/bin/env bash
# TCurses Native Readline
# Character-by-character input loop with TAB completion support
# Integrates with tcurses_completion.sh

# Source dependencies
TCURSES_DIR="${TCURSES_DIR:-${TETRA_SRC:-/Users/mricos/src/devops/tetra}/bash/tcurses}"
source "$TCURSES_DIR/tcurses_input.sh" 2>/dev/null || true
source "$TCURSES_DIR/tcurses_completion.sh" 2>/dev/null || true

# Readline state (used by completion system)
declare -g REPL_INPUT=""
declare -g REPL_CURSOR_POS=0

# History management
declare -g REPL_HISTORY=()
declare -g REPL_HISTORY_INDEX=0
declare -g REPL_HISTORY_SAVED=""

# Terminal state
declare -g TCURSES_READLINE_PROMPT="> "

# Initialize readline
tcurses_readline_init() {
    REPL_INPUT=""
    REPL_CURSOR_POS=0
    REPL_HISTORY_SAVED=""
    return 0
}

# Load history from file
tcurses_readline_load_history() {
    local history_file="$1"
    REPL_HISTORY=()

    if [[ -f "$history_file" ]]; then
        mapfile -t REPL_HISTORY < "$history_file"
    fi

    REPL_HISTORY_INDEX=${#REPL_HISTORY[@]}
}

# Save line to history
tcurses_readline_save_to_history() {
    local line="$1"
    local history_file="$2"

    # Don't save empty lines
    [[ -z "$line" ]] && return

    # Add to in-memory history
    REPL_HISTORY+=("$line")
    REPL_HISTORY_INDEX=${#REPL_HISTORY[@]}

    # Save to file if provided
    if [[ -n "$history_file" ]]; then
        echo "$line" >> "$history_file"
    fi
}

# Strip ANSI escape codes for length calculation
_tcurses_readline_strip_ansi() {
    local text="$1"
    local result="$text"

    # Remove common ANSI sequences using bash parameter expansion
    # This is faster than spawning sed on every keystroke

    # Remove CSI sequences (\x1b[...m, \x1b[...G, etc.)
    while [[ "$result" =~ $'\x1b'\[([0-9;]*[mGKHJh]) ]]; do
        result="${result//$BASH_REMATCH/}"
    done

    # Remove other escape sequences
    while [[ "$result" =~ $'\x1b'[^$'\x1b']+ ]]; do
        result="${result//$BASH_REMATCH/}"
    done

    echo "$result"
}

# Redraw the input line
tcurses_readline_redraw() {
    local prompt="$1"

    # Move cursor to beginning of line
    printf '\r' >&2

    # Clear to end of line
    printf '\033[K' >&2

    # Draw prompt and input
    printf '%s%s' "$prompt" "$REPL_INPUT" >&2

    # Calculate prompt length without ANSI codes
    local prompt_stripped
    prompt_stripped=$(_tcurses_readline_strip_ansi "$prompt")
    local prompt_len=${#prompt_stripped}
    local target_col=$((prompt_len + REPL_CURSOR_POS))

    # Move cursor to correct position
    printf '\r' >&2
    if [[ $target_col -gt 0 ]]; then
        printf '\033[%dC' "$target_col" >&2
    fi
}

# Insert character at cursor
tcurses_readline_insert_char() {
    local char="$1"

    # Reset completion state on any non-TAB key
    if command -v repl_reset_completion >/dev/null 2>&1; then
        repl_reset_completion
    fi

    # Insert character
    REPL_INPUT="${REPL_INPUT:0:$REPL_CURSOR_POS}${char}${REPL_INPUT:$REPL_CURSOR_POS}"
    REPL_CURSOR_POS=$((REPL_CURSOR_POS + 1))
}

# Delete character at cursor (backspace)
tcurses_readline_backspace() {
    if [[ $REPL_CURSOR_POS -gt 0 ]]; then
        REPL_INPUT="${REPL_INPUT:0:$((REPL_CURSOR_POS-1))}${REPL_INPUT:$REPL_CURSOR_POS}"
        REPL_CURSOR_POS=$((REPL_CURSOR_POS - 1))

        # Reset completion
        if command -v repl_reset_completion >/dev/null 2>&1; then
            repl_reset_completion
        fi
    fi
}

# Delete character under cursor (delete key)
tcurses_readline_delete() {
    if [[ $REPL_CURSOR_POS -lt ${#REPL_INPUT} ]]; then
        REPL_INPUT="${REPL_INPUT:0:$REPL_CURSOR_POS}${REPL_INPUT:$((REPL_CURSOR_POS+1))}"

        # Reset completion
        if command -v repl_reset_completion >/dev/null 2>&1; then
            repl_reset_completion
        fi
    fi
}

# Move cursor left
tcurses_readline_cursor_left() {
    if [[ $REPL_CURSOR_POS -gt 0 ]]; then
        REPL_CURSOR_POS=$((REPL_CURSOR_POS - 1))

        # Reset completion
        if command -v repl_reset_completion >/dev/null 2>&1; then
            repl_reset_completion
        fi
    fi
}

# Move cursor right
tcurses_readline_cursor_right() {
    if [[ $REPL_CURSOR_POS -lt ${#REPL_INPUT} ]]; then
        REPL_CURSOR_POS=$((REPL_CURSOR_POS + 1))

        # Reset completion
        if command -v repl_reset_completion >/dev/null 2>&1; then
            repl_reset_completion
        fi
    fi
}

# Move to beginning of line (Ctrl-A)
tcurses_readline_home() {
    REPL_CURSOR_POS=0

    # Reset completion
    if command -v repl_reset_completion >/dev/null 2>&1; then
        repl_reset_completion
    fi
}

# Move to end of line (Ctrl-E)
tcurses_readline_end() {
    REPL_CURSOR_POS=${#REPL_INPUT}

    # Reset completion
    if command -v repl_reset_completion >/dev/null 2>&1; then
        repl_reset_completion
    fi
}

# Navigate history up
tcurses_readline_history_up() {
    if [[ $REPL_HISTORY_INDEX -gt 0 ]]; then
        # Save current line on first up
        if [[ $REPL_HISTORY_INDEX -eq ${#REPL_HISTORY[@]} ]]; then
            REPL_HISTORY_SAVED="$REPL_INPUT"
        fi

        REPL_HISTORY_INDEX=$((REPL_HISTORY_INDEX - 1))
        REPL_INPUT="${REPL_HISTORY[$REPL_HISTORY_INDEX]}"
        REPL_CURSOR_POS=${#REPL_INPUT}

        # Reset completion
        if command -v repl_reset_completion >/dev/null 2>&1; then
            repl_reset_completion
        fi
    fi
}

# Navigate history down
tcurses_readline_history_down() {
    if [[ $REPL_HISTORY_INDEX -lt ${#REPL_HISTORY[@]} ]]; then
        REPL_HISTORY_INDEX=$((REPL_HISTORY_INDEX + 1))

        if [[ $REPL_HISTORY_INDEX -eq ${#REPL_HISTORY[@]} ]]; then
            # Restore saved line
            REPL_INPUT="$REPL_HISTORY_SAVED"
        else
            REPL_INPUT="${REPL_HISTORY[$REPL_HISTORY_INDEX]}"
        fi

        REPL_CURSOR_POS=${#REPL_INPUT}

        # Reset completion
        if command -v repl_reset_completion >/dev/null 2>&1; then
            repl_reset_completion
        fi
    fi
}

# Clear line (Ctrl-U)
tcurses_readline_clear_line() {
    REPL_INPUT=""
    REPL_CURSOR_POS=0

    # Reset completion
    if command -v repl_reset_completion >/dev/null 2>&1; then
        repl_reset_completion
    fi
}

# Main readline function
# Usage: tcurses_readline [prompt] [history_file]
# Returns: The line entered by the user
tcurses_readline() {
    local prompt="${1:-$TCURSES_READLINE_PROMPT}"
    local history_file="${2:-}"

    # Initialize
    tcurses_readline_init

    # Load history
    if [[ -n "$history_file" ]]; then
        # Ensure directory exists
        mkdir -p "$(dirname "$history_file")" 2>/dev/null
        touch "$history_file" 2>/dev/null
        tcurses_readline_load_history "$history_file"
    fi

    # Save terminal state
    local saved_stty
    saved_stty=$(stty -g 2>/dev/null)

    # Setup trap for cleanup
    trap 'stty "$saved_stty" 2>/dev/null; tput cnorm 2>/dev/null || printf "\033[?25h" >&2' RETURN INT TERM

    # Set raw mode (disable line buffering and echo)
    stty -echo -icanon min 1 time 0 2>/dev/null

    # Show cursor
    tput cnorm 2>/dev/null >&2 || printf '\033[?25h' >&2

    # Initial draw
    tcurses_readline_redraw "$prompt"

    # Main input loop
    while true; do
        # Read a key
        local key
        key=$(tcurses_input_read_key_blocking)

        # DEBUG: Show what key was received
        if [[ "${TCURSES_READLINE_DEBUG:-0}" == "1" ]]; then
            local hex=$(echo -n "$key" | od -An -tx1 | tr -d ' ')
            echo "[DEBUG] key='$key' hex='$hex' len=${#key}" >&2
        fi

        # Handle Enter/Return key (multiple possible values)
        # Check for empty string first (some terminals send this for Enter)
        if [[ -z "$key" ]] || [[ "$key" == $'\n' ]] || [[ "$key" == $'\r' ]] || [[ "$key" == $'\x0d' ]] || [[ "$key" == $'\x0a' ]]; then
            # Done - newline and return
            printf '\n' >&2
            break
        fi

        case "$key" in

            "$TCURSES_KEY_CTRL_C")
                # Cancel - clear line and return empty
                REPL_INPUT=""
                printf '\n' >&2
                break
                ;;

            "$TCURSES_KEY_CTRL_D")
                # EOF - if line is empty, signal EOF
                if [[ -z "$REPL_INPUT" ]]; then
                    printf '\n' >&2
                    echo ""
                    return 1
                else
                    # Delete character under cursor
                    tcurses_readline_delete
                fi
                ;;

            "$TCURSES_KEY_TAB")
                # TAB completion
                if command -v repl_handle_tab >/dev/null 2>&1; then
                    repl_handle_tab
                fi
                ;;

            "$TCURSES_KEY_SHIFT_TAB")
                # Shift-TAB
                if command -v repl_handle_shift_tab >/dev/null 2>&1; then
                    repl_handle_shift_tab
                fi
                ;;

            "$TCURSES_KEY_ESC")
                # ESC key
                if command -v repl_handle_esc >/dev/null 2>&1; then
                    repl_handle_esc
                fi
                ;;

            "$TCURSES_KEY_BACKSPACE")
                tcurses_readline_backspace
                ;;

            "$TCURSES_KEY_UP")
                tcurses_readline_history_up
                ;;

            "$TCURSES_KEY_DOWN")
                tcurses_readline_history_down
                ;;

            "$TCURSES_KEY_LEFT")
                tcurses_readline_cursor_left
                ;;

            "$TCURSES_KEY_RIGHT")
                tcurses_readline_cursor_right
                ;;

            $'\x01')  # Ctrl-A
                tcurses_readline_home
                ;;

            $'\x05')  # Ctrl-E
                tcurses_readline_end
                ;;

            $'\x15')  # Ctrl-U
                tcurses_readline_clear_line
                ;;

            $'\x1b[3~')  # Delete key
                tcurses_readline_delete
                ;;

            $'\x1b[H')  # Home key
                tcurses_readline_home
                ;;

            $'\x1b[F')  # End key
                tcurses_readline_end
                ;;

            "$TCURSES_KEY_SPACE")
                # Space key - check for handler override
                if command -v repl_handle_space >/dev/null 2>&1; then
                    repl_handle_space
                else
                    # Default: insert space character
                    tcurses_readline_insert_char "$key"
                fi
                ;;

            *)
                # Regular character - insert it
                if [[ -n "$key" ]]; then
                    tcurses_readline_insert_char "$key"
                fi
                ;;
        esac

        # Redraw line (use global prompt if it changed, otherwise use local)
        local current_prompt="${TCURSES_READLINE_PROMPT:-$prompt}"
        tcurses_readline_redraw "$current_prompt"
    done

    # Save to history
    if [[ -n "$REPL_INPUT" && -n "$history_file" ]]; then
        tcurses_readline_save_to_history "$REPL_INPUT" "$history_file"
    fi

    # Restore terminal
    stty "$saved_stty" 2>/dev/null

    # Clear trap
    trap - RETURN INT TERM

    # Return the line
    echo "$REPL_INPUT"
    return 0
}

# Export functions
export -f tcurses_readline_init
export -f tcurses_readline_load_history
export -f tcurses_readline_save_to_history
export -f _tcurses_readline_strip_ansi
export -f tcurses_readline_redraw
export -f tcurses_readline_insert_char
export -f tcurses_readline_backspace
export -f tcurses_readline_delete
export -f tcurses_readline_cursor_left
export -f tcurses_readline_cursor_right
export -f tcurses_readline_home
export -f tcurses_readline_end
export -f tcurses_readline_history_up
export -f tcurses_readline_history_down
export -f tcurses_readline_clear_line
export -f tcurses_readline
