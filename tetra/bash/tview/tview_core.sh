#!/usr/bin/env bash

# TView Core - Main view logic and navigation (refactored modular version)

# Source all modules
TVIEW_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$TVIEW_DIR/tview_data.sh"         # Data loading functions
source "$TVIEW_DIR/tview_render.sh"       # Display rendering
source "$TVIEW_DIR/tview_modes.sh"        # Mode content rendering
source "$TVIEW_DIR/tview_actions.sh"      # Modal actions
source "$TVIEW_DIR/tview_navigation.sh"   # Navigation functions
source "$TVIEW_DIR/tview_hooks.sh"        # Context-triggered actions (drill behaviors)
source "$TVIEW_DIR/tview_repl.sh"         # REPL interfaces

# Global state - Hierarchical navigation paradigm
CURRENT_ENV="LOCAL"      # SYSTEM | LOCAL | DEV | STAGING | PROD (primary navigation)
CURRENT_MODE="TOML"      # TOML | TKM | TSM | DEPLOY | ORG (secondary navigation)
CURRENT_ITEM=0           # Item within current environment+mode
DRILL_LEVEL=0            # 0=normal view, 1=drilled into item
TVIEW_MODE="gamepad"     # gamepad | repl (interaction mode)

# Available environments and modes (reordered for new hierarchy)
ENVIRONMENTS=("SYSTEM" "LOCAL" "DEV" "STAGING" "PROD" "QA")
MODES=("TOML" "TKM" "TSM" "DEPLOY" "ORG")

# Scrolling state
SCROLL_OFFSET=0
FILE_VIEW_MODE=false
FILE_VIEW_CONTENT=""
FILE_VIEW_LINES=0

# TView REPL main function - Complete redesign for modal navigation
tview_repl_main() {
    local content_lines=0
    local terminal_lines=${LINES:-24}

    # Initialize display
    setup_colors
    detect_active_toml

    # Cache for reducing unnecessary redraws
    local last_display=""
    local data_refresh_counter=0
    local ssh_check_counter=0

    while true; do
        # Only refresh data periodically, not every keystroke
        if [[ $data_refresh_counter -eq 0 ]]; then
            load_toml_data
            load_environment_data
            data_refresh_counter=10  # Refresh every 10 keystrokes
        fi

        # SSH connectivity is expensive - check even less frequently
        if [[ $ssh_check_counter -eq 0 ]]; then
            load_ssh_connectivity
            ssh_check_counter=30  # Check SSH every 30 keystrokes
        fi

        # Generate ALL content in buffer first (complete double-buffering)
        local full_display=""

        # Header with mode selector and environment
        full_display+=$(render_header)
        full_display+=$'\n'

        # Main content based on mode + environment
        full_display+=$(render_mode_environment_content)

        # Calculate content lines for padding
        content_lines=$(echo "$full_display" | wc -l)

        # Add padding to push status to bottom (reserve 2 lines for compact design)
        local padding_needed=$((terminal_lines - content_lines - 2))
        if [[ $padding_needed -gt 0 ]]; then
            for ((i=0; i<$padding_needed; i++)); do
                full_display+=$'\n'
            done
        fi

        # Add status and navigation info
        full_display+=$(render_status_line)
        full_display+=$'\n'

        # Add compact navigation prompt
        if [[ "$TVIEW_MODE" == "repl" ]]; then
            full_display+="REPL> /tview=gamepad /exit=quit /help=commands | TSM: list start stop"$'\n'
        elif [[ $DRILL_LEVEL -eq 1 ]]; then
            full_display+="DRILL> i/k=nav j=back enter=detail | ESC=nav \`=repl q=quit"$'\n'
        else
            full_display+="NAV> e/m=env/mode i/k=items l=drill awsd=context | ESC=nav \`=repl q=quit"$'\n'
        fi

        # Only clear and redraw if content actually changed
        if [[ "$full_display" != "$last_display" ]]; then
            clear
            echo -n "$full_display"
            last_display="$full_display"
        fi

        # Decrement counters
        ((data_refresh_counter--))
        ((ssh_check_counter--))

        # Handle input based on current mode
        if [[ "$TVIEW_MODE" == "repl" ]]; then
            # REPL mode: read full line input
            echo -n "tview> "
            read -r input
            handle_repl_input "$input"
        else
            # Gamepad mode: read single character
            read -p "> " -n1 key
            handle_gamepad_input "$key"
        fi
    done
}

# Handle gamepad (single key) input
handle_gamepad_input() {
    local key="$1"

    case "$key" in
            'e'|'E')
                # Cycle through environments (left to right)
                navigate_environment "right"
                ;;
            'm'|'M')
                # Cycle through modes (left to right)
                navigate_mode "right"
                ;;
            'j'|'J')
                drill_out
                ;;
            $'\e')  # ESC key - idempotent return to gamepad mode (like vim)
                TVIEW_MODE="gamepad"
                DRILL_LEVEL=0  # Always exit drill when hitting ESC
                echo "ESC - returning to gamepad navigation mode"
                ;;
            'i'|'I')
                navigate_item "up"
                ;;
            'k'|'K')
                navigate_item "down"
                ;;
            'l'|'L')
                drill_into
                ;;
            '')  # Enter key
                show_item_modal
                ;;
            'q'|'Q')
                echo "Exiting tview..."
                exit 0
                ;;
            'r'|'R')
                # Force immediate data refresh
                data_refresh_counter=0
                ssh_check_counter=0
                ;;
            'h'|'H')
                show_tview_help
                ;;
            't'|'T')
                execute_tsm_command
                ;;
            'g'|'G')
                execute_git_command
                ;;
            'v'|'V')
                view_with_glow
                ;;
            'a'|'A')
                # Context-aware left navigation
                awsd_navigate "left"
                ;;
            'd'|'D')
                # Context-aware right navigation
                awsd_navigate "right"
                ;;
            'w'|'W')
                # Context-aware up navigation
                awsd_navigate "up"
                ;;
            's'|'S')
                # Context-aware down navigation
                awsd_navigate "down"
                ;;
            '`'|'~')
                # Backtick or tilde enters REPL mode
                enter_repl_mode
                ;;
            *)
                # Silently ignore unknown keys to maintain display flow
                ;;
        esac
}

# Enhanced modal key reader - simplified and more reliable
_tview_modal_read_key() {
    local timeout="${1:-5}"  # Shorter timeout for better UX

    echo "Press any key to continue (auto-exit in ${timeout}s)..."

    # Simple read with timeout
    if read -t "$timeout" -n1 -s; then
        return 0  # Key pressed - exit modal
    else
        return 0  # Timeout - also exit modal
    fi
}

# Terminal state preservation functions
_tview_save_terminal_state() {
    TVIEW_ORIGINAL_STTY=$(stty -g 2>/dev/null || echo "")
    TVIEW_ORIGINAL_TERM="${TERM:-xterm}"
}

_tview_restore_terminal_state() {
    if [[ -n "$TVIEW_ORIGINAL_STTY" ]]; then
        stty "$TVIEW_ORIGINAL_STTY" 2>/dev/null
    fi
    export TERM="$TVIEW_ORIGINAL_TERM"
    clear
    tput reset 2>/dev/null || true
    # Small delay to let terminal settle
    sleep 0.1
}

# Inline syntax highlighting fallback
_tview_inline_syntax_highlight() {
    local file="$1"

    # Try different highlighting tools in order of preference
    if command -v bat >/dev/null 2>&1; then
        bat --style=plain --color=always "$file" 2>/dev/null
    elif command -v highlight >/dev/null 2>&1; then
        highlight -O ansi "$file" 2>/dev/null
    else
        cat "$file"
    fi
}

# View with glow (syntax highlighting) or fallback
view_with_glow() {
    if [[ -n "$ACTIVE_TOML" && -f "$ACTIVE_TOML" ]]; then
        # Save terminal state before launching viewer
        _tview_save_terminal_state

        clear
        echo "${BOLD}${CYAN}Viewing: $ACTIVE_TOML${RESET}"
        echo "${YELLOW}Press 'q' to exit viewer and return to TView${RESET}"
        echo

        # Try viewers in preference order with different strategies
        local view_success=false

        if command -v glow >/dev/null 2>&1; then
            echo "${GREEN}Using glow for syntax highlighting...${RESET}"
            glow "$ACTIVE_TOML" && view_success=true
        elif command -v bat >/dev/null 2>&1; then
            echo "${GREEN}Using bat for syntax highlighting...${RESET}"
            bat "$ACTIVE_TOML" && view_success=true
        elif command -v less >/dev/null 2>&1; then
            echo "${GREEN}Using less for viewing...${RESET}"
            less "$ACTIVE_TOML" && view_success=true
        else
            echo "${YELLOW}Fallback to inline viewing with syntax highlighting...${RESET}"
            echo
            _tview_inline_syntax_highlight "$ACTIVE_TOML"
            echo
            echo "${YELLOW}Press any key to continue...${RESET}"
            read -n1 -s
            view_success=true
        fi

        # Restore terminal state
        _tview_restore_terminal_state

        if [[ "$view_success" == true ]]; then
            echo "${GREEN}Returned from viewer. Resuming TView...${RESET}"
        else
            echo "${RED}Viewer failed. Resuming TView...${RESET}"
        fi
        sleep 0.5
    else
        echo "No TOML file available to view"
        sleep 1
    fi
}