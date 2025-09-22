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
            full_display+="DRILL> i/k=nav j=back enter=detail | ESC=repl q=quit r=refresh"$'\n'
        else
            full_display+="NAV> e/m=env/mode i/k=items l=drill awsd=context | ESC=repl q=quit"$'\n'
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
                echo "Exiting tdash..."
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

# Handle REPL (line) input
handle_repl_input() {
    local input="$1"

    case "$input" in
        /tview)
            echo "Returning to gamepad mode..."
            TVIEW_MODE="gamepad"
            ;;
        /exit|/quit)
            echo "Exiting TView..."
            exit 0
            ;;
        /help)
            echo "TView REPL Commands:"
            echo "  /tview    Return to gamepad navigation mode"
            echo "  /exit     Exit TView completely"
            echo "  /help     Show this help"
            echo "  <empty>   Show TSM process list"
            echo "  <cmd>     Execute TSM command"
            echo "  !<cmd>    Execute bash command"
            ;;
        "")
            # Empty input - show current context info
            echo "Current: $CURRENT_MODE/$CURRENT_ENV"
            tsm list 2>/dev/null || echo "TSM not available"
            ;;
        !*)
            # Bash command
            local bash_cmd="${input#!}"
            if [[ -n "$bash_cmd" ]]; then
                eval "$bash_cmd" 2>&1
            fi
            ;;
        *)
            # Regular TSM command
            if [[ -n "$input" ]]; then
                eval "tsm $input" 2>&1
            fi
            ;;
    esac
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

# Drill into selected item (L key) - Smart contextual actions
drill_into() {
    if [[ $DRILL_LEVEL -eq 0 ]]; then
        # Execute context-specific action based on current mode and environment
        execute_drill_action "$CURRENT_MODE" "$CURRENT_ENV"
        DRILL_LEVEL=1
    fi
}

# Execute smart drill action based on context
execute_drill_action() {
    local mode="$1"
    local env="$2"
    local action_key="${mode}:${env}"

    case "$action_key" in
        "TOML:SYSTEM")
            # Drill into TOML system opens org selection REPL
            echo "Opening organization selection..."
            org_selection_repl
            ;;
        "TOML:LOCAL")
            # Drill into local TOML opens file editing
            echo "Opening local TOML editor..."
            toml_editor_repl
            ;;
        "TOML:DEV")
            if [[ -n "$DEV_IP" && "$DEV_IP" != "Unknown" ]]; then
                echo "Connecting to DEV environment..."
                ssh tetra@"$DEV_IP"
            else
                echo "DEV IP not configured"
            fi
            ;;
        "TOML:STAGING")
            if [[ -n "$STAGING_IP" && "$STAGING_IP" != "Unknown" ]]; then
                echo "Connecting to STAGING environment..."
                ssh tetra@"$STAGING_IP"
            else
                echo "STAGING IP not configured"
            fi
            ;;
        "TOML:PROD")
            if [[ -n "$PROD_IP" && "$PROD_IP" != "Unknown" ]]; then
                echo "Connecting to PROD environment..."
                ssh tetra@"$PROD_IP"
            else
                echo "PROD IP not configured"
            fi
            ;;
        "TSM:LOCAL")
            echo "Launching TSM REPL..."
            source "$TETRA_SRC/bash/tsm/tsm_repl.sh"
            tsm_repl_main
            ;;
        "TSM:DEV")
            if [[ -n "$DEV_IP" && "$DEV_IP" != "Unknown" ]]; then
                echo "Checking DEV services..."
                ssh tetra@"$DEV_IP" 'tsm list 2>/dev/null || echo "TSM not available on remote"'
            else
                echo "DEV IP not configured"
            fi
            ;;
        "TSM:STAGING")
            if [[ -n "$STAGING_IP" && "$STAGING_IP" != "Unknown" ]]; then
                echo "Checking STAGING services..."
                ssh tetra@"$STAGING_IP" 'tsm list 2>/dev/null || echo "TSM not available on remote"'
            else
                echo "STAGING IP not configured"
            fi
            ;;
        "TSM:PROD")
            if [[ -n "$PROD_IP" && "$PROD_IP" != "Unknown" ]]; then
                echo "Checking PROD services..."
                ssh tetra@"$PROD_IP" 'tsm list 2>/dev/null || echo "TSM not available on remote"'
            else
                echo "PROD IP not configured"
            fi
            ;;
        "TKM:DEV")
            if [[ -n "$DEV_IP" && "$DEV_IP" != "Unknown" ]]; then
                echo "Connecting to DEV as root for key management..."
                ssh root@"$DEV_IP"
            else
                echo "DEV IP not configured"
            fi
            ;;
        "TKM:STAGING")
            if [[ -n "$STAGING_IP" && "$STAGING_IP" != "Unknown" ]]; then
                echo "Connecting to STAGING as root for key management..."
                ssh root@"$STAGING_IP"
            else
                echo "STAGING IP not configured"
            fi
            ;;
        "TKM:PROD")
            if [[ -n "$PROD_IP" && "$PROD_IP" != "Unknown" ]]; then
                echo "Connecting to PROD as root for key management..."
                ssh root@"$PROD_IP"
            else
                echo "PROD IP not configured"
            fi
            ;;
        "ORG:DEV")
            if [[ -n "$ACTIVE_ORG" && "$ACTIVE_ORG" != "No active organization" ]]; then
                echo "Deploying $ACTIVE_ORG to DEV..."
                tetra org push "$ACTIVE_ORG" dev
            else
                echo "No active organization"
            fi
            ;;
        "ORG:STAGING")
            if [[ -n "$ACTIVE_ORG" && "$ACTIVE_ORG" != "No active organization" ]]; then
                echo "Deploying $ACTIVE_ORG to STAGING..."
                tetra org push "$ACTIVE_ORG" staging
            else
                echo "No active organization"
            fi
            ;;
        "ORG:PROD")
            if [[ -n "$ACTIVE_ORG" && "$ACTIVE_ORG" != "No active organization" ]]; then
                echo "Deploying $ACTIVE_ORG to PROD..."
                tetra org push "$ACTIVE_ORG" prod
            else
                echo "No active organization"
            fi
            ;;
        *)
            # Default drill behavior - just enter drill mode without action
            echo "Drilling into $mode - $env"
            ;;
    esac

    # Wait for user to see result before returning
    echo "Press any key to return to tview..."
    read -n1 -s
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

# AWSD contextual navigation based on current mode
awsd_navigate() {
    local direction="$1"

    case "$CURRENT_MODE" in
        "TOML")
            # TOML mode: Infrastructure-focused navigation
            case "$direction" in
                "left"|"right")
                    # Navigate between environments in infrastructure order
                    navigate_environment "$direction"
                    ;;
                "up"|"down")
                    # Navigate through config sections or drill levels
                    if [[ $DRILL_LEVEL -eq 1 ]]; then
                        scroll_content "$direction"
                    else
                        navigate_item "$direction"
                    fi
                    ;;
            esac
            ;;
        "TSM")
            # TSM mode: Service management navigation
            case "$direction" in
                "left"|"right")
                    # Switch between service types or environments
                    navigate_environment "$direction"
                    ;;
                "up"|"down")
                    # Navigate through service list
                    navigate_item "$direction"
                    ;;
            esac
            ;;
        "TKM")
            # TKM mode: Key/user focused navigation
            case "$direction" in
                "left"|"right")
                    # Switch between SSH users (when in drill mode) or environments
                    if [[ $DRILL_LEVEL -eq 1 ]]; then
                        # Cycle through SSH users: tetra → root → dev → tetra
                        cycle_ssh_user "$direction"
                    else
                        navigate_environment "$direction"
                    fi
                    ;;
                "up"|"down")
                    # Navigate through keys or actions
                    navigate_item "$direction"
                    ;;
            esac
            ;;
        "ORG")
            # ORG mode: Organization navigation
            case "$direction" in
                "left"|"right")
                    # Switch between organizations
                    cycle_organization "$direction"
                    ;;
                "up"|"down")
                    # Navigate deployment history or actions
                    navigate_item "$direction"
                    ;;
            esac
            ;;
        "DEPLOY")
            # DEPLOY mode: Deployment navigation
            case "$direction" in
                "left"|"right")
                    # Navigate between environments
                    navigate_environment "$direction"
                    ;;
                "up"|"down")
                    # Navigate through deployment actions
                    navigate_item "$direction"
                    ;;
            esac
            ;;
        *)
            # Fallback to standard navigation
            case "$direction" in
                "left"|"right")
                    navigate_environment "$direction"
                    ;;
                "up"|"down")
                    navigate_item "$direction"
                    ;;
            esac
            ;;
    esac
}

# Cycle through SSH users for TKM mode
cycle_ssh_user() {
    local direction="$1"
    # This would cycle through available SSH users for current environment
    # Implementation depends on how SSH users are stored
    echo "SSH user cycling not yet implemented"
}

# Cycle through organizations for ORG mode
cycle_organization() {
    local direction="$1"
    # This would cycle through available organizations
    # Implementation depends on organization storage
    echo "Organization cycling not yet implemented"
}

# Enter REPL mode
enter_repl_mode() {
    TVIEW_MODE="repl"
    echo "Entering REPL mode (type /tview to return to gamepad mode)..."
}

# Organization selection REPL for switching/managing orgs
org_selection_repl() {
    echo "═══════════════════════════════════════════════════════════════"
    echo "            ORGANIZATION SELECTION & MANAGEMENT"
    echo "═══════════════════════════════════════════════════════════════"
    echo
    echo "Current organization: ${ACTIVE_ORG:-None}"
    echo "TOML symlink: $(readlink "$TETRA_DIR/config/tetra.toml" 2>/dev/null || echo "Not set")"
    echo

    # List available organizations
    echo "Available organizations:"
    local org_count=0
    local orgs=()

    if [[ -d "$TETRA_DIR/orgs" ]]; then
        for org_dir in "$TETRA_DIR/orgs"/*; do
            if [[ -d "$org_dir" ]]; then
                local org_name=$(basename "$org_dir")
                local toml_file="$org_dir/tetra.toml"
                orgs+=("$org_name")

                if [[ "$org_name" == "${ACTIVE_ORG:-}" ]]; then
                    echo "  [$((++org_count))] → $org_name (active) $(if [[ -f "$toml_file" ]]; then echo "✓"; else echo "✗"; fi)"
                else
                    echo "  [$((++org_count))] → $org_name $(if [[ -f "$toml_file" ]]; then echo "✓"; else echo "✗"; fi)"
                fi
            fi
        done
    fi

    if [[ $org_count -eq 0 ]]; then
        echo "  No organizations found in $TETRA_DIR/orgs/"
        echo
        echo "Commands:"
        echo "  create <name>     Create new organization"
        echo "  template <name>   Create from template"
        echo "  exit              Return to tview"
    else
        echo
        echo "Commands:"
        echo "  <number>          Switch to organization by number"
        echo "  switch <name>     Switch to organization by name"
        echo "  create <name>     Create new organization"
        echo "  edit <name>       Edit organization files"
        echo "  link <name>       Create symlink to organization"
        echo "  unlink            Remove current symlink"
        echo "  exit              Return to tview"
    fi

    echo

    # Interactive loop
    while true; do
        echo -n "org> "
        read -r input

        case "$input" in
            ""|exit)
                echo "Returning to tview..."
                break
                ;;
            [0-9]*)
                # Switch by number
                local selected_num=$((input))
                if [[ $selected_num -gt 0 && $selected_num -le $org_count ]]; then
                    local selected_org="${orgs[$((selected_num - 1))]}"
                    echo "Switching to organization: $selected_org"
                    link_organization "$selected_org"
                else
                    echo "Invalid number. Use 1-$org_count"
                fi
                ;;
            switch\ *)
                local org_name="${input#switch }"
                echo "Switching to organization: $org_name"
                link_organization "$org_name"
                ;;
            link\ *)
                local org_name="${input#link }"
                echo "Creating symlink to organization: $org_name"
                link_organization "$org_name"
                ;;
            unlink)
                echo "Removing organization symlink..."
                rm -f "$TETRA_DIR/config/tetra.toml"
                echo "Symlink removed. Using local TOML files."
                ;;
            edit\ *)
                local org_name="${input#edit }"
                echo "Opening organization editor for: $org_name"
                toml_editor_repl "$org_name"
                ;;
            create\ *)
                local org_name="${input#create }"
                echo "Creating new organization: $org_name"
                create_organization "$org_name"
                ;;
            help)
                echo "Organization management commands listed above"
                ;;
            *)
                echo "Unknown command: $input"
                echo "Type 'help' for commands or 'exit' to return"
                ;;
        esac
        echo
    done
}

# Link to an organization (create symlink)
link_organization() {
    local org_name="$1"
    local org_dir="$TETRA_DIR/orgs/$org_name"
    local toml_file="$org_dir/tetra.toml"

    if [[ ! -d "$org_dir" ]]; then
        echo "Organization '$org_name' not found"
        return 1
    fi

    if [[ ! -f "$toml_file" ]]; then
        echo "No tetra.toml found in organization '$org_name'"
        return 1
    fi

    # Create config directory if it doesn't exist
    mkdir -p "$TETRA_DIR/config"

    # Remove existing symlink and create new one
    rm -f "$TETRA_DIR/config/tetra.toml"
    ln -sf "$toml_file" "$TETRA_DIR/config/tetra.toml"

    echo "✓ Linked to $org_name organization"
    echo "✓ Symlink: $TETRA_DIR/config/tetra.toml → $toml_file"

    # Reload data
    detect_active_toml
    load_toml_data
}

# TOML editor REPL for editing organization files
toml_editor_repl() {
    local org_name="${1:-$ACTIVE_ORG}"

    if [[ -z "$org_name" || "$org_name" == "No active organization" ]]; then
        echo "No organization specified or active"
        return 1
    fi

    local org_dir="$TETRA_DIR/orgs/$org_name"

    if [[ ! -d "$org_dir" ]]; then
        echo "Organization directory not found: $org_dir"
        return 1
    fi

    echo "═══════════════════════════════════════════════════════════════"
    echo "            ORGANIZATION FILE EDITOR: $org_name"
    echo "═══════════════════════════════════════════════════════════════"
    echo
    echo "Organization directory: $org_dir"
    echo
    echo "Available files:"
    ls -la "$org_dir" | grep -E '\.(toml|conf|env)$' | awk '{print "  " $9}'
    echo
    echo "Commands:"
    echo "  edit <file>       Edit file with \$EDITOR"
    echo "  view <file>       View file contents"
    echo "  ls                List all files"
    echo "  cd                Change to org directory (new shell)"
    echo "  validate          Validate TOML syntax"
    echo "  exit              Return to tview"
    echo

    while true; do
        echo -n "edit:$org_name> "
        read -r input

        case "$input" in
            ""|exit)
                echo "Returning to tview..."
                break
                ;;
            ls)
                echo "Files in $org_dir:"
                ls -la "$org_dir"
                ;;
            cd)
                echo "Opening new shell in $org_dir..."
                echo "Type 'exit' to return to tview"
                (cd "$org_dir" && bash)
                ;;
            edit\ *)
                local filename="${input#edit }"
                local filepath="$org_dir/$filename"

                if [[ -f "$filepath" ]]; then
                    ${EDITOR:-nano} "$filepath"
                    echo "✓ Edited $filename"
                else
                    echo "File not found: $filename"
                    echo "Available files: $(ls "$org_dir" | grep -E '\.(toml|conf|env)$' | tr '\n' ' ')"
                fi
                ;;
            view\ *)
                local filename="${input#view }"
                local filepath="$org_dir/$filename"

                if [[ -f "$filepath" ]]; then
                    echo "Contents of $filename:"
                    echo "────────────────────────────────────────"
                    cat "$filepath"
                    echo "────────────────────────────────────────"
                else
                    echo "File not found: $filename"
                fi
                ;;
            validate)
                local toml_file="$org_dir/tetra.toml"
                if [[ -f "$toml_file" ]]; then
                    echo "Validating $toml_file..."
                    if command -v toml_parse >/dev/null 2>&1; then
                        if toml_parse "$toml_file" "VALIDATE" 2>/dev/null; then
                            echo "✓ TOML syntax is valid"
                        else
                            echo "✗ TOML syntax errors found"
                        fi
                    else
                        echo "TOML parser not available for validation"
                    fi
                else
                    echo "No tetra.toml file found"
                fi
                ;;
            *)
                echo "Unknown command: $input"
                echo "Type 'help' for commands or 'exit' to return"
                ;;
        esac
        echo
    done
}

# Create new organization
create_organization() {
    local org_name="$1"
    local org_dir="$TETRA_DIR/orgs/$org_name"

    if [[ -d "$org_dir" ]]; then
        echo "Organization '$org_name' already exists"
        return 1
    fi

    echo "Creating organization: $org_name"
    mkdir -p "$org_dir"/{services,nginx,deployment,backups,deployed}

    # Create basic tetra.toml
    cat > "$org_dir/tetra.toml" << EOF
# $org_name Organization Configuration
# Generated on $(date)

[metadata]
name = "$org_name"
type = "custom"
description = "$org_name infrastructure"

[org]
name = "$org_name"
description = "$org_name infrastructure"
provider = "custom"

[infrastructure]
provider = "custom"

[environments.local]
description = "Local development environment"
domain = "localhost"
app_port = 3000
node_env = "development"

[domains]
base_domain = "example.com"
dev = "dev.example.com"
staging = "staging.example.com"
prod = "example.com"
EOF

    echo "✓ Created organization structure"
    echo "✓ Created basic tetra.toml"
    echo "Edit the configuration files to customize your infrastructure"
}

