#!/usr/bin/env bash

# REPL Input Modes System
# Multimodal input handler supporting different input modes
#
# Currently supports:
#   - CLI mode: Line-oriented readline with history, tab completion, editing
#   - Key mode: Character-oriented raw keystroke mode for instant actions
#
# Usage:
#   - Start in CLI mode (default)
#   - Switch modes via /key command or ESC key
#
# Architecture:
#   This is a modal input system where the REPL can operate in different
#   input handling modes. Each mode has its own:
#   - Terminal setup (raw vs cooked, echo on/off, etc.)
#   - Input reading mechanism (readline vs single keystroke)
#   - Prompt rendering strategy (integrated vs separate)

# Mode state
REPL_INPUT_MODE="${REPL_INPUT_MODE:-cli}"  # Current input mode: "cli" or "key"

# Terminal state tracking
_INPUT_MODE_ORIGINAL_STTY=""
_INPUT_MODE_INITIALIZED=false

# Initialize input mode system
input_mode_init() {
    # Save original terminal settings
    _INPUT_MODE_ORIGINAL_STTY=$(stty -g 2>/dev/null)
    _INPUT_MODE_INITIALIZED=true

    # Start in CLI mode
    REPL_INPUT_MODE="cli"
    input_mode_setup_terminal "cli"
}

# Cleanup input mode system
input_mode_cleanup() {
    # Restore original terminal settings
    if [[ -n "$_INPUT_MODE_ORIGINAL_STTY" ]]; then
        stty "$_INPUT_MODE_ORIGINAL_STTY" 2>/dev/null
    else
        stty sane 2>/dev/null
    fi

    # Show cursor
    tput cnorm 2>/dev/null || printf '\033[?25h'

    _INPUT_MODE_INITIALIZED=false
}

# Setup terminal for specific mode
input_mode_setup_terminal() {
    local mode="$1"

    if [[ "$mode" == "key" ]]; then
        # Key mode: raw input, no echo, instant character capture
        stty raw -echo 2>/dev/null
        # Hide cursor for cleaner key mode display
        tput civis 2>/dev/null || printf '\033[?25l'
    else
        # CLI mode: cooked input, echo enabled, line editing
        stty sane 2>/dev/null
        stty echo 2>/dev/null
        # Show cursor for CLI mode
        tput cnorm 2>/dev/null || printf '\033[?25h'
    fi
}

# Switch to a new input mode
input_mode_switch() {
    local new_mode="$1"

    # Validate mode
    if [[ "$new_mode" != "cli" && "$new_mode" != "key" ]]; then
        echo "input_mode_switch: Invalid mode '$new_mode'" >&2
        return 1
    fi

    # Only switch if different
    if [[ "$REPL_INPUT_MODE" != "$new_mode" ]]; then
        local old_mode="$REPL_INPUT_MODE"
        REPL_INPUT_MODE="$new_mode"

        # Setup terminal for new mode
        input_mode_setup_terminal "$new_mode"

        # Optional: call mode change hook if defined
        if declare -F input_mode_on_switch >/dev/null 2>&1; then
            input_mode_on_switch "$old_mode" "$new_mode"
        fi
    fi

    return 0
}

# Get current input mode
input_mode_get() {
    echo "$REPL_INPUT_MODE"
}

# Check if in key mode
input_mode_is_key_mode() {
    [[ "$REPL_INPUT_MODE" == "key" ]]
}

# Check if in CLI mode
input_mode_is_cli_mode() {
    [[ "$REPL_INPUT_MODE" == "cli" ]]
}

# Check for mode switch trigger in input
# Returns: "key" if should switch to key mode, "cli" if should switch to CLI mode, "" if no switch
input_mode_check_trigger() {
    local input="$1"
    local cursor_col="${2:-0}"

    # In CLI mode: /key command triggers key mode
    if [[ "$REPL_INPUT_MODE" == "cli" ]]; then
        if [[ "$input" == "/key" ]]; then
            echo "key"
            return 0
        fi
    fi

    # In key mode: ESC triggers CLI mode
    if [[ "$REPL_INPUT_MODE" == "key" ]]; then
        if [[ "$input" == $'\x1b' ]]; then
            echo "cli"
            return 0
        fi
    fi

    # No mode switch
    echo ""
    return 0
}

# Read input based on current mode
# Returns the input string, or exits with non-zero on EOF/error
input_mode_read_input() {
    local prompt="${1:-}"

    if [[ "$REPL_INPUT_MODE" == "key" ]]; then
        # Key mode: single keystroke
        if declare -F tcurses_input_read_key_blocking >/dev/null 2>&1; then
            tcurses_input_read_key_blocking
        else
            # Fallback: read single character
            local char
            IFS= read -r -n1 -s char
            echo "$char"
        fi
    else
        # CLI mode: readline
        if declare -F tcurses_readline >/dev/null 2>&1; then
            # Use tcurses readline if available (with history file if REPL_HISTORY_FILE is set)
            tcurses_readline "$prompt" "${REPL_HISTORY_FILE:-}"
        else
            # Fallback: standard read with readline
            local input
            read -e -r -p "$prompt" input
            echo "$input"
        fi
    fi
}

# Process input with mode-awareness
# This is a helper that combines trigger checking and mode switching
# Returns: 0 if input should be processed, 1 if mode switch occurred (skip processing)
input_mode_process_trigger() {
    local input="$1"
    local cursor_col="${2:-0}"

    local trigger
    trigger=$(input_mode_check_trigger "$input" "$cursor_col")

    if [[ -n "$trigger" ]]; then
        # Mode switch requested
        input_mode_switch "$trigger"

        # Show feedback message
        if [[ "$trigger" == "key" ]]; then
            printf '\n%b→ Key-Command Mode%b\n' "${TETRA_CYAN}" "${TETRA_NC}" >&2
            printf '%bPress ESC to return to CLI mode%b\n' "${TETRA_DIM}" "${TETRA_NC}" >&2
        fi

        return 1  # Signal that mode switch occurred
    fi

    return 0  # No mode switch, process input normally
}

# Get mode indicator string for prompt
# Returns a colored string like "[KEY]" or "" (empty for CLI)
input_mode_get_indicator() {
    local style="${1:-bracket}"  # bracket, icon, or color

    if [[ "$REPL_INPUT_MODE" == "key" ]]; then
        case "$style" in
            icon)
                echo "${TETRA_YELLOW}⌨${TETRA_NC}"
                ;;
            color)
                echo "${TETRA_YELLOW}KEY${TETRA_NC}"
                ;;
            bracket|*)
                echo "${TETRA_YELLOW}[KEY]${TETRA_NC}"
                ;;
        esac
    else
        # CLI mode - no indicator
        echo ""
    fi
}

# Main loop for multimodal REPL
# Requires handler functions to be defined by the specific REPL:
#   - input_mode_handle_cli "$input"   - process CLI commands
#   - input_mode_handle_key "$key"     - process key commands
#   - input_mode_render_prompt         - render the prompt (for key mode)
#   - input_mode_build_prompt          - build prompt string (for CLI mode)
input_mode_main_loop() {
    # Initialize if not already done
    if [[ "$_INPUT_MODE_INITIALIZED" != "true" ]]; then
        input_mode_init
    fi

    # Setup cleanup trap
    trap input_mode_cleanup EXIT INT TERM

    # Main loop
    while true; do
        # Build prompt for CLI mode, or render for key mode
        local prompt_str=""
        if [[ "$REPL_INPUT_MODE" == "key" ]]; then
            # Key mode: render prompt to screen (no readline)
            if declare -F input_mode_render_prompt >/dev/null 2>&1; then
                input_mode_render_prompt
            fi
        else
            # CLI mode: build prompt string for readline
            if declare -F input_mode_build_prompt >/dev/null 2>&1; then
                prompt_str=$(input_mode_build_prompt)
            fi
        fi

        # Read input (mode-aware)
        local input
        if ! input=$(input_mode_read_input "$prompt_str"); then
            # EOF or error
            break
        fi

        # Handle Ctrl+C in both modes
        if [[ "$input" == $'\x03' ]]; then
            echo "" >&2
            break
        fi

        # Check for mode switch trigger
        if ! input_mode_process_trigger "$input" "0"; then
            # Mode switch occurred - redraw prompt and continue
            continue
        fi

        # Dispatch to appropriate handler
        local handler_result=0
        if [[ "$REPL_INPUT_MODE" == "key" ]]; then
            # Key mode handler
            if declare -F input_mode_handle_key >/dev/null 2>&1; then
                input_mode_handle_key "$input" || handler_result=$?
            else
                echo "Error: input_mode_handle_key not defined" >&2
                break
            fi
        else
            # CLI mode handler
            if declare -F input_mode_handle_cli >/dev/null 2>&1; then
                input_mode_handle_cli "$input" || handler_result=$?
            else
                echo "Error: input_mode_handle_cli not defined" >&2
                break
            fi
        fi

        # Check if handler signaled exit
        if [[ $handler_result -ne 0 ]]; then
            break
        fi
    done

    # Cleanup
    trap - EXIT INT TERM
    input_mode_cleanup
}

# Export functions
export -f input_mode_init
export -f input_mode_cleanup
export -f input_mode_setup_terminal
export -f input_mode_switch
export -f input_mode_get
export -f input_mode_is_key_mode
export -f input_mode_is_cli_mode
export -f input_mode_check_trigger
export -f input_mode_read_input
export -f input_mode_process_trigger
export -f input_mode_get_indicator
export -f input_mode_main_loop

# Backward compatibility aliases (deprecated - will be removed in future)
alias dual_mode_init=input_mode_init
alias dual_mode_cleanup=input_mode_cleanup
alias dual_mode_setup_terminal=input_mode_setup_terminal
alias dual_mode_switch=input_mode_switch
alias dual_mode_get=input_mode_get
alias dual_mode_is_key_mode=input_mode_is_key_mode
alias dual_mode_is_cli_mode=input_mode_is_cli_mode
alias dual_mode_check_trigger=input_mode_check_trigger
alias dual_mode_read_input=input_mode_read_input
alias dual_mode_process_trigger=input_mode_process_trigger
alias dual_mode_get_indicator=input_mode_get_indicator
alias dual_mode_main_loop=input_mode_main_loop
