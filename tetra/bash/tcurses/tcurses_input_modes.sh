#!/usr/bin/env bash
# TCurses Input Modes System
# Multimodal input handler supporting CLI and Key modes

# Include guard
[[ -n "${_TCURSES_INPUT_MODES_LOADED:-}" ]] && return
declare -g _TCURSES_INPUT_MODES_LOADED=1

# Source dependencies
TCURSES_DIR="${TCURSES_DIR:-$(dirname "${BASH_SOURCE[0]}")}"
source "$TCURSES_DIR/tcurses_input.sh" 2>/dev/null || true
source "$TCURSES_DIR/tcurses_readline.sh" 2>/dev/null || true

# ============================================================================
# INPUT MODES
# ============================================================================
#
# CLI Mode:  Line-oriented readline with history, TAB completion, editing
#            Terminal: cooked, echo on, cursor visible
#
# Key Mode:  Character-oriented raw keystroke for instant actions
#            Terminal: raw, echo off, cursor hidden
#
# Switching:
#   CLI → Key:  /key command or custom trigger
#   Key → CLI:  ESC key
#
# ============================================================================

# Mode state
declare -g TCURSES_INPUT_MODE="${TCURSES_INPUT_MODE:-cli}"

# Terminal state tracking
_TCURSES_MODE_ORIGINAL_STTY=""
_TCURSES_MODE_INITIALIZED=false

# History file for CLI mode (optional)
declare -g TCURSES_HISTORY_FILE=""

# ============================================================================
# INITIALIZATION
# ============================================================================

# Initialize input mode system
# Usage: tcurses_input_mode_init
tcurses_input_mode_init() {
    # Save original terminal settings
    _TCURSES_MODE_ORIGINAL_STTY=$(stty -g 2>/dev/null)
    _TCURSES_MODE_INITIALIZED=true

    # Start in CLI mode
    TCURSES_INPUT_MODE="cli"
    tcurses_input_mode_setup_terminal "cli"
}

# Cleanup input mode system
# Usage: tcurses_input_mode_cleanup
tcurses_input_mode_cleanup() {
    # Restore original terminal settings
    if [[ -n "$_TCURSES_MODE_ORIGINAL_STTY" ]]; then
        stty "$_TCURSES_MODE_ORIGINAL_STTY" 2>/dev/null
    else
        stty sane 2>/dev/null
    fi

    # Show cursor
    tput cnorm 2>/dev/null || printf '\033[?25h'

    _TCURSES_MODE_INITIALIZED=false
}

# Setup terminal for specific mode
# Usage: tcurses_input_mode_setup_terminal MODE
tcurses_input_mode_setup_terminal() {
    local mode="$1"

    case "$mode" in
        key)
            # Key mode: raw input, no echo, instant character capture
            stty raw -echo 2>/dev/null
            # Hide cursor for cleaner display
            tput civis 2>/dev/null || printf '\033[?25l'
            ;;
        cli|*)
            # CLI mode: cooked input, echo enabled, line editing
            stty sane 2>/dev/null
            stty echo 2>/dev/null
            # Show cursor
            tput cnorm 2>/dev/null || printf '\033[?25h'
            ;;
    esac
}

# ============================================================================
# MODE SWITCHING
# ============================================================================

# Switch to a new input mode
# Usage: tcurses_input_mode_switch MODE
tcurses_input_mode_switch() {
    local new_mode="$1"

    # Validate mode
    case "$new_mode" in
        cli|key) ;;
        *)
            echo "tcurses_input_mode_switch: Invalid mode '$new_mode'" >&2
            return 1
            ;;
    esac

    # Only switch if different
    if [[ "$TCURSES_INPUT_MODE" != "$new_mode" ]]; then
        local old_mode="$TCURSES_INPUT_MODE"
        TCURSES_INPUT_MODE="$new_mode"

        # Setup terminal for new mode
        tcurses_input_mode_setup_terminal "$new_mode"

        # Call mode change hook if defined
        if declare -F tcurses_on_mode_switch >/dev/null 2>&1; then
            tcurses_on_mode_switch "$old_mode" "$new_mode"
        fi
    fi

    return 0
}

# Get current input mode
# Usage: mode=$(tcurses_input_mode_get)
tcurses_input_mode_get() {
    echo "$TCURSES_INPUT_MODE"
}

# Check mode
tcurses_input_mode_is_key() {
    [[ "$TCURSES_INPUT_MODE" == "key" ]]
}

tcurses_input_mode_is_cli() {
    [[ "$TCURSES_INPUT_MODE" == "cli" ]]
}

# ============================================================================
# TRIGGER DETECTION
# ============================================================================

# Check for mode switch trigger in input
# Usage: new_mode=$(tcurses_input_mode_check_trigger INPUT)
# Returns: "key", "cli", or "" (no switch)
tcurses_input_mode_check_trigger() {
    local input="$1"

    case "$TCURSES_INPUT_MODE" in
        cli)
            # /key command triggers key mode
            [[ "$input" == "/key" ]] && { echo "key"; return 0; }
            ;;
        key)
            # ESC triggers CLI mode
            [[ "$input" == $'\x1b' ]] && { echo "cli"; return 0; }
            ;;
    esac

    echo ""
    return 0
}

# Process input with mode-awareness
# Returns: 0 if input should be processed, 1 if mode switch occurred
# Usage: if tcurses_input_mode_process_trigger "$input"; then ... fi
tcurses_input_mode_process_trigger() {
    local input="$1"

    local trigger
    trigger=$(tcurses_input_mode_check_trigger "$input")

    if [[ -n "$trigger" ]]; then
        tcurses_input_mode_switch "$trigger"

        # Show feedback (customize via hook)
        if declare -F tcurses_on_mode_feedback >/dev/null 2>&1; then
            tcurses_on_mode_feedback "$trigger"
        else
            # Default feedback
            case "$trigger" in
                key)
                    printf '\n→ Key Mode (ESC to return)\n' >&2
                    ;;
                cli)
                    printf '\n→ CLI Mode\n' >&2
                    ;;
            esac
        fi

        return 1  # Mode switch occurred
    fi

    return 0  # No mode switch
}

# ============================================================================
# INPUT READING
# ============================================================================

# Read input based on current mode
# Usage: input=$(tcurses_input_mode_read [PROMPT])
tcurses_input_mode_read() {
    local prompt="${1:-}"

    case "$TCURSES_INPUT_MODE" in
        key)
            # Key mode: single keystroke
            if declare -F tcurses_input_read_key_blocking >/dev/null 2>&1; then
                tcurses_input_read_key_blocking
            else
                # Fallback
                local char
                IFS= read -r -n1 -s char
                echo "$char"
            fi
            ;;
        cli|*)
            # CLI mode: readline
            if declare -F tcurses_readline >/dev/null 2>&1; then
                tcurses_readline "$prompt" "${TCURSES_HISTORY_FILE:-}"
            else
                # Fallback
                local input
                read -e -r -p "$prompt" input
                echo "$input"
            fi
            ;;
    esac
}

# ============================================================================
# MODE INDICATOR
# ============================================================================

# Get mode indicator string for prompt
# Usage: indicator=$(tcurses_input_mode_indicator [STYLE])
# Styles: bracket, icon, text
tcurses_input_mode_indicator() {
    local style="${1:-bracket}"

    case "$TCURSES_INPUT_MODE" in
        key)
            case "$style" in
                icon)   echo "⌨" ;;
                text)   echo "KEY" ;;
                bracket|*) echo "[KEY]" ;;
            esac
            ;;
        cli|*)
            # CLI mode - no indicator by default
            echo ""
            ;;
    esac
}

# ============================================================================
# MAIN LOOP
# ============================================================================

# Main loop for multimodal input
# Requires these handler functions to be defined:
#   - tcurses_handle_cli INPUT    - process CLI commands (return 1 to exit)
#   - tcurses_handle_key KEY      - process key commands (return 1 to exit)
#   - tcurses_render_prompt       - render prompt for key mode (optional)
#   - tcurses_build_prompt        - build prompt string for CLI mode (optional)
#
# Usage: tcurses_input_mode_main_loop
tcurses_input_mode_main_loop() {
    # Initialize if needed
    if [[ "$_TCURSES_MODE_INITIALIZED" != "true" ]]; then
        tcurses_input_mode_init
    fi

    # Setup cleanup trap
    trap tcurses_input_mode_cleanup EXIT INT TERM

    # Main loop
    while true; do
        # Build/render prompt based on mode
        local prompt_str=""

        case "$TCURSES_INPUT_MODE" in
            key)
                # Key mode: render prompt to screen
                if declare -F tcurses_render_prompt >/dev/null 2>&1; then
                    tcurses_render_prompt
                fi
                ;;
            cli|*)
                # CLI mode: build prompt string for readline
                if declare -F tcurses_build_prompt >/dev/null 2>&1; then
                    prompt_str=$(tcurses_build_prompt)
                else
                    prompt_str="> "
                fi
                ;;
        esac

        # Read input
        local input
        if ! input=$(tcurses_input_mode_read "$prompt_str"); then
            break  # EOF or error
        fi

        # Handle Ctrl+C
        [[ "$input" == $'\x03' ]] && break

        # Check for mode switch
        if ! tcurses_input_mode_process_trigger "$input"; then
            continue  # Mode switch occurred
        fi

        # Dispatch to handler
        local result=0
        case "$TCURSES_INPUT_MODE" in
            key)
                if declare -F tcurses_handle_key >/dev/null 2>&1; then
                    tcurses_handle_key "$input" || result=$?
                else
                    echo "Error: tcurses_handle_key not defined" >&2
                    break
                fi
                ;;
            cli|*)
                if declare -F tcurses_handle_cli >/dev/null 2>&1; then
                    tcurses_handle_cli "$input" || result=$?
                else
                    echo "Error: tcurses_handle_cli not defined" >&2
                    break
                fi
                ;;
        esac

        # Handler signaled exit
        [[ $result -ne 0 ]] && break
    done

    # Cleanup
    trap - EXIT INT TERM
    tcurses_input_mode_cleanup
}

# ============================================================================
# CONVENIENCE ALIASES
# ============================================================================

# Shorter names for common operations
alias tc_mode_init=tcurses_input_mode_init
alias tc_mode_cleanup=tcurses_input_mode_cleanup
alias tc_mode_switch=tcurses_input_mode_switch
alias tc_mode_get=tcurses_input_mode_get
alias tc_mode_is_key=tcurses_input_mode_is_key
alias tc_mode_is_cli=tcurses_input_mode_is_cli
alias tc_mode_read=tcurses_input_mode_read
alias tc_mode_loop=tcurses_input_mode_main_loop
