#!/usr/bin/env bash

# Version 013: TES + Smart Colors
# Harmonizes TES syntax (012) with sophisticated color system (010)
# Features: Colorized signatures, distance-based colors, unified logging

# Source tetra.sh first - REQUIRED for tsm and all tetra commands
source ~/tetra/tetra.sh

DEMO_DIR="$(dirname "${BASH_SOURCE[0]}")"

source "$DEMO_DIR/tui.conf"
source "$DEMO_DIR/viewport.sh"
source "$DEMO_DIR/colors/color_module.sh"
source "$DEMO_DIR/typography.sh"
source "$DEMO_DIR/tes_resolver.sh"
source "$DEMO_DIR/action_registry.sh"
source "$DEMO_DIR/action_state.sh"
source "$DEMO_DIR/action_preview.sh"
source "$DEMO_DIR/modal.sh"
source "$DEMO_DIR/router.sh"
source "$DEMO_DIR/actions_impl.sh"
source "$DEMO_DIR/action_executor.sh"
source "$DEMO_DIR/repl.sh"

# Application state
ENV_INDEX=0
MODE_INDEX=0
ACTION_INDEX=0
REPL_MODE=false
REPL_INPUT=""

ENVIRONMENTS=("System" "Local" "Dev")
MODES=("Monitor" "Control" "Deploy")

# Get actions for current context
get_actions() {
    local env="${ENVIRONMENTS[$ENV_INDEX]}"
    local mode="${MODES[$MODE_INDEX]}"

    case "$env:$mode" in
        "System:Monitor")
            echo "view:toml view:services view:org"
            ;;
        "System:Control")
            echo "refresh:cache edit:toml"
            ;;
        "System:Deploy")
            echo ""  # No deploy from system view
            ;;
        "Local:Monitor")
            echo "status:tsm status:watchdog view:logs"
            ;;
        "Local:Control")
            echo "start:tsm stop:tsm restart:tsm start:watchdog stop:watchdog"
            ;;
        "Local:Deploy")
            echo "deploy:local"
            ;;
        "Dev:Monitor")
            echo "status:tsm status:watchdog view:logs view:remote"
            ;;
        "Dev:Control")
            echo "start:tsm stop:tsm start:watchdog stop:watchdog"
            ;;
        "Dev:Deploy")
            echo "deploy:dev deploy:staging deploy:prod"
            ;;
        *)
            echo ""
            ;;
    esac
}

# Get current modes (compatibility with REPL)
get_current_modes() {
    echo "${MODES[@]}"
}

# Component renderers

render_separator() {
    printf '%*s' "${1:-$TUI_SEPARATOR_WIDTH}" '' | tr ' ' "$TUI_SEPARATOR_CHAR"
    echo
}

# Compute contextual status info for an action
compute_action_status() {
    local action="$1"
    local env="$2"
    local verb="${action%%:*}"
    local noun="${action##*:}"

    # Check for stored status first
    local stored_status=$(get_action_status "$action")
    if [[ -n "$stored_status" ]]; then
        echo "$stored_status"
        return
    fi

    # Compute default status based on action type
    case "$action" in
        view:toml)
            local toml_path="${TETRA_DIR}/org/pixeljam-arcade/tetra.toml"
            if [[ -f "$toml_path" ]]; then
                echo "${toml_path/$HOME/~} ($(wc -l < "$toml_path" | tr -d ' ') lines)"
            else
                echo "File not found"
            fi
            ;;
        view:services)
            if command -v tsm &>/dev/null; then
                local count=$(tsm list 2>/dev/null | wc -l | tr -d ' ')
                echo "$count services registered"
            else
                echo "tsm not available"
            fi
            ;;
        view:org)
            local org_dir="${TETRA_DIR}/org/pixeljam-arcade"
            if [[ -d "$org_dir" ]]; then
                local file_count=$(ls -1 "$org_dir" 2>/dev/null | wc -l | tr -d ' ')
                echo "$file_count files in ${org_dir/$HOME/~}"
            else
                echo "Directory not found"
            fi
            ;;
        status:tsm)
            if [[ "$env" == "Dev" ]]; then
                echo "Remote: @dev (137.184.226.163)"
            else
                echo "Local process status"
            fi
            ;;
        status:watchdog)
            if [[ "$env" == "Dev" ]]; then
                echo "Remote: @dev"
            else
                local pid_count=$(pgrep -f "tetra.*watchdog" 2>/dev/null | wc -l | tr -d ' ')
                if [[ $pid_count -gt 0 ]]; then
                    echo "$pid_count process(es) running"
                else
                    echo "Not running"
                fi
            fi
            ;;
        start:*|stop:*|restart:*)
            if [[ "$env" == "Dev" ]]; then
                echo "Remote execution on @dev"
            else
                echo "Local execution"
            fi
            ;;
        deploy:*)
            local target="${noun^^}"  # Uppercase
            echo "Target: $target environment"
            ;;
        edit:toml)
            local toml_path="${TETRA_DIR}/org/pixeljam-arcade/tetra.toml"
            echo "Editor: vim | Path: ${toml_path/$HOME/~}"
            ;;
        view:logs)
            local log_dir="${TETRA_DIR}/logs"
            if [[ -d "$log_dir" ]]; then
                local log_count=$(find "$log_dir" -type f \( -name "*.jsonl" -o -name "*.log" \) 2>/dev/null | wc -l | tr -d ' ')
                echo "$log_count log files in ${log_dir/$HOME/~}"
            else
                echo "Log directory not found"
            fi
            ;;
        *)
            echo ""
            ;;
    esac
}

render_header() {
    local env="${ENVIRONMENTS[$ENV_INDEX]}"
    local mode="${MODES[$MODE_INDEX]}"
    local actions=($(get_actions))

    # Top row with colored env × mode
    printf "Tetra Control Center | \033[1;33m%s\033[0m \033[2m%s\033[0m \033[1;32m%s\033[0m\n" "$env" "$CROSS_OP" "$mode"

    # Env line with color and tab alignment
    printf "\033[36m%s\033[0m\t" "$TUI_LABEL_ENV"  # Cyan for Env:
    for i in "${!ENVIRONMENTS[@]}"; do
        if [[ $i -eq $ENV_INDEX ]]; then
            printf "\033[1;33m%s%s%s\033[0m " "$TUI_BRACKET_LEFT" "${ENVIRONMENTS[$i]}" "$TUI_BRACKET_RIGHT"  # Bold yellow
        else
            echo -n "${ENVIRONMENTS[$i]} "
        fi
    done
    echo

    # Mode line with color and tab alignment
    printf "\033[35m%s\033[0m\t" "$TUI_LABEL_MODE"  # Magenta for Mode:
    for i in "${!MODES[@]}"; do
        if [[ $i -eq $MODE_INDEX ]]; then
            printf "\033[1;32m%s%s%s\033[0m " "$TUI_BRACKET_LEFT" "${MODES[$i]}" "$TUI_BRACKET_RIGHT"  # Bold green
        else
            echo -n "${MODES[$i]} "
        fi
    done
    echo

    # Action line with signature and state at end (COLORIZED) - tab aligned
    printf "\033[36m%s\033[0m\t" "$TUI_LABEL_ACTION"  # Cyan for Action:
    if [[ ${#actions[@]} -gt 0 ]]; then
        local current="${actions[$ACTION_INDEX]}"
        local action_name="${current//:/_}"
        local verb="${current%%:*}"
        local noun="${current##*:}"
        local state=$(get_action_state "$current")
        local state_symbol=$(get_state_symbol "$state")

        # Refresh colors for current action
        refresh_color_state_cached "$verb" "$noun"

        # Get action details
        if declare -p "ACTION_${action_name}" &>/dev/null; then
            local -n _action="ACTION_${action_name}"
            local inputs="${_action[inputs]}"
            local output="${_action[output]}"
            local effects="${_action[effects]}"

            # Build signature parts
            local input_part="(${inputs})"
            local output_part="$output"
            [[ -n "$effects" ]] && output_part="$output where $effects"

            # Render with COLORS
            echo -n "${TUI_BRACKET_LEFT}"
            render_action_verb_noun "$verb" "$noun"
            echo -n "${TUI_BRACKET_RIGHT}$ENDPOINT_OP$input_part $FLOW_OP $output_part "
            echo "($(($ACTION_INDEX + 1))/${#actions[@]}) $state_symbol $state"
        else
            echo -n "${TUI_BRACKET_LEFT}"
            render_action_verb_noun "$verb" "$noun"
            echo "${TUI_BRACKET_RIGHT} ($(($ACTION_INDEX + 1))/${#actions[@]}) $state_symbol $state"
        fi

        # Status line - always present, contextual info
        local status_info=$(compute_action_status "$current" "$env")
        printf "\033[2m%s\033[0m\t%s\n" "Status:" "${status_info:--}"
    else
        echo "[none]"
        printf "\033[2m%s\033[0m\t%s\n" "Status:" "-"
    fi
}

render_content() {
    render_separator

    if [[ -n "${TUI_BUFFERS["@tui[content]"]}" ]]; then
        echo -e "${TUI_BUFFERS["@tui[content]"]}"
    else
        cat <<'EOF'
🎯 Tetra Control Center

Navigate: e=env  d=mode  f=action  Enter=execute

System > view:toml, view:services, view:org
Local  > status/start/stop tsm & watchdog, deploy:local
Dev    > remote tsm & watchdog, deploy:dev/staging/prod

Press 'f' to select action, Enter to execute
EOF
    fi
}

render_footer() {
    render_separator 40

    if [[ "$REPL_MODE" == "true" ]]; then
        # REPL prompt
        local env="${ENVIRONMENTS[$ENV_INDEX]}"
        local current_modes=($(get_current_modes))
        local mode="${current_modes[$MODE_INDEX]}"
        printf "%s:%s> %s" "$env" "$mode" "$REPL_INPUT"
    elif [[ -n "${TUI_BUFFERS["@tui[footer]"]}" ]]; then
        echo -e "${TUI_TEXT_DIM}${TUI_BUFFERS["@tui[footer]"]}${TUI_TEXT_NORMAL}"
    else
        echo "e=env d=mode f=action Enter=exec v=view r=routes s=stream l=log c=clear q=quit"
    fi
}

render_screen() {
    # Update viewport dimensions
    update_viewport_dimensions

    # Clear screen and position at top
    clear_viewport

    # Render header (fixed position)
    render_header

    # Render content (bounded by viewport)
    local raw_content=$(render_content)

    # Store for pager access
    store_raw_content "$raw_content"

    # Truncate and display
    local bounded_content=$(truncate_content "$raw_content")
    echo "$bounded_content"

    # Render footer (fixed position at bottom)
    render_footer
}

# Action execution dispatcher (called by action_executor.sh)
# This is sourced so it's available globally

execute_current_action() {
    local env="${ENVIRONMENTS[$ENV_INDEX]}"
    local mode="${MODES[$MODE_INDEX]}"
    local actions=($(get_actions))
    local action="${actions[$ACTION_INDEX]}"

    [[ -z "$action" ]] && return

    local current_state=$(get_action_state "$action")

    # Handle error state - require acknowledgment
    if [[ "$current_state" == "error" ]]; then
        # Reset to idle and clear error
        set_action_state "$action" "idle"
        clear_content
        TUI_BUFFERS["@tui[footer]"]=""
        return
    fi

    # Handle success state - keep content visible, just reset state
    if [[ "$current_state" == "success" ]]; then
        set_action_state "$action" "idle"
        return
    fi

    # TES PHASE 1: QUALIFY - Check if action is fully qualified
    if ! is_fully_qualified "$action"; then
        TUI_BUFFERS["@tui[content]"]="⚠️  Action Not Qualified

Action: $action

This action requires inputs that haven't been resolved yet.
Actions must be fully qualified before execution.

TES Lifecycle: template → qualified → ready → execute"
        TUI_BUFFERS["@tui[footer]"]="Action requires input resolution"
        return 1
    fi

    qualify_action "$action"

    # TES PHASE 2: VALIDATE - Pre-flight checks
    if ! is_action_ready "$action"; then
        # For simple actions (no inputs), auto-validate
        local action_name="${action//:/_}"
        if declare -p "ACTION_${action_name}" &>/dev/null; then
            local -n _action_ref="ACTION_${action_name}"
            if [[ -z "${_action_ref[inputs]}" ]]; then
                # No inputs = no validation needed
                mark_action_ready "$action"
            else
                TUI_BUFFERS["@tui[content]"]="⚠️  Action Not Ready

Action: $action
State: qualified (needs validation)

Pre-flight validation required before execution.

TES Lifecycle: template → qualified → ready → execute
                                    ↑ YOU ARE HERE"
                TUI_BUFFERS["@tui[footer]"]="Action needs validation"
                return 1
            fi
        fi
    fi

    # TES PHASE 3: EXECUTE
    set_action_state "$action" "executing"
    render_screen
    sleep 0.5  # User sees ▶ executing in header

    # Execute action (updates buffers via observer pattern)
    execute_action_with_feedback "$action"
    local exit_code=$?

    # PHASE 4: Show result state
    render_screen
    sleep 0.3  # User sees ✓ success or ✗ error with output

    # PHASE 5: Return to idle
    if [[ $exit_code -eq 0 ]]; then
        set_action_state "$action" "idle"
    fi
}

# Navigation
nav_env_right() {
    ENV_INDEX=$(( (ENV_INDEX + 1) % ${#ENVIRONMENTS[@]} ))
    ACTION_INDEX=0
}

nav_mode_right() {
    MODE_INDEX=$(( (MODE_INDEX + 1) % ${#MODES[@]} ))
    ACTION_INDEX=0
}

nav_action_right() {
    local actions=($(get_actions))
    [[ ${#actions[@]} -gt 0 ]] && ACTION_INDEX=$(( (ACTION_INDEX + 1) % ${#actions[@]} ))
    # Don't clear content - let user see previous action results
}

show_routing_table() {
    TUI_BUFFERS["@tui[content]"]="$(list_action_signatures)"
}

show_app_stream() {
    local stream_output=$(get_app_stream "@app[stdout]")

    if [[ -z "$stream_output" ]]; then
        TUI_BUFFERS["@tui[content]"]="@app[stdout] Stream\n$(render_separator)\n\nNo entries yet.\n\nActions that route to @app[stdout] will appear here."
    else
        TUI_BUFFERS["@tui[content]"]="@app[stdout] Stream\n$(render_separator)\n\n$stream_output"
    fi
}

show_execution_log_view() {
    local log_content=$(show_execution_log)
    TUI_BUFFERS["@tui[content]"]="$log_content"
}

# Main loop
main() {
    echo "🎯 Tetra Control Center"
    echo "Navigate: e=env  d=mode  f=action  Enter=execute"
    sleep 1

    while true; do
        render_screen

        if [[ "$REPL_MODE" == "true" ]]; then
            # REPL input mode
            read -e -r input
            if [[ "$input" == "exit" || "$input" == "q" ]]; then
                REPL_MODE=false
                REPL_INPUT=""
            elif [[ -n "$input" ]]; then
                execute_repl_command "$input"
                REPL_INPUT=""
            fi
        else
            # Normal navigation mode
            read -rsn1 key

            # DEBUG: Log all key presses
            printf "[%s] Key pressed: '%s' | hex: %s\n" "$(date '+%H:%M:%S')" "$key" "$(printf '%s' "$key" | od -An -tx1 | tr -d ' \n')" >> /tmp/keys_debug.log

            case "$key" in
                'e'|'E') nav_env_right ;;
                'd'|'D') nav_mode_right ;;
                'f'|'F') nav_action_right ;;
                ''|$'\n') execute_current_action ;;  # Enter key (empty string when piped, \n when interactive)
                'i'|'I') REPL_MODE=true ;;  # Enter REPL mode
                'r'|'R') show_routing_table ;;
                's'|'S') show_app_stream ;;
                'l'|'L') show_execution_log_view ;;
                'c'|'C') clear_content ;;
                'v'|'V')
                    echo "[$(date '+%H:%M:%S')] 'v' key - calling view_in_pager" >> /tmp/keys_debug.log
                    view_in_pager
                    ;;  # V = View full content in pager
                'q'|'Q') break ;;
                *)
                    echo "[$(date '+%H:%M:%S')] Unhandled key: '$key'" >> /tmp/keys_debug.log
                    ;;
            esac
        fi
    done

    clear
    echo "Tetra Control Center shutdown complete."
}

main "$@"
