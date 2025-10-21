#!/usr/bin/env bash

# TCurses Library Demo
# Simple introduction to tcurses terminal UI capabilities

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Bootstrap tetra
if [[ -z "$TETRA_SRC" ]]; then
    export TETRA_SRC="$(cd "$SCRIPT_DIR/../../.." && pwd)"
fi

# Demo state
COUNTER=0
START_TIME=$(date +%s)
PAUSED_TIME=0
PAUSE_START=0
MESSAGE="Welcome to TCurses"
MODE="NAVIGATION"  # NAVIGATION or RAW
ANIMATION_PAUSED=false

# Key log (circular buffer, 4 lines)
declare -a KEY_LOG=("" "" "" "")
KEY_LOG_INDEX=0

# Colors
if command -v tput >/dev/null 2>&1; then
    BOLD=$(tput bold)
    GREEN=$(tput setaf 2)
    BLUE=$(tput setaf 4)
    YELLOW=$(tput setaf 3)
    CYAN=$(tput setaf 6)
    MAGENTA=$(tput setaf 5)
    RED=$(tput setaf 1)
    RESET=$(tput sgr0)
else
    BOLD=""
    GREEN=""
    BLUE=""
    YELLOW=""
    CYAN=""
    MAGENTA=""
    RED=""
    RESET=""
fi

# Add key to log
log_key() {
    local key=$1
    local display_key=""

    # Format key for display
    case "$key" in
        $'\x1b') display_key="${CYAN}<ESC>${RESET}" ;;
        $'\n'|$'\r') display_key="${CYAN}<ENTER>${RESET}" ;;
        $'\t') display_key="${CYAN}<TAB>${RESET}" ;;
        ' ') display_key="${CYAN}<SPACE>${RESET}" ;;
        $'\x7f') display_key="${CYAN}<BACKSPACE>${RESET}" ;;
        '') return ;;  # Don't log timeout
        *) display_key="${YELLOW}$key${RESET}" ;;
    esac

    # Add to circular buffer with mode color
    local mode_display="$MODE"
    if [[ "$MODE" == "NAVIGATION" ]]; then
        mode_display="${GREEN}NAV${RESET}"
    else
        mode_display="${MAGENTA}RAW${RESET}"
    fi

    KEY_LOG[$KEY_LOG_INDEX]="  $(date +%H:%M:%S) [$mode_display] $display_key"
    KEY_LOG_INDEX=$(( (KEY_LOG_INDEX + 1) % 4 ))
}

# Cleanup function
cleanup() {
    tput cnorm 2>/dev/null
    tput rmcup 2>/dev/null
    stty sane 2>/dev/null
}

# Render function - called every frame
render() {
    local now=$(date +%s)
    local elapsed
    if [[ "$ANIMATION_PAUSED" == "true" ]]; then
        elapsed=$((PAUSE_START - START_TIME - PAUSED_TIME))
    else
        elapsed=$((now - START_TIME - PAUSED_TIME))
    fi

    # Clear and position cursor at top
    clear

    # Header (fits 80 columns with 2-space left margin)
    echo "  ${BOLD}${BLUE}╔════════════════════════════════════╗${RESET}"
    echo "  ${BOLD}${BLUE}║${RESET}     ${BOLD}TCurses Library Demo${RESET}           ${BOLD}${BLUE}║${RESET}"
    echo "  ${BOLD}${BLUE}╚════════════════════════════════════╝${RESET}"
    echo ""

    # Mode indicator
    if [[ "$MODE" == "NAVIGATION" ]]; then
        echo "  ${BOLD}Mode:${RESET} ${GREEN}NAVIGATION${RESET} (press ${BOLD}i${RESET} for RAW mode)"
    else
        echo "  ${BOLD}Mode:${RESET} ${MAGENTA}RAW INPUT${RESET} (press ${BOLD}ESC${RESET} for NAVIGATION)"
    fi
    echo ""

    # Content with color
    echo "  ${BOLD}${MESSAGE}${RESET}"
    echo ""

    # Animated spinner with runtime
    local spinner_display=""
    if [[ "$ANIMATION_PAUSED" == "true" ]]; then
        spinner_display="${RED}◼${RESET}"
    else
        local spinner=('⠋' '⠙' '⠹' '⠸' '⠼' '⠴' '⠦' '⠧' '⠇' '⠏')
        local idx=$((COUNTER % ${#spinner[@]}))
        spinner_display="${GREEN}${spinner[$idx]}${RESET}"
    fi
    echo "  $spinner_display ${YELLOW}Runtime:${RESET} ${elapsed}s  ${YELLOW}Frames:${RESET} ${COUNTER}"
    echo ""

    # Key log (last 4 keys)
    echo "  ${BOLD}Key Log:${RESET}"
    for i in 0 1 2 3; do
        local idx=$(( (KEY_LOG_INDEX + i) % 4 ))
        if [[ -n "${KEY_LOG[$idx]}" ]]; then
            echo "${KEY_LOG[$idx]}"
        else
            echo "  ..."
        fi
    done
    echo ""

    # Help based on mode
    if [[ "$MODE" == "NAVIGATION" ]]; then
        echo "  ${BOLD}Keys:${RESET} ${BOLD}1-5${RESET} messages  ${BOLD}p${RESET} pause  ${BOLD}i${RESET} raw  ${BOLD}q${RESET} quit"
    else
        echo "  ${BOLD}Raw mode:${RESET} Type anything, ${BOLD}ESC${RESET} to exit"
    fi

    if [[ "$ANIMATION_PAUSED" == "false" ]]; then
        ((COUNTER++))
    fi
}

# Input handler - processes keypresses
handle_input() {
    local key=$1

    # Log the key
    log_key "$key"

    # ESC always returns to navigation
    if [[ "$key" == $'\x1b' ]]; then
        MODE="NAVIGATION"
        return 0
    fi

    # Mode-specific handling
    if [[ "$MODE" == "RAW" ]]; then
        # In raw mode, keys just get logged, no special handling
        return 0
    fi

    # Navigation mode
    case "$key" in
        q|Q)
            return 1  # Exit
            ;;
        i|I)
            MODE="RAW"
            MESSAGE="${MAGENTA}Raw input mode - all keys logged${RESET}"
            ;;
        p|P)
            if [[ "$ANIMATION_PAUSED" == "true" ]]; then
                ANIMATION_PAUSED=false
                MESSAGE="${GREEN}Animation resumed${RESET}"
            else
                ANIMATION_PAUSED=true
                MESSAGE="${RED}Animation paused${RESET}"
            fi
            ;;
        1)
            MESSAGE="${GREEN}Terminal mode management${RESET}"
            ;;
        2)
            MESSAGE="${BLUE}Screen control and buffers${RESET}"
            ;;
        3)
            MESSAGE="${YELLOW}Input handling and events${RESET}"
            ;;
        4)
            MESSAGE="${CYAN}Animation and timing${RESET}"
            ;;
        5)
            MESSAGE="${MAGENTA}Coordination layer for TUI/REPL/TM${RESET}"
            ;;
        r|R)
            COUNTER=0
            START_TIME=$(date +%s)
            MESSAGE="${BOLD}Counter reset${RESET}"
            ;;
    esac

    return 0  # Continue
}

# Main
main() {
    # Set up cleanup on exit
    trap cleanup EXIT INT TERM

    # Enter alternate screen buffer
    tput smcup 2>/dev/null

    # Hide cursor
    tput civis 2>/dev/null

    # Set up raw input mode
    stty -echo -icanon min 0 time 0 2>/dev/null

    # Main loop
    while true; do
        # Only render if not paused
        if [[ "$ANIMATION_PAUSED" == "false" ]]; then
            render
        fi

        # Read input with timeout (0.1 seconds)
        local key=""
        if IFS= read -rsn1 -t 0.1 key; then
            handle_input "$key" || break
            # If just unpaused, render immediately
            if [[ "$ANIMATION_PAUSED" == "false" ]]; then
                render
            fi
        fi
    done

    # Cleanup will happen via trap

    # Show exit message (after cleanup restores terminal)
    echo ""
    echo "Thanks for trying TCurses"
    echo ""
    echo "Next steps:"
    echo "  • Read the API docs: $TETRA_SRC/bash/tcurses/README.md"
    echo "  • See advanced demo: $TETRA_SRC/demo/basic/014/bash/tcurses/demo.sh"
    echo "  • Build your own TUI app"
    echo ""
}

main "$@"
