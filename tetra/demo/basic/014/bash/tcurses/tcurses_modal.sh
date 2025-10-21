#!/usr/bin/env bash

# TCurses Modal System
# Vim-like modes: NORMAL, COMMAND, REPL

# Mode state
declare -g APP_MODE="NORMAL"
declare -g APP_MODE_PREV="NORMAL"

# Mode definitions
declare -Ag MODE_INFO=(
    [NORMAL]="Normal navigation mode"
    [COMMAND]="Command entry (: prefix)"
    [REPL]="REPL mode - execute commands"
)

# Initialize modal system
modal_init() {
    APP_MODE="NORMAL"
    APP_MODE_PREV="NORMAL"
}

# Set mode
modal_set() {
    local new_mode="$1"
    if [[ -v MODE_INFO[$new_mode] ]]; then
        APP_MODE_PREV="$APP_MODE"
        APP_MODE="$new_mode"
        return 0
    fi
    return 1
}

# Get current mode
modal_get() {
    echo "$APP_MODE"
}

# Get previous mode
modal_get_prev() {
    echo "$APP_MODE_PREV"
}

# Check if in specific mode
modal_is() {
    local mode="$1"
    [[ "$APP_MODE" == "$mode" ]]
}

# Get mode info string
modal_info() {
    local mode="${1:-$APP_MODE}"
    echo "${MODE_INFO[$mode]}"
}

# Export
export -f modal_init
export -f modal_set
export -f modal_get
export -f modal_is
export -f modal_info
