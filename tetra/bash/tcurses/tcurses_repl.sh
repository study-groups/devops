#!/usr/bin/env bash

# TCurses REPL Component
# Command input and response display above log footer

# Include guard
[[ -n "${_TCURSES_REPL_LOADED:-}" ]] && return
declare -g _TCURSES_REPL_LOADED=1

# REPL state
declare -g REPL_PROMPT="> "
declare -g REPL_INPUT=""
declare -g REPL_CURSOR_POS=0
declare -g REPL_RESPONSE=""
declare -g REPL_RESPONSE_LINES=()
declare -g REPL_HISTORY=()
declare -g REPL_HISTORY_POS=0

# Initialize REPL
repl_init() {
    REPL_INPUT=""
    REPL_CURSOR_POS=0
    REPL_RESPONSE=""
    REPL_RESPONSE_LINES=()
    REPL_HISTORY=()
    REPL_HISTORY_POS=0
}

# Clear input
repl_clear_input() {
    REPL_INPUT=""
    REPL_CURSOR_POS=0
}

# Clear response
repl_clear_response() {
    REPL_RESPONSE=""
    REPL_RESPONSE_LINES=()
}

# Add character at cursor
repl_insert_char() {
    local char="$1"
    REPL_INPUT="${REPL_INPUT:0:$REPL_CURSOR_POS}${char}${REPL_INPUT:$REPL_CURSOR_POS}"
    ((REPL_CURSOR_POS++))
}

# Delete character before cursor (backspace)
repl_backspace() {
    if [[ $REPL_CURSOR_POS -gt 0 ]]; then
        REPL_INPUT="${REPL_INPUT:0:$((REPL_CURSOR_POS-1))}${REPL_INPUT:$REPL_CURSOR_POS}"
        ((REPL_CURSOR_POS--))
    fi
}

# Move cursor left
repl_cursor_left() {
    if [[ $REPL_CURSOR_POS -gt 0 ]]; then
        ((REPL_CURSOR_POS--))
    fi
}

# Move cursor right
repl_cursor_right() {
    if [[ $REPL_CURSOR_POS -lt ${#REPL_INPUT} ]]; then
        ((REPL_CURSOR_POS++))
    fi
}

# Move cursor to start of line (Ctrl+A)
repl_cursor_home() {
    REPL_CURSOR_POS=0
}

# Move cursor to end of line (Ctrl+E)
repl_cursor_end() {
    REPL_CURSOR_POS=${#REPL_INPUT}
}

# Delete character at cursor (Ctrl+D)
repl_delete_char() {
    if [[ $REPL_CURSOR_POS -lt ${#REPL_INPUT} ]]; then
        REPL_INPUT="${REPL_INPUT:0:$REPL_CURSOR_POS}${REPL_INPUT:$((REPL_CURSOR_POS+1))}"
    fi
}

# Delete from cursor to end of line (Ctrl+K)
repl_kill_line() {
    REPL_INPUT="${REPL_INPUT:0:$REPL_CURSOR_POS}"
}

# Delete entire line (Ctrl+U)
repl_kill_whole_line() {
    REPL_INPUT=""
    REPL_CURSOR_POS=0
}

# Delete word backwards (Ctrl+W)
repl_kill_word() {
    if [[ $REPL_CURSOR_POS -eq 0 ]]; then
        return
    fi

    # Find start of word (skip trailing spaces first)
    local pos=$((REPL_CURSOR_POS - 1))
    while [[ $pos -ge 0 ]] && [[ "${REPL_INPUT:$pos:1}" == " " ]]; do
        ((pos--))
    done

    # Now delete the word
    while [[ $pos -ge 0 ]] && [[ "${REPL_INPUT:$pos:1}" != " " ]]; do
        ((pos--))
    done

    ((pos++))
    REPL_INPUT="${REPL_INPUT:0:$pos}${REPL_INPUT:$REPL_CURSOR_POS}"
    REPL_CURSOR_POS=$pos
}

# Move forward one word (Ctrl+F or Alt+F)
repl_forward_word() {
    local len=${#REPL_INPUT}
    if [[ $REPL_CURSOR_POS -ge $len ]]; then
        return
    fi

    # Skip current word
    while [[ $REPL_CURSOR_POS -lt $len ]] && [[ "${REPL_INPUT:$REPL_CURSOR_POS:1}" != " " ]]; do
        ((REPL_CURSOR_POS++))
    done

    # Skip spaces
    while [[ $REPL_CURSOR_POS -lt $len ]] && [[ "${REPL_INPUT:$REPL_CURSOR_POS:1}" == " " ]]; do
        ((REPL_CURSOR_POS++))
    done
}

# Move backward one word (Ctrl+B or Alt+B)
repl_backward_word() {
    if [[ $REPL_CURSOR_POS -eq 0 ]]; then
        return
    fi

    # Move back one position
    ((REPL_CURSOR_POS--))

    # Skip spaces
    while [[ $REPL_CURSOR_POS -gt 0 ]] && [[ "${REPL_INPUT:$REPL_CURSOR_POS:1}" == " " ]]; do
        ((REPL_CURSOR_POS--))
    done

    # Skip to start of word
    while [[ $REPL_CURSOR_POS -gt 0 ]] && [[ "${REPL_INPUT:$REPL_CURSOR_POS:1}" != " " ]]; do
        ((REPL_CURSOR_POS--))
    done

    # Adjust if we're on a space
    if [[ "${REPL_INPUT:$REPL_CURSOR_POS:1}" == " " ]]; then
        ((REPL_CURSOR_POS++))
    fi
}

# Add command to history
repl_add_to_history() {
    local cmd="$1"
    if [[ -n "$cmd" ]]; then
        REPL_HISTORY+=("$cmd")
        REPL_HISTORY_POS=${#REPL_HISTORY[@]}
    fi
}

# Navigate history up (previous command)
repl_history_up() {
    if [[ ${#REPL_HISTORY[@]} -eq 0 ]]; then
        return
    fi

    if [[ $REPL_HISTORY_POS -gt 0 ]]; then
        ((REPL_HISTORY_POS--))
        REPL_INPUT="${REPL_HISTORY[$REPL_HISTORY_POS]}"
        REPL_CURSOR_POS=${#REPL_INPUT}
    fi
}

# Navigate history down (next command)
repl_history_down() {
    if [[ ${#REPL_HISTORY[@]} -eq 0 ]]; then
        return
    fi

    if [[ $REPL_HISTORY_POS -lt $((${#REPL_HISTORY[@]} - 1)) ]]; then
        ((REPL_HISTORY_POS++))
        REPL_INPUT="${REPL_HISTORY[$REPL_HISTORY_POS]}"
        REPL_CURSOR_POS=${#REPL_INPUT}
    elif [[ $REPL_HISTORY_POS -eq $((${#REPL_HISTORY[@]} - 1)) ]]; then
        # At end of history, clear input
        ((REPL_HISTORY_POS++))
        REPL_INPUT=""
        REPL_CURSOR_POS=0
    fi
}

# Set response text (with optional colorization)
repl_set_response() {
    REPL_RESPONSE="$1"
    # Split into lines, preserving color codes
    mapfile -t REPL_RESPONSE_LINES <<< "$REPL_RESPONSE"
}

# Get input line
repl_get_input() {
    echo "$REPL_INPUT"
}

# Render REPL (input line + response area)
# Usage: repl_render START_ROW HEIGHT WIDTH
repl_render() {
    local start_row="$1"
    local height="$2"
    local width="$3"

    # Separator
    tcurses_buffer_write_line $start_row "$(printf '─%.0s' $(seq 1 $width))"

    # Input line
    local prompt_line="${REPL_PROMPT}${REPL_INPUT}"
    # Add cursor indicator
    if [[ $REPL_CURSOR_POS -lt ${#REPL_INPUT} ]]; then
        # Cursor in middle
        local before="${prompt_line:0:$((${#REPL_PROMPT} + REPL_CURSOR_POS))}"
        local at="${prompt_line:$((${#REPL_PROMPT} + REPL_CURSOR_POS)):1}"
        local after="${prompt_line:$((${#REPL_PROMPT} + REPL_CURSOR_POS + 1))}"
        prompt_line="${before}[${at}]${after}"
    else
        # Cursor at end
        prompt_line="${prompt_line}█"
    fi

    tcurses_buffer_write_line $((start_row + 1)) "  ${prompt_line}"

    # Response area (remaining height - 2 for separator and input)
    local response_height=$((height - 2))
    local line_num=0

    # Show last N lines of response
    local start_line=0
    if [[ ${#REPL_RESPONSE_LINES[@]} -gt $response_height ]]; then
        start_line=$((${#REPL_RESPONSE_LINES[@]} - response_height))
    fi

    for ((i = start_line; i < ${#REPL_RESPONSE_LINES[@]} && line_num < response_height; i++)); do
        local line="${REPL_RESPONSE_LINES[$i]}"
        # Truncate if needed
        if [[ ${#line} -gt $((width - 4)) ]]; then
            line="${line:0:$((width - 7))}..."
        fi
        tcurses_buffer_write_line $((start_row + 2 + line_num)) "  ${line}"
        ((line_num++))
    done

    # Pad empty lines
    while [[ $line_num -lt $response_height ]]; do
        tcurses_buffer_write_line $((start_row + 2 + line_num)) ""
        ((line_num++))
    done
}

# Export
export -f repl_init
export -f repl_clear_input
export -f repl_clear_response
export -f repl_insert_char
export -f repl_backspace
export -f repl_cursor_left
export -f repl_cursor_right
export -f repl_cursor_home
export -f repl_cursor_end
export -f repl_delete_char
export -f repl_kill_line
export -f repl_kill_whole_line
export -f repl_kill_word
export -f repl_forward_word
export -f repl_backward_word
export -f repl_add_to_history
export -f repl_history_up
export -f repl_history_down
export -f repl_set_response
export -f repl_get_input
export -f repl_render
