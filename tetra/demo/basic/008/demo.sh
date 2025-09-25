#!/usr/bin/env bash

# Version 008: LOGFILE integration for action tracking
# Changes from 007: Added LOGFILE="./log.demo" and logging functionality

# Module environment setup - DEMO module naming convention
DEMO_SRC="${DEMO_SRC:-$TETRA_SRC/demo/}"
DEMO_DIR="${DEMO_DIR:-$TETRA_DIR/demo}"

# Logging configuration
LOGFILE="./log.demo"

# Logging function
log_action() {
    echo "$(date '+%H:%M:%S') $1" >> "$LOGFILE"
}

# Source TUI input system
SCRIPT_DIR="$(dirname "${BASH_SOURCE[0]}")"
source "$SCRIPT_DIR/input.sh"

# Validate module environment
if [[ -z "$TETRA_SRC" ]]; then
    echo "Error: TETRA_SRC not defined. Module system requires tetra environment."
    exit 1
fi

# State
ENV_INDEX=0
MODE_INDEX=0
ACTION_INDEX=0
CONTENT=""

ENVIRONMENTS=("DEMO" "LOCAL" "REMOTE")
MODES=("LEARN" "BUILD" "TEST")

# Environment color definitions
declare -A ENV_COLORS=(
    ["DEMO"]="cyan"
    ["LOCAL"]="green"
    ["REMOTE"]="magenta"
)

# TView Interface - Content concerns
get_actions() {
    local env="${ENVIRONMENTS[$ENV_INDEX]}"
    local mode="${MODES[$MODE_INDEX]}"

    # Module-aware action discovery using DEMO_SRC
    local module_file="$DEMO_SRC/tview/modules/${mode,,}/actions.sh"

    # Try to load module actions
    if [[ -f "$module_file" ]]; then
        source "$module_file"
        if declare -f get_actions_for_env >/dev/null 2>&1; then
            get_actions_for_env "$env"
            return
        fi
    fi

    # Fallback actions
    echo "help"
    echo "refresh"
    echo "status"
    echo "module-info"
}

execute_current_action() {
    local env="${ENVIRONMENTS[$ENV_INDEX]}"
    local mode="${MODES[$MODE_INDEX]}"
    local module_file="$DEMO_SRC/tview/modules/${mode,,}/actions.sh"

    local actions=($(get_actions))
    local action="${actions[$ACTION_INDEX]}"

    # Log the action execution
    log_action "Execute: $env:$mode:$action"

    # Build result header - compact format
    CONTENT="$action → $env:$mode"
    CONTENT+="\n$(printf '%.40s' '----------------------------------------')"

    # Try module execution first
    if [[ -f "$module_file" ]]; then
        source "$module_file"
        if declare -f execute_action >/dev/null 2>&1; then
            CONTENT+="\n$(execute_action "$action" "$env")"
        else
            CONTENT+="\nModule found but execute_action function missing"
        fi
    else
        # Fallback execution - compact format
        case "$action" in
            "help")
                CONTENT+="\nActions: ${actions[*]}"
                CONTENT+="\nKeys: e=env d=mode a/s=action ?=help"
                ;;
            "refresh")
                CONTENT+="\nCache cleared, modules refreshed"
                ;;
            "status")
                CONTENT+="\nv008 | ${#actions[@]} actions | $(basename "$DEMO_SRC")"
                ;;
            "module-info")
                CONTENT+="\nDEMO module | TUI app"
                CONTENT+="\nSRC: $(basename "$DEMO_SRC") DIR: $(basename "$DEMO_DIR")"
                ;;
            *)
                CONTENT+="\nE×M+A: $env × $mode + $action = ✓"
                ;;
        esac
    fi

    # Log completion
    log_action "Result: Action completed"
}

# TUI Interface - Display concerns
render_header() {
    local hostname=$(hostname -s)
    local current_env="${ENVIRONMENTS[$ENV_INDEX]}"
    local current_mode="${MODES[$MODE_INDEX]}"

    # Line 1: Title and context with module info
    echo "Demo Module | $current_env:$current_mode"
}

render_environment_line() {
    local env_line="Env: "
    for i in "${!ENVIRONMENTS[@]}"; do
        if [[ $i -eq $ENV_INDEX ]]; then
            env_line+="$(tput bold)[${ENVIRONMENTS[$i]}]$(tput sgr0) "  # Bold for selected
        else
            env_line+="${ENVIRONMENTS[$i]} "
        fi
    done
    echo "$env_line"
}

render_mode_line() {
    local mode_line="Mode: "
    for i in "${!MODES[@]}"; do
        if [[ $i -eq $MODE_INDEX ]]; then
            mode_line+="$(tput bold)[${MODES[$i]}]$(tput sgr0) "  # Bold for selected
        else
            mode_line+="${MODES[$i]} "
        fi
    done
    echo "$mode_line"
}

render_action_line() {
    local actions=($(get_actions))
    local action_line="Action: "

    for i in "${!actions[@]}"; do
        if [[ $i -eq $ACTION_INDEX ]]; then
            action_line+="$(tput bold)[${actions[$i]}]$(tput sgr0) "  # Bold for selected
        else
            action_line+="${actions[$i]} "
        fi
    done
    action_line+="($(($ACTION_INDEX + 1))/${#actions[@]})"

    # Show current action info
    if [[ ${#actions[@]} -gt 0 ]]; then
        local current_action="${actions[$ACTION_INDEX]}"
        local env="${ENVIRONMENTS[$ENV_INDEX]}"
        local mode="${MODES[$MODE_INDEX]}"
        local module_file="$DEMO_SRC/tview/modules/${mode,,}/actions.sh"

        if [[ -f "$module_file" ]]; then
            action_line+=" | Module: $(basename "$module_file")"
        else
            action_line+=" | Add to: $DEMO_SRC/tview/modules/${mode,,}/"
        fi
    fi

    echo "$action_line"
}

render_content() {
    local term_height=${LINES:-24}
    local available_lines=$((term_height - 10))  # Reserve space for header+footer

    if [[ -n "$CONTENT" ]]; then
        # Limit content to available space and wrap lines
        echo -e "$CONTENT" | head -n "$available_lines" | cut -c1-${COLUMNS:-80}
    else
        echo "TView v008 - TUI/TView Separation Demo"
        echo ""
        echo "E×M+A=R: Environment × Mode + Action = Result"
        echo "Module: DEMO_{SRC,DIR} naming conventions"
        echo "Input: Enhanced navigation with logging"
        echo ""
        echo "Navigate with e/d/a keys, execute with l/Enter"
        echo "Press ? for help, / for REPL mode"
    fi
}

render_footer() {
    local term_width=${COLUMNS:-80}
    local mode_icon="$(get_input_mode_display)"

    # Build footer based on terminal width
    if [[ $term_width -le 80 ]]; then
        # Compact 80-column layout - home row flow
        echo "${mode_icon} e=env d=mode s=sel f=fire F=info ?=help q=quit"
    else
        # Wide terminal layout - home row flow
        echo "${mode_icon} e/E=env d/D=mode s/S=select f=fire F=info c=clear ?=help /=repl q/ESC=quit | v008"
    fi
}

# Legacy function aliases for compatibility
next_env() { navigate_env_right; }
next_mode() { navigate_mode_right; }
next_action() { navigate_action_right; }
clear_content() { clear_ui_content; }

# Note: handle_input() now provided by input.sh

# Validate action index on context changes
validate_action_index() {
    local actions=($(get_actions))
    if [[ $ACTION_INDEX -ge ${#actions[@]} ]]; then
        ACTION_INDEX=0
    fi
}

# Complete display function following TUI principles
show_display() {
    validate_action_index

    # Calculate exact layout
    local term_height=${LINES:-24}
    local term_width=${COLUMNS:-80}
    local header_lines=4
    local footer_lines=2
    local separator_lines=1
    local available_content_lines=$((term_height - header_lines - footer_lines - separator_lines))

    # Clear screen and position cursor
    tput clear

    # Render each line precisely
    render_line 1 "$(render_header | cut -c1-$term_width)"
    render_line 2 "$(render_environment_line | cut -c1-$term_width)"
    render_line 3 "$(render_mode_line | cut -c1-$term_width)"
    render_line 4 "$(render_action_line | cut -c1-$term_width)"
    render_line 5 "$(printf '%.40s' '----------------------------------------')"

    # Render content in available space
    local content_start=6
    render_content_lines "$content_start" "$available_content_lines" "$term_width"

    # Render footer at exact position
    local footer_line=$((term_height - 1))
    render_line "$footer_line" "$(render_footer | cut -c1-$term_width)"
}

# Render single line at specific position
render_line() {
    local line_num="$1"
    local content="$2"
    tput cup $((line_num - 1)) 0  # tput uses 0-based indexing
    printf "%s" "$content"
    tput el  # Clear to end of line
}

# Render content with line limits and tview directive awareness
render_content_lines() {
    local start_line="$1"
    local max_lines="$2"
    local max_width="$3"
    local current_line="$start_line"

    if [[ -n "$CONTENT" ]]; then
        # Process content line by line with tview directives
        while IFS= read -r line && [[ $((current_line - start_line)) -lt $max_lines ]]; do
            # Check for tview directives (future extensibility)
            if [[ "$line" =~ ^@tview: ]]; then
                # Handle tview directive (placeholder for future)
                continue
            fi

            # Render line with width constraint
            render_line "$current_line" "$(echo "$line" | cut -c1-$max_width)"
            ((current_line++))
        done <<< "$(echo -e "$CONTENT")"
    else
        # Default content - compact and clean
        render_line "$current_line" "TView v008 - TUI/TView Separation Demo"
        ((current_line++))
        render_line "$current_line" ""
        ((current_line++))
        render_line "$current_line" "E×M+A=R: Environment × Mode + Action = Result"
        ((current_line++))
        if [[ $((current_line - start_line)) -lt $max_lines ]]; then
            render_line "$current_line" "Bidirectional: e/E d/D a/A | Select: s | Execute: S"
            ((current_line++))
        fi

        # Clear any remaining lines in content area
        while [[ $((current_line - start_line)) -lt $max_lines ]]; do
            render_line "$current_line" ""
            ((current_line++))
        done
    fi
}

# Main loop
main() {
    echo "Starting TView v008 - Input System + Logging Demo"
    echo "DEMO_SRC: $DEMO_SRC"
    echo "DEMO_DIR: $DEMO_DIR"
    sleep 2

    # Hide cursor for cleaner interface
    tput civis

    # Set up exit trap to restore cursor
    trap 'tput cnorm; tput clear' EXIT

    while true; do
        show_display
        read -n1 -s key

        if ! handle_input "$key"; then
            break
        fi
    done

    # Restore cursor and clear screen
    tput cnorm
    tput clear
    echo "TView v008 ended - Input system + Logging demonstrated!"
    echo ""
    echo "Architecture achievements:"
    echo "✅ Clean separation between interface (TUI) and content (TView)"
    echo "✅ Extracted input system (input.sh) with enhanced navigation"
    echo "✅ Action logging system ($LOGFILE)"
    echo "✅ Module naming conventions: MODNAME_{SRC,DIR}"
    echo "✅ Bidirectional navigation (a/s for actions)"
    echo "✅ Help system (? key) and mode switching (/ key)"
    echo "✅ E×M+A=R formula with module awareness"
}

main