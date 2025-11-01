#!/usr/bin/env bash

# Arrow Key Handler Module
# Responsibility: Parse and handle arrow key escape sequences
# Single responsibility: Arrow key input processing

# Handle arrow key escape sequences
# Usage: handle_arrow_sequence "next_char" "arrow_char"
# Returns: 0 if handled, 1 if should quit
handle_arrow_sequence() {
    local next_char="$1"
    local arrow_char="$2"

    if [[ "$next_char" == '[' ]]; then
        case "$arrow_char" in
            'A') # Up arrow
                log_action "Input: Arrow Up"
                navigate_action_up
                return 0
                ;;
            'B') # Down arrow
                log_action "Input: Arrow Down"
                navigate_action_down
                return 0
                ;;
            'C') # Right arrow
                log_action "Input: Arrow Right"
                navigate_action_right
                return 0
                ;;
            'D') # Left arrow
                log_action "Input: Arrow Left"
                navigate_action_left
                return 0
                ;;
            *)
                log_action "Input: Unknown escape sequence \\033[$arrow_char"
                return 0
                ;;
        esac
    else
        # Plain ESC key - signal to quit
        log_action "Input: Quit requested (ESC)"
        return 1
    fi
}

# Read and process arrow key escape sequence
# Called when ESC character is detected
# Returns: 0 if handled, 1 if should quit
process_arrow_key() {
    # Read the next character to determine if it's an escape sequence
    local next_char=""
    local arrow_char=""

    read -n1 -s -t 0.1 next_char || next_char=""

    if [[ "$next_char" == '[' ]]; then
        # Read the final character of the arrow key sequence
        read -n1 -s -t 0.1 arrow_char || arrow_char=""
        handle_arrow_sequence "$next_char" "$arrow_char"
        return $?
    else
        # Plain ESC key - signal to quit
        handle_arrow_sequence "$next_char" ""
        return $?
    fi
}

# Arrow key mapping configuration
# Can be customized by setting these before sourcing this module
declare -A ARROW_KEY_ACTIONS=(
    [UP]="navigate_action_up"
    [DOWN]="navigate_action_down"
    [LEFT]="navigate_action_left"
    [RIGHT]="navigate_action_right"
)

# Get arrow key action mapping
get_arrow_action() {
    local direction="$1"
    echo "${ARROW_KEY_ACTIONS[$direction]}"
}

# Set custom arrow key action
set_arrow_action() {
    local direction="$1"
    local action_function="$2"
    ARROW_KEY_ACTIONS[$direction]="$action_function"
}

# Initialize arrow key handler
init_arrow_handler() {
    # Arrow key handler initialized
    # Default mappings configured
    return 0
}

# Call initialization
init_arrow_handler