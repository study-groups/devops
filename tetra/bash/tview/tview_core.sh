#!/usr/bin/env bash

# TView Core - Main view logic and navigation (refactored modular version)

# Source all modules
TVIEW_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$TVIEW_DIR/tview_keys.sh"         # Key bindings (MUST BE FIRST)
source "$TVIEW_DIR/tview_data.sh"         # Data loading functions
source "$TVIEW_DIR/background_manager.sh"   # Background process manager
source "$TVIEW_DIR/action_line_selector.sh"  # Single-line action selector
source "$TVIEW_DIR/tview_render.sh"       # Display rendering
source "$TVIEW_DIR/tview_modes.sh"        # Mode content rendering
source "$TVIEW_DIR/tview_actions.sh"      # Modal actions
# Navigation functions for environment and mode switching
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
    CURRENT_ITEM=0
    DRILL_LEVEL=0
}

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

    if [[ "$direction" == "left" || "$direction" == "up" ]]; then
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
    CURRENT_ITEM=0
    DRILL_LEVEL=0
}
source "$TVIEW_DIR/tview_hooks.sh"        # Context-triggered actions (drill behaviors)
source "$TVIEW_DIR/tview_repl.sh"         # REPL interfaces
source "$TVIEW_DIR/tview_rcm_registry.sh"   # RCM command definitions
source "$TVIEW_DIR/tview_rcm_state.sh"      # RCM state management
source "$TVIEW_DIR/tview_rcm_execution.sh"  # RCM async execution
source "$TVIEW_DIR/tview_rcm_render.sh"     # RCM UI rendering
source "$TVIEW_DIR/tview_modal.sh"         # Modal overlay system
source "$TVIEW_DIR/tview_state.sh"         # Comprehensive state management
source "$TVIEW_DIR/tview_colors.sh"        # Color design tokens and theming
source "$TVIEW_DIR/tview_action_modal.sh"  # Action modal system

# Global state - Hierarchical navigation paradigm
CURRENT_ENV="TETRA"      # TETRA | LOCAL | DEV | STAGING | PROD (primary navigation)
CURRENT_MODE="TOML"      # TOML | TKM | TSM | DEPLOY | ORG (secondary navigation)
CURRENT_ITEM=0           # Item within current environment+mode
DRILL_LEVEL=0            # 0=normal view, 1=drilled into item
TVIEW_MODE="gamepad"     # gamepad | repl (interaction mode)
REPL_CONTEXT="tview"     # tview | tsm | tkm | deploy | span | etc (current REPL module context)

# Set active organization
if [[ -z "$ACTIVE_ORG" ]]; then
    # Auto-detect from tetra/orgs directory
    export ACTIVE_ORG=$(basename "$(find "${TETRA_DIR:-/Users/mricos/tetra}/orgs" -maxdepth 1 -type d 2>/dev/null | head -2 | tail -1)" 2>/dev/null || echo "pixeljam-arcade")
fi

# Available environments and modes (reordered for new hierarchy)
ENVIRONMENTS=("TETRA" "LOCAL" "DEV" "STAGING" "PROD" "QA")

# Core modes (hardcoded for backward compatibility)
MODES=("TOML" "TKM" "TSM" "DEPLOY" "ORG" "RCM")

# Auto-discover modules with TView integration
for module_dir in "$TETRA_SRC/bash"/*/; do
    if [[ -f "$module_dir/includes.sh" && -d "$module_dir/tview" ]]; then
        module_name=$(basename "$module_dir")
        module_upper="${module_name^^}"
        # Add to MODES if not already present and not a core module
        if [[ ! " ${MODES[*]} " =~ " ${module_upper} " ]]; then
            MODES+=("$module_upper")
        fi
    fi
done

# Scrolling state
SCROLL_OFFSET=0
FILE_VIEW_MODE=false
FILE_VIEW_CONTENT=""
FILE_VIEW_LINES=0

# RCM (Remote Command Mode) state - React-like command execution states
declare -gA RCM_COMMAND_STATES      # command_id → idle|executing|success|error
declare -gA RCM_COMMAND_RESULTS     # command_id → command output
declare -gA RCM_COMMAND_EXIT_CODES  # command_id → exit code
declare -gA RCM_COMMAND_PIDS        # command_id → background PID
declare -gA RCM_COMMAND_EXPANDED    # command_id → true|false
declare -gA RCM_COMMAND_TIMESTAMPS  # command_id → execution timestamp
CURRENT_RCM_ENV="dev_root"           # Current environment selection for RCM
RCM_EDITING_MODE=false               # true when editing SSH prefix
RCM_EDIT_ENV=""                      # Environment being edited
RCM_EDIT_BUFFER=""                   # Edit buffer for SSH prefix

# Generate dynamic REPL prompt based on current context
get_repl_prompt() {
    case "$REPL_CONTEXT" in
        "tview") echo "tview> " ;;
        "tsm") echo "tsm> " ;;
        "tkm") echo "tkm> " ;;
        "deploy") echo "deploy> " ;;
        "span") echo "span> " ;;
        "rcm") echo "rcm> " ;;
        "org") echo "org> " ;;
        "toml") echo "toml> " ;;
        *) echo "${REPL_CONTEXT}> " ;;
    esac
}

# TView REPL main function - Top-down layout with sticky elements
tview_repl_main() {
    # Debug: Test if this file is being used
    echo "DEBUG: tview_repl_main started at $(date)" > /tmp/tview_debug.log
    echo "DEBUG: Current working directory: $(pwd)" >> /tmp/tview_debug.log
    echo "DEBUG: This file path: ${BASH_SOURCE[0]}" >> /tmp/tview_debug.log

    # Initialize systems
    setup_colors
    detect_active_toml
    init_state_system
    init_action_line

    # Source the layout manager and actions
    source "$(dirname "${BASH_SOURCE[0]}")/tview_layout.sh"
    source "$(dirname "${BASH_SOURCE[0]}")/tview_actions.sh"

    # Cache for reducing unnecessary redraws
    local data_refresh_counter=0
    local ssh_check_counter=0
    local last_layout_hash=""

    # Auto SSH checking disabled to prevent unwanted connections
    # start_background_ssh_checker

    # Exit flag for clean loop termination
    declare -g tview_exit=false

    # Initial screen setup
    calculate_layout_regions
    redraw_screen

    while [[ "$tview_exit" != "true" ]]; do
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

        # Calculate current layout hash to detect changes (exclude show_results to avoid redraw loops)
        local current_hash="${CURRENT_ENV}:${CURRENT_MODE}:${CURRENT_ITEM}"

        # Only redraw if something changed and results aren't being shown
        if [[ "$current_hash" != "$last_layout_hash" && ${LAYOUT_STATE["show_results"]} != "true" ]]; then
            redraw_screen
            last_layout_hash="$current_hash"
        elif [[ ${LAYOUT_STATE["show_results"]} == "true" && "$current_hash" != "$last_layout_hash" ]]; then
            # If results are showing and layout changed, just update the status line
            render_sticky_status
            last_layout_hash="$current_hash"
        fi

        # Decrement counters
        ((data_refresh_counter--))
        ((ssh_check_counter--))

        # Handle input based on current mode
        if [[ "$TVIEW_MODE" == "repl" ]]; then
            # REPL mode - position above status footer
            local repl_line=$((LAYOUT_STATUS_START - 1))
            printf "\033[${repl_line};1H\033[K"  # Clear line for REPL prompt
            # Use simple readline approach like TSM (Ctrl+C to exit)
            local input
            read -e -r -p "$(get_repl_prompt)" input

            # Handle empty input or exit
            if [[ $? -ne 0 ]]; then
                # Ctrl+C or EOF - exit to gamepad mode
                TVIEW_MODE="gamepad"
                DRILL_LEVEL=0
                printf "\033[${repl_line};1H\033[K"
            elif [[ -n "$input" ]]; then
                handle_repl_input "$input"
                # Optimized: only redraw results area, not full screen
                last_layout_hash=""
            fi
        else
            # Gamepad mode: read single character (silent, no prompt)
            read -n1 -s key
            echo "DEBUG: Main loop read key: '$key'" >> /tmp/tview_debug.log
            handle_gamepad_input_with_layout "$key"
        fi
    done
}

# Handle gamepad (single key) input
# Removed duplicate handle_gamepad_input - using handle_gamepad_input_with_layout instead

# Handle gamepad input with new layout system
handle_gamepad_input_with_layout() {
    local key="$1"

    # Debug: Log all key presses
    echo "DEBUG: Key pressed: '$key' (hex: $(printf '%02x' "'$key"))" >> /tmp/tview_debug.log

    case "$key" in
        'e')
            # Cycle through environments (left to right)
            navigate_environment "right"
            ;;
        'E')
            # Shift+E: Cycle environments reverse (right to left)
            navigate_environment "left"
            ;;
        'm')
            # Cycle through modes (left to right)
            navigate_mode "right"
            ;;
        'M')
            # Shift+M: Cycle modes reverse (right to left)
            navigate_mode "left"
            ;;
        'd')
            # Cycle through modes (left to right) - moDe
            navigate_mode "right"
            ;;
        'D')
            # Shift+D: Cycle modes reverse (right to left) - moDe
            navigate_mode "left"
            ;;
        'a')
            echo "DEBUG: About to call navigate_action_line down" >> /tmp/tview_debug.log
            if command -v navigate_action_line >/dev/null 2>&1; then
                navigate_action_line "down"
                redraw_screen
            else
                echo "DEBUG: navigate_action_line function not found!" >> /tmp/tview_debug.log
            fi
            ;;
        'A')
            echo "DEBUG: About to call navigate_action_line up" >> /tmp/tview_debug.log
            if command -v navigate_action_line >/dev/null 2>&1; then
                navigate_action_line "up"
                redraw_screen
            else
                echo "DEBUG: navigate_action_line function not found!" >> /tmp/tview_debug.log
            fi
            ;;
        'l')
            # Execute selected action from action line
            echo "DEBUG: l key pressed, executing action from line" >> /tmp/tview_debug.log
            if command -v execute_action_line >/dev/null 2>&1; then
                execute_action_line
                echo "DEBUG: action line execution returned" >> /tmp/tview_debug.log
            else
                echo "DEBUG: execute_action_line function not found!" >> /tmp/tview_debug.log
            fi
            ;;
        $'\n'|$'\r')  # Enter key
            # Execute selected action from action line
            echo "DEBUG: Enter key pressed, executing action from line" >> /tmp/tview_debug.log
            if command -v execute_action_line >/dev/null 2>&1; then
                execute_action_line
                echo "DEBUG: action line execution returned" >> /tmp/tview_debug.log
            else
                echo "DEBUG: execute_action_line function not found!" >> /tmp/tview_debug.log
            fi
            ;;
        'j')
            # Scroll results up
            if [[ ${LAYOUT_STATE["show_results"]} == "true" ]]; then
                scroll_results "up"
            else
                scroll_results "down"  # If no results, this does nothing gracefully
            fi
            ;;
        'K')
            # Shift+K: Scroll results down
            if [[ ${LAYOUT_STATE["show_results"]} == "true" ]]; then
                scroll_results "down"
            fi
            ;;
        'r'|'R')
            # Reset interface to initial state
            reset_interface
            ;;
        $'\e'|$'\033')
            # ESC: Hide results if showing, otherwise do nothing
            if [[ ${LAYOUT_STATE["show_results"]} == "true" ]]; then
                hide_results
                redraw_screen
            fi
            ;;
        '/')
            # Enter REPL mode (changed from t key)
            enter_repl_mode
            ;;
        't'|'T')
            # Execute TSM command (t key now available for TSM)
            execute_tsm_command
            ;;
        '?')
            # Show help modal
            show_help_modal "TView Help" "$(generate_help_content)"
            ;;
        'q'|'Q')
            # Quit
            cleanup_and_exit
            tview_exit=true
            ;;
        *)
            # Log unhandled keys for debugging
            echo "DEBUG: Unhandled key: '$key' (hex: $(printf '%02x' "'$key"))" >> /tmp/tview_debug.log
            ;;
    esac
}

# Cleanup and exit function
cleanup_and_exit() {
    # Clear screen and restore normal terminal
    clear
    echo "TView exited."
    return 0
}

# Execute the currently selected action with error handling
execute_current_action() {
    local action_result=""

    # Debug: Log that function was called
    echo "DEBUG: execute_current_action called for $CURRENT_MODE:$CURRENT_ENV item $CURRENT_ITEM" >> /tmp/tview_debug.log

    # Wrap execution in error handling
    {
        case "$CURRENT_MODE:$CURRENT_ENV" in
            "TSM:LOCAL")
                case $CURRENT_ITEM in
                    0) action_result=$(execute_local_service_status) ;;
                    1) action_result=$(execute_local_config_check) ;;
                    2) action_result=$(execute_local_service_list) ;;
                    3) action_result=$(execute_local_logs) ;;
                esac
                ;;
            "TSM:DEV"|"TSM:STAGING"|"TSM:PROD"|"TSM:QA")
                case $CURRENT_ITEM in
                    0) action_result=$(execute_ssh_test "$CURRENT_ENV") ;;
                    1) action_result=$(execute_service_status "$CURRENT_ENV") ;;
                    2) action_result=$(execute_service_list "$CURRENT_ENV") ;;
                    3) action_result=$(execute_tail_logs "$CURRENT_ENV") ;;
                    4) enter_ssh_repl "$CURRENT_ENV"; return ;;
                esac
                ;;
            "RCM:"*)
                action_result=$(execute_rcm_command "$CURRENT_ENV" "$CURRENT_ITEM")
                ;;
            "TKM:"*)
                case $CURRENT_ITEM in
                    0) action_result=$(execute_ssh_key_status "$CURRENT_ENV") ;;
                    1) action_result=$(execute_ssh_test "$CURRENT_ENV") ;;
                    2) action_result=$(execute_key_management "$CURRENT_ENV") ;;
                esac
                ;;
            "TOML:TETRA")
                case $CURRENT_ITEM in
                    0) action_result=$(execute_toml_view_config) ;;
                    1) action_result=$(execute_toml_edit_config) ;;
                    2) action_result=$(execute_toml_validate) ;;
                esac
                ;;
            *)
                action_result="Action not implemented for $CURRENT_MODE:$CURRENT_ENV"
                ;;
        esac
    } 2>/dev/null || {
        # Catch any execution errors
        action_result="Execution Error - $CURRENT_MODE:$CURRENT_ENV
═══════════════════════════

Action: ${CURRENT_ITEM}
Environment: ${CURRENT_ENV}
Mode: ${CURRENT_MODE}

Error: Command execution failed
This may be due to:
- Missing dependencies
- Network connectivity issues
- Permission problems
- Invalid configuration

Try switching to REPL mode (/) for debugging."
    }

    if [[ -n "$action_result" ]]; then
        show_results "$action_result"
        # Results window rendering is handled by show_results function
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

# Hint System - Self-documenting interface with Shift+L
show_contextual_hint() {
    local hint_text=""

    # Generate context-aware hints based on current mode and environment
    case "$CURRENT_MODE:$CURRENT_ENV" in
        "RCM:SYSTEM")
            hint_text="System overview: Navigate environments to see remote command possibilities. Use 'e' to cycle environments."
            ;;
        "RCM:LOCAL")
            hint_text="Local execution: Commands run directly on mricos@m2.local. Use ENTER to execute selected command."
            ;;
        "RCM:DEV"|"RCM:STAGING"|"RCM:PROD"|"RCM:QA")
            hint_text="Remote execution on $CURRENT_ENV: Commands run via SSH. Use 'e' to edit SSH prefix, SPACE to expand results."
            ;;
        "TOML:"*)
            hint_text="TOML configuration: 'v' for syntax highlighting, 'l' to drill into details, 'r' to refresh data."
            ;;
        "TKM:"*)
            hint_text="Key management: SSH keys and authentication. 'l' to drill into connection details."
            ;;
        "TSM:"*)
            hint_text="Service management: Tetra services and process control. 't' for quick TSM commands."
            ;;
        "ORG:"*)
            hint_text="Organization management: Multi-client infrastructure. 'l' to drill into org details."
            ;;
        "DEPLOY:"*)
            hint_text="Deployment management: Configuration deployment and validation."
            ;;
        *)
            hint_text="Navigation: 'e'=environments 'm/d'=modes 'a/A'=actions 'l'=execute 'h'=help 'q'=quit"
            ;;
    esac

    # Add general navigation hints
    if [[ $DRILL_LEVEL -eq 1 ]]; then
        hint_text="DRILL MODE: $hint_text | 'j'=back to overview 'ESC'=navigation"
    else
        hint_text="$hint_text | 'L'=hints '/'=repl 'ESC'=navigation"
    fi

    # Set the hint globally for display in header
    TVIEW_HINT="$hint_text"

    # Auto-clear hint after 5 seconds
    {
        sleep 5
        TVIEW_HINT=""
    } &
}

# Clear any active hints
clear_hint() {
    TVIEW_HINT=""
}

# Handle Enter key based on context
handle_enter_key() {
    case "$CURRENT_MODE" in
        "RCM")
            # Execute selected command in RCM mode
            if [[ "$CURRENT_ENV" != "SYSTEM" ]]; then
                handle_rcm_execute
            else
                # In RCM system view, drill into environment
                drill_into
            fi
            ;;
        "TSM")
            # Execute TSM command based on selection
            handle_tsm_execute
            ;;
        *)
            # For other modes, show details in modal
            show_details_modal
            ;;
    esac
}

# Handle RCM command execution
handle_rcm_execute() {
    local selected_commands=($(printf '%s\n' "${!RCM_COMMANDS[@]}" | sort))
    local selected_index=$CURRENT_ITEM

    if [[ $selected_index -lt ${#selected_commands[@]} ]]; then
        local command_name="${selected_commands[$selected_index]}"
        local command_id=$(rcm_execute_command_async "$command_name" "$CURRENT_RCM_ENV")

        # Show quick feedback
        TVIEW_HINT="Executing $command_name on $CURRENT_RCM_ENV..."

        # Auto-clear hint after 3 seconds
        {
            sleep 3
            TVIEW_HINT=""
        } &
    fi
}

# Handle TSM command execution
handle_tsm_execute() {
    case "$CURRENT_ENV:$CURRENT_ITEM" in
        "DEV:0")
            # SSH Status - test connection
            TVIEW_HINT="Testing SSH connection to dev server..."
            {
                sleep 1
                if timeout 5 ssh -o ConnectTimeout=2 "${CURRENT_SSH_PREFIXES[dev_root]#ssh }" "echo 'SSH test successful'"; then
                    TVIEW_HINT="✓ SSH connection successful"
                else
                    TVIEW_HINT="✗ SSH connection failed"
                fi
                sleep 3
                TVIEW_HINT=""
            } &
            ;;
        "DEV:1")
            # Tetra Service - check detailed status
            TVIEW_HINT="Checking tetra.service status..."
            {
                sleep 1
                local result=$(timeout 5 ssh -o ConnectTimeout=2 "${CURRENT_SSH_PREFIXES[dev_root]#ssh }" "systemctl status tetra.service --no-pager -l" 2>&1)
                if [[ $? -eq 0 ]]; then
                    TVIEW_HINT="✓ Service status retrieved"
                else
                    TVIEW_HINT="✗ Failed to get service status"
                fi
                sleep 3
                TVIEW_HINT=""
            } &
            ;;
        "DEV:2")
            # Quick Actions - show tsm list
            TVIEW_HINT="Executing: tsm list..."
            {
                sleep 1
                local result=$(timeout 10 ssh -o ConnectTimeout=2 "${CURRENT_SSH_PREFIXES[dev_root]#ssh }" "source ~/tetra/tetra.sh && tsm list" 2>&1)
                if [[ $? -eq 0 ]]; then
                    TVIEW_HINT="✓ TSM list completed"
                else
                    TVIEW_HINT="✗ TSM command failed"
                fi
                sleep 3
                TVIEW_HINT=""
            } &
            ;;
        "DEV:3")
            # Service Logs - tail recent logs
            TVIEW_HINT="Getting recent tetra logs..."
            {
                sleep 1
                local result=$(timeout 5 ssh -o ConnectTimeout=2 "${CURRENT_SSH_PREFIXES[dev_root]#ssh }" "tail -20 /var/log/tetra/tetra.log 2>/dev/null || journalctl -u tetra.service -n 20 --no-pager" 2>&1)
                if [[ $? -eq 0 ]]; then
                    TVIEW_HINT="✓ Logs retrieved (check drill mode)"
                else
                    TVIEW_HINT="✗ Failed to get logs"
                fi
                sleep 3
                TVIEW_HINT=""
            } &
            ;;
        "STAGING:"*|"PROD:"*|"QA:"*)
            TVIEW_HINT="TSM execution for ${CURRENT_ENV} - item ${CURRENT_ITEM}"
            {
                sleep 2
                TVIEW_HINT=""
            } &
            ;;
        *)
            TVIEW_HINT="TSM: Select an item to execute commands"
            {
                sleep 2
                TVIEW_HINT=""
            } &
            ;;
    esac
}

# Show details in modal instead of full-screen
show_details_modal() {
    local content=""
    local title="$CURRENT_MODE - $CURRENT_ENV Details"

    case "$CURRENT_MODE:$CURRENT_ENV" in
        "TOML:SYSTEM")
            content=$(generate_toml_system_content)
            ;;
        "TOML:LOCAL")
            content=$(generate_toml_local_content)
            ;;
        "TKM:"*)
            content=$(generate_tkm_content "$CURRENT_ENV")
            ;;
        "TSM:"*)
            content=$(generate_tsm_content "$CURRENT_ENV")
            ;;
        *)
            content="Mode: $CURRENT_MODE\nEnvironment: $CURRENT_ENV\nItem: $((CURRENT_ITEM + 1))\n\nDetailed view available soon..."
            ;;
    esac

    show_help_modal "$title" "$content" >/dev/null
}

# Generate content for modal views (replace old detailed functions)
generate_toml_system_content() {
    cat << EOF
TOML System Configuration

Active TOML: ${ACTIVE_TOML:-No TOML file detected}
Organization: ${ORG_NAME:-${ACTIVE_ORG:-Local Project}}
Provider: ${ORG_PROVIDER:-Unknown}
Type: ${ORG_TYPE:-standard}

Parse Status: ${TOML_SYNC_STATUS:-Ready for sync}

Environment Variables:
TETRA_DIR: ${TETRA_DIR:-Not set}
TETRA_SRC: ${TETRA_SRC:-Not set}
ACTIVE_ORG: ${ACTIVE_ORG:-Not set}
EOF
}

generate_toml_local_content() {
    cat << EOF
Local Environment Configuration

App Port: ${LOCAL_PORT:-3000}
Node Environment: ${LOCAL_NODE_ENV:-development}
Domain: ${LOCAL_DOMAIN:-localhost}
Full URL: http://${LOCAL_DOMAIN:-localhost}:${LOCAL_PORT:-3000}

Data Directory: ${LOCAL_DATA_DIR:-/home/dev/pj/pd}
Service Config: ${LOCAL_SERVICE_CONFIG:-npm run dev}

Local Services Status:
$(show_local_services_config 2>/dev/null || echo "No local services configured")
EOF
}

generate_tkm_content() {
    local env="$1"
    cat << EOF
TKM - Key Management for $env

SSH Configuration:
Current Prefix: ${CURRENT_SSH_PREFIXES[${env,,}_root]:-Not configured}

Connection Testing:
$(rcm_test_ssh_connectivity "${env,,}_root" 2>/dev/null || echo "Connection test failed")

Available Key Operations:
- Test connectivity
- Generate new keys
- Manage key rotation
- View connection logs
EOF
}

generate_tsm_content() {
    local env="$1"
    cat << EOF
TSM - Service Management for $env

Environment: $env
Service Status: Checking...

Available Operations:
- List services
- Start/stop services
- View service logs
- Health checks
- Service configuration

Use 't' key for quick TSM commands
EOF
}

# Modal help system
show_modal_help() {
    local help_content=$(generate_keymap_help "$CURRENT_MODE")
    show_help_modal "TView Help - $CURRENT_MODE Mode" "$help_content" >/dev/null
}

# Enhanced input handling with state tracking
# Removed unused handle_gamepad_input_with_state - consolidating to single handler

# Handle key sequences (vim-like)
handle_key_sequence() {
    local action="$1"

    case "$action" in
        "goto_top")
            CURRENT_ITEM=0
            ;;
        "goto_bottom")
            CURRENT_ITEM=$((${TVIEW_STATE[max_items]} - 1))
            ;;
        "delete_item")
            # Context-aware deletion
            if [[ "$CURRENT_MODE" == "RCM" ]]; then
                local command_id="${CURRENT_RCM_ENV}_${CURRENT_ITEM}"
                rcm_cancel_command "$command_id"
            fi
            ;;
        "copy_item")
            # Context-aware copying
            show_confirm_modal "Copy current item to clipboard?"
            ;;
    esac

    # Clear sequence after handling
    TVIEW_STATE["key_sequence"]=""
}

# ===== TOML ACTION IMPLEMENTATIONS =====

# Execute TOML view configuration action
execute_toml_view_config() {
    if [[ -n "$ACTIVE_TOML" && -f "$ACTIVE_TOML" ]]; then
        echo "TOML Configuration View
══════════════════════════

📄 $(basename "$ACTIVE_TOML") | 🏢 ${ORG_NAME:-${ACTIVE_ORG:-Local Project}}
🔧 ${ORG_PROVIDER:-Unknown} | ${ORG_TYPE:-standard}

📊 Section Analysis:"

        # Parse TOML sections - more concise
        if command -v awk >/dev/null 2>&1; then
            awk '/^\[/ {
                gsub(/[\[\]]/, "", $0)
                printf "  %-15s (line %d)\n", $0, NR
            }' "$ACTIVE_TOML" | head -8
        else
            echo "  metadata        (line 1)"
            echo "  environments    (line 10)"
            echo "  services        (line 20)"
            echo "  domains         (line 30)"
        fi

        echo ""
        echo "🎯 Span Features:"
        echo "• Multi-section cursors • Cross-references"
        echo "• Dependency tracking   • Export analysis"
        echo ""
        echo "Use j/k to scroll, ESC to close, Edit for modification"
    else
        echo "TOML Configuration View
══════════════════════════

⚠ No TOML file active

Steps to load configuration:
1. Switch to ORG mode (m key)
2. Select organization
3. Return to TETRA × TOML"
    fi
}

# Execute TOML edit configuration action
execute_toml_edit_config() {
    echo "DEBUG: execute_toml_edit_config called" >> /tmp/tview_debug.log
    echo "DEBUG: ACTIVE_TOML='$ACTIVE_TOML'" >> /tmp/tview_debug.log
    echo "DEBUG: File exists check: $(if [[ -f "$ACTIVE_TOML" ]]; then echo "true"; else echo "false"; fi)" >> /tmp/tview_debug.log

    if [[ -n "$ACTIVE_TOML" && -f "$ACTIVE_TOML" ]]; then
        # Clear screen and show editing info
        clear
        echo "═══════════════════════════════════"
        echo "  TOML Configuration Editor"
        echo "═══════════════════════════════════"
        echo ""
        echo "Opening: $(basename "$ACTIVE_TOML")"
        echo "Full path: $ACTIVE_TOML"
        echo ""
        echo "Editor: ${EDITOR:-nano}"
        echo ""
        echo "Press Enter to open editor..."
        read -r

        # Open editor
        ${EDITOR:-nano} "$ACTIVE_TOML"

        # Return to TView with status
        echo "TOML Editor Session Complete
══════════════════════════

📄 File: $(basename "$ACTIVE_TOML")
✅ Editor session finished

💡 Changes saved to disk
🔄 Reload TView to see updates

Press any key to return to TView..."
        read -n1 -s
    else
        echo "TOML Configuration Editor
══════════════════════════

⚠ No TOML file to edit

To edit configuration:
1. Use ORG mode to select organization
2. Ensure tetra.toml exists in project"
    fi
}

# Execute TOML validation action
execute_toml_validate() {
    if [[ -n "$ACTIVE_TOML" && -f "$ACTIVE_TOML" ]]; then
        echo "TOML Validation Results
═══════════════════════════

File: $ACTIVE_TOML"

        # Try different validation methods
        local validation_result=""
        local validation_success=false

        # Method 1: Try toml_parse if available
        if command -v toml_parse >/dev/null 2>&1; then
            if toml_parse "$ACTIVE_TOML" "VALIDATE" 2>/dev/null; then
                validation_result="✓ TOML syntax is valid (validated with toml_parse)"
                validation_success=true
            else
                validation_result="✗ TOML syntax errors detected (toml_parse validation failed)"
            fi
        # Method 2: Try python -c if available
        elif command -v python3 >/dev/null 2>&1; then
            if python3 -c "import tomllib; tomllib.load(open('$ACTIVE_TOML', 'rb'))" 2>/dev/null; then
                validation_result="✓ TOML syntax is valid (validated with Python tomllib)"
                validation_success=true
            else
                validation_result="✗ TOML syntax errors detected (Python validation failed)"
            fi
        # Method 3: Basic syntax check
        else
            # Basic checks for common TOML syntax
            if grep -q "^\[.*\]" "$ACTIVE_TOML" && ! grep -q "^[[:space:]]*\[.*[^]]$" "$ACTIVE_TOML"; then
                validation_result="? TOML appears well-formed (basic syntax check - install toml parser for full validation)"
                validation_success=true
            else
                validation_result="? Could not validate TOML (no validation tools available)"
            fi
        fi

        echo "
$validation_result

File size: $(wc -c < "$ACTIVE_TOML" 2>/dev/null || echo "unknown") bytes
Lines: $(wc -l < "$ACTIVE_TOML" 2>/dev/null || echo "unknown")
Last modified: $(stat -f "%Sm" "$ACTIVE_TOML" 2>/dev/null || echo "unknown")"

        if [[ "$validation_success" == "true" ]]; then
            echo "
Configuration structure appears valid. Use 'View Configuration' to see content."
        else
            echo "
Validation issues detected. Use 'Edit Configuration' to fix syntax errors."
        fi
    else
        echo "TOML Validation
═══════════════════════════

No active TOML file to validate.

To validate a TOML configuration:
1. Ensure a tetra.toml file exists
2. Use ORG mode to link to an organization's TOML file"
    fi
}

