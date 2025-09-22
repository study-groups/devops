#!/usr/bin/env bash

# TView Core - Main view logic and navigation

# Global state - Hierarchical navigation paradigm
CURRENT_ENV="LOCAL"      # SYSTEM | LOCAL | DEV | STAGING | PROD (primary navigation)
CURRENT_MODE="TOML"      # TOML | TKM | TSM | DEPLOY | ORG (secondary navigation)
CURRENT_ITEM=0           # Item within current environment+mode
DRILL_LEVEL=0            # 0=normal view, 1=drilled into item

# Available environments and modes (reordered for new hierarchy)
ENVIRONMENTS=("SYSTEM" "LOCAL" "DEV" "STAGING" "PROD")
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

        # Add padding to push status to bottom (reserve 4 lines)
        local padding_needed=$((terminal_lines - content_lines - 4))
        if [[ $padding_needed -gt 0 ]]; then
            for ((i=0; i<$padding_needed; i++)); do
                full_display+=$'\n'
            done
        fi

        # Add status and navigation info
        full_display+=$(render_status_line)
        full_display+=$'\n'

        # Add navigation prompt
        if [[ $DRILL_LEVEL -eq 1 ]]; then
            full_display+="[tview] DRILLED: i/k (up/down), j (back) | v (glow view)"$'\n'
            full_display+="Commands: e (env), m (mode), i/k (up/down), l (drill), j (back), enter, r, q, h, t, g"$'\n'
        else
            full_display+="[tview] e (env cycle), m (mode cycle), i/k (up/down), l (drill), j (back)"$'\n'
            full_display+="Commands: enter, r, q, h, t, g, v (glow view)"$'\n'
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

        read -p "> " -n1 key

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
            $'\e')  # ESC key for hierarchical navigation
                drill_out
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
                echo "Exiting tdash..."
                break
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
            *)
                # Silently ignore unknown keys to maintain display flow
                ;;
        esac
    done
}

# Navigate between modes (A/D keys)
navigate_mode() {
    local direction="$1"
    local current_idx

    # Find current mode index
    for i in "${!MODES[@]}"; do
        if [[ "${MODES[$i]}" == "$CURRENT_MODE" ]]; then
            current_idx=$i
            break
        fi
    done

    if [[ "$direction" == "left" ]]; then
        current_idx=$((current_idx - 1))
        if [[ $current_idx -lt 0 ]]; then
            current_idx=$((${#MODES[@]} - 1))
        fi
    else
        current_idx=$((current_idx + 1))
        if [[ $current_idx -ge ${#MODES[@]} ]]; then
            current_idx=0
        fi
    fi

    CURRENT_MODE="${MODES[$current_idx]}"
    CURRENT_ITEM=0  # Reset item when changing modes
    DRILL_LEVEL=0   # Reset drill level when changing modes
}

# Navigate between environments (W/E keys)
navigate_environment() {
    local direction="$1"
    local current_idx

    # Find current environment index
    for i in "${!ENVIRONMENTS[@]}"; do
        if [[ "${ENVIRONMENTS[$i]}" == "$CURRENT_ENV" ]]; then
            current_idx=$i
            break
        fi
    done

    if [[ "$direction" == "left" ]]; then
        current_idx=$((current_idx - 1))
        if [[ $current_idx -lt 0 ]]; then
            current_idx=$((${#ENVIRONMENTS[@]} - 1))
        fi
    else
        current_idx=$((current_idx + 1))
        if [[ $current_idx -ge ${#ENVIRONMENTS[@]} ]]; then
            current_idx=0
        fi
    fi

    CURRENT_ENV="${ENVIRONMENTS[$current_idx]}"
    CURRENT_ITEM=0  # Reset item when changing environments
    DRILL_LEVEL=0   # Reset drill level when changing environments
}

# Navigate items within current mode+environment (J/I/K/L keys)
navigate_item() {
    local direction="$1"
    local max_items=$(get_max_items_for_current_context)

    if [[ $max_items -le 1 ]]; then
        return  # No navigation needed for single items
    fi

    if [[ "$direction" == "down" || "$direction" == "right" ]]; then
        CURRENT_ITEM=$((CURRENT_ITEM + 1))
        if [[ $CURRENT_ITEM -ge $max_items ]]; then
            CURRENT_ITEM=0
        fi
    else
        CURRENT_ITEM=$((CURRENT_ITEM - 1))
        if [[ $CURRENT_ITEM -lt 0 ]]; then
            CURRENT_ITEM=$((max_items - 1))
        fi
    fi
}

# Drill into selected item (L key)
drill_into() {
    if [[ $DRILL_LEVEL -eq 0 ]]; then
        DRILL_LEVEL=1
    fi
}

# Drill out of item (J key)
drill_out() {
    if [[ $DRILL_LEVEL -eq 1 ]]; then
        DRILL_LEVEL=0
    fi
}

# Get maximum items for current environment+mode combination
get_max_items_for_current_context() {
    case "$CURRENT_ENV:$CURRENT_MODE" in
        "SYSTEM:TOML") echo 4 ;;     # TOML file, organization, project, status
        "LOCAL:TOML") echo 4 ;;      # Local config items
        "DEV:TOML") echo 5 ;;        # Dev server infrastructure items
        "STAGING:TOML") echo 5 ;;    # Staging server infrastructure items
        "PROD:TOML") echo 5 ;;       # Prod server infrastructure items
        "SYSTEM:TKM") echo 2 ;;      # Key status, known hosts
        "LOCAL:TKM") echo 3 ;;       # Local keys, SSH config, status
        *":TKM") echo 2 ;;           # SSH connectivity, key deployment
        "SYSTEM:TSM") echo 2 ;;      # Service manager status
        "LOCAL:TSM")
            if [[ -n "$TSM_SERVICES" ]]; then
                echo $(echo "$TSM_SERVICES" | wc -l)
            else
                echo 1
            fi
            ;;
        *":TSM") echo 2 ;;           # Remote service status (if SSH connected)
        "SYSTEM:DEPLOY") echo 2 ;;   # Deploy status overview
        "LOCAL:DEPLOY") echo 3 ;;    # Git status, artifacts, deploy readiness
        *":DEPLOY") echo 3 ;;        # Deployment status, last deploy, actions
        "SYSTEM:ORG") echo 3 ;;      # Organization overview, total orgs, status
        "LOCAL:ORG") echo 4 ;;       # Create, switch, templates, settings
        *":ORG") echo 3 ;;           # Push/pull config, sync status
        *) echo 1 ;;
    esac
}

# Scrolling functionality
scroll_content() {
    local direction="$1"
    local max_lines=${LINES:-24}
    local content_lines=$((max_lines - 8))  # Reserve space for header and status

    if [[ "$FILE_VIEW_MODE" == "true" ]]; then
        # Scrolling in file view mode
        if [[ "$direction" == "up" ]]; then
            SCROLL_OFFSET=$((SCROLL_OFFSET - 3))
            if [[ $SCROLL_OFFSET -lt 0 ]]; then
                SCROLL_OFFSET=0
            fi
        else
            local max_scroll=$((FILE_VIEW_LINES - content_lines))
            if [[ $max_scroll -lt 0 ]]; then max_scroll=0; fi
            SCROLL_OFFSET=$((SCROLL_OFFSET + 3))
            if [[ $SCROLL_OFFSET -gt $max_scroll ]]; then
                SCROLL_OFFSET=$max_scroll
            fi
        fi
    else
        # Regular content scrolling - for future implementation
        # Currently just reset scroll when changing contexts
        if [[ "$direction" == "up" ]]; then
            SCROLL_OFFSET=$((SCROLL_OFFSET - 1))
            if [[ $SCROLL_OFFSET -lt 0 ]]; then
                SCROLL_OFFSET=0
            fi
        else
            SCROLL_OFFSET=$((SCROLL_OFFSET + 1))
            # Limit scrolling based on content
            if [[ $SCROLL_OFFSET -gt 10 ]]; then
                SCROLL_OFFSET=10
            fi
        fi
    fi
}

# Enter full file view mode
enter_file_view() {
    local file_path="$1"
    if [[ -f "$file_path" ]]; then
        FILE_VIEW_MODE=true
        FILE_VIEW_CONTENT=$(cat "$file_path")
        FILE_VIEW_LINES=$(echo "$FILE_VIEW_CONTENT" | wc -l)
        SCROLL_OFFSET=0
    fi
}

# Exit file view mode
exit_file_view() {
    FILE_VIEW_MODE=false
    FILE_VIEW_CONTENT=""
    FILE_VIEW_LINES=0
    SCROLL_OFFSET=0
}

# Drill mode navigation (AWSD controls)
drill_navigate() {
    local direction="$1"
    case "$direction" in
        "up"|"down")
            # Scroll content in drill mode
            scroll_content "$direction"
            ;;
        "left"|"right")
            # Navigate between drill items if applicable
            navigate_item "$direction"
            ;;
    esac
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

# Enhanced modal key reader with multiple exit strategies
_tview_modal_read_key() {
    local timeout="${1:-30}"
    local key=""

    # Try to read a key with timeout
    if read -t "$timeout" -n1 -s key 2>/dev/null; then
        case "$key" in
            $'\e'|'q'|'Q'|$'\x1b')
                return 0  # Exit requested
                ;;
            *)
                return 1  # Continue modal
                ;;
        esac
    else
        # Timeout or read failed - auto-exit
        return 0
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