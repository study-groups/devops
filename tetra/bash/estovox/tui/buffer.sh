#!/usr/bin/env bash
# Estovox TUI Buffer - Double buffering for smooth rendering

# Try to use tcurses if available
if [[ -f "$TETRA_SRC/bash/tcurses/tcurses_buffer.sh" ]]; then
    source "$TETRA_SRC/bash/tcurses/tcurses_buffer.sh"
    ESTOVOX_USE_TCURSES=1
else
    # Fallback: simple buffer implementation
    ESTOVOX_USE_TCURSES=0
    declare -gA _ESTOVOX_BUFFER=()
fi

estovox_buffer_init() {
    if (( ESTOVOX_USE_TCURSES )); then
        tcurses_buffer_init
    else
        _ESTOVOX_BUFFER=()
    fi
}

estovox_buffer_clear() {
    if (( ESTOVOX_USE_TCURSES )); then
        tcurses_buffer_clear
    else
        _ESTOVOX_BUFFER=()
    fi
}

estovox_buffer_write_line() {
    local line_num=$1
    local text=$2

    if (( ESTOVOX_USE_TCURSES )); then
        tcurses_buffer_write_line "$line_num" "$text"
    else
        _ESTOVOX_BUFFER[$line_num]="$text"
    fi
}

estovox_buffer_render() {
    if (( ESTOVOX_USE_TCURSES )); then
        tcurses_buffer_render_diff
    else
        # Simple render - just output all lines
        tput cup 0 0
        for ((i=0; i<LINES; i++)); do
            local line="${_ESTOVOX_BUFFER[$i]:-}"
            tput cup "$i" 0
            printf '\033[K%s' "$line"
        done
    fi
}
