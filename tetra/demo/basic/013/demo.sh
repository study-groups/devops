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
PREVIEW_MODE=false  # When true, automatically show action preview on navigation

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
            echo "validate:tes edit:toml"
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
    local term_width=${COLUMNS:-80}

    # Compute status info and action state
    local status_info="-"
    local action_state="idle"
    if [[ ${#actions[@]} -gt 0 ]]; then
        local current="${actions[$ACTION_INDEX]}"
        status_info=$(compute_action_status "$current" "$env")
        status_info="${status_info:--}"
        action_state=$(get_action_state "$current")
    fi

    # Top line: right-aligned state::tetra
    local right_text="${action_state}::tetra"
    local right_len=${#right_text}
    local padding=$((term_width - right_len))
    printf "%*s\033[1;33m%s\033[0m::\033[1;36m%s\033[0m\n" "$padding" "" "$action_state" "tetra"

    # Env line
    printf "\033[36mEnv:\033[0m\t"
    for i in "${!ENVIRONMENTS[@]}"; do
        if [[ $i -eq $ENV_INDEX ]]; then
            printf "\033[1;33m[%s]\033[0m " "${ENVIRONMENTS[$i]}"
        else
            printf "%s " "${ENVIRONMENTS[$i]}"
        fi
    done
    echo

    # Mode line
    printf "\033[35mMode:\033[0m\t"
    for i in "${!MODES[@]}"; do
        if [[ $i -eq $MODE_INDEX ]]; then
            printf "\033[1;32m[%s]\033[0m " "${MODES[$i]}"
        else
            printf "%s " "${MODES[$i]}"
        fi
    done
    echo

    # Action line
    printf "\033[36mAction:\033[0m\t"
    if [[ ${#actions[@]} -gt 0 ]]; then
        local current="${actions[$ACTION_INDEX]}"
        local action_name="${current//:/_}"
        local verb="${current%%:*}"
        local noun="${current##*:}"

        # Refresh colors for current action
        refresh_color_state_cached "$verb" "$noun"

        # Get action details
        printf "($(($ACTION_INDEX + 1))/${#actions[@]}) "
        render_action_verb_noun "$verb" "$noun"

        if declare -p "ACTION_${action_name}" &>/dev/null; then
            local -n _action="ACTION_${action_name}"
            local inputs="${_action[inputs]}"
            local output="${_action[output]}"
            local effects="${_action[effects]}"

            [[ -z "$inputs" ]] && inputs="@[]"
            [[ -z "$output" ]] && output="@[]"

            local full_output="$output"
            [[ -n "$effects" ]] && full_output="$output, $effects"

            local display_inputs="${inputs/@\[\]/$(render_empty_symbol)}"
            local display_output="${full_output/@\[\]/$(render_empty_symbol)}"

            printf " :: %s -> %s" "$display_inputs" "$display_output"
        fi
        echo
    else
        echo "[none]"
    fi

    # Status line with @tui[status] support
    if [[ -n "${TUI_BUFFERS["@tui[status]"]}" ]]; then
        printf "\033[36mStatus:\033[0m\t%s\n" "${TUI_BUFFERS["@tui[status]"]}"
    elif [[ -n "$status_info" && "$status_info" != "-" ]]; then
        printf "\033[36mStatus:\033[0m\t%s\n" "$status_info"
    fi

    # Info line (for headers, metadata) - unlabeled, dimmed, below Status
    if [[ -n "${TUI_BUFFERS["@tui[info]"]}" ]]; then
        printf "\033[2m%s\033[0m\n" "${TUI_BUFFERS["@tui[info]"]}"
    fi

    # REPL prompt line - always shown between header and content
    if [[ "$REPL_MODE" == "true" ]]; then
        local actions=($(get_actions))

        if [[ ${#actions[@]} -gt 0 ]]; then
            local action="${actions[$ACTION_INDEX]}"
            local action_name="${action//:/_}"

            # Try to get TES channel info
            if declare -p "ACTION_${action_name}" &>/dev/null; then
                local -n _action="ACTION_${action_name}"
                local tes_target="${_action[tes_target]}"

                # Get channel info (username@environment)
                local channel_info=""
                if [[ -n "$tes_target" ]]; then
                    local toml_path=$(get_toml_path)
                    local connector_data=$(resolve_connector "$tes_target")
                    IFS='|' read -r auth_user work_user host auth_key <<< "$connector_data"

                    # Extract environment name from host or use symbolic name
                    local env_name="$tes_target"
                    env_name="${env_name/@/}"  # Remove @ prefix

                    channel_info="${work_user}@${env_name}"
                else
                    channel_info="${USER}@local"
                fi

                printf "\033[1;36m%s\033[0m> %s\n" "$channel_info" "$REPL_INPUT"
            else
                printf "\033[1;36m%s@local\033[0m> %s\n" "${USER}" "$REPL_INPUT"
            fi
        else
            printf "\033[1;36m%s@local\033[0m> %s\n" "${USER}" "$REPL_INPUT"
        fi
    fi
}

render_content() {
    # Popup takes precedence over content
    if [[ -n "${TUI_BUFFERS["@tui[popup]"]}" ]]; then
        echo -e "${TUI_BUFFERS["@tui[popup]"]}"
    elif [[ -n "${TUI_BUFFERS["@tui[content]"]}" ]]; then
        echo -e "${TUI_BUFFERS["@tui[content]"]}"
    else
        cat <<'EOF'
🎯 Tetra Control Center

Navigate: e=env  m=mode  a=action  Enter=execute

System > view:toml, view:services, view:org
Local  > status/start/stop tsm & watchdog, deploy:local
Dev    > remote tsm & watchdog, deploy:dev/staging/prod

Press 'a' to select action, Enter to execute
EOF
    fi
}

render_footer() {
    if [[ -n "${TUI_BUFFERS["@tui[footer]"]}" ]]; then
        echo -e "${TUI_TEXT_DIM}${TUI_BUFFERS["@tui[footer]"]}${TUI_TEXT_NORMAL}"
    else
        local preview_indicator=""
        if [[ "$PREVIEW_MODE" == "true" ]]; then
            preview_indicator=" \033[1;32m[PREVIEW]\033[0m"
        fi
        echo -e "e=env m=mode a=action Enter=exec t=tes p=preview v=view r=routes s=stream l=log c=clear q=quit${preview_indicator}"
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
    preview_tes_for_current_action
    update_action_preview
}

nav_mode_right() {
    MODE_INDEX=$(( (MODE_INDEX + 1) % ${#MODES[@]} ))
    ACTION_INDEX=0
    preview_tes_for_current_action
    update_action_preview
}

nav_action_right() {
    local actions=($(get_actions))
    [[ ${#actions[@]} -gt 0 ]] && ACTION_INDEX=$(( (ACTION_INDEX + 1) % ${#actions[@]} ))
    preview_tes_for_current_action
    update_action_preview
    # Don't clear content - let user see previous action results
}

# Helper to preview TES plan when navigating - generates plan to @tui[diagnostic]
preview_tes_for_current_action() {
    local env="${ENVIRONMENTS[$ENV_INDEX]}"
    local actions=($(get_actions))
    [[ ${#actions[@]} -eq 0 ]] && return

    local action="${actions[$ACTION_INDEX]}"
    preview_tes_plan_for_action "$action" "$env"
}

# Update action preview (content, status, info) when navigating
update_action_preview() {
    # Only update if in preview mode
    [[ "$PREVIEW_MODE" != "true" ]] && return

    local env="${ENVIRONMENTS[$ENV_INDEX]}"
    local actions=($(get_actions))
    [[ ${#actions[@]} -eq 0 ]] && return

    local action="${actions[$ACTION_INDEX]}"
    local action_name="${action//:/_}"

    # Check if action exists
    if ! declare -p "ACTION_${action_name}" &>/dev/null; then
        return
    fi

    local -n _action="ACTION_${action_name}"
    local verb="${action%%:*}"
    local noun="${action##*:}"

    # Check if action has TES metadata
    local tes_target="${_action[tes_target]}"
    if [[ -n "$tes_target" ]]; then
        # TES plan was already generated by preview_tes_for_current_action
        # Just copy diagnostic → content for display
        if [[ -n "${TUI_BUFFERS["@tui[diagnostic]"]}" ]]; then
            TUI_BUFFERS["@tui[info]"]="Preview: TES Resolution Plan"
            TUI_BUFFERS["@tui[content]"]="${TUI_BUFFERS["@tui[diagnostic]"]}"
        fi
    else
        # Show action preview for non-TES actions
        show_action_preview "$action" "$env"
    fi
}

# Show preview for non-TES actions
show_action_preview() {
    local action="$1"
    local env="$2"
    local action_name="${action//:/_}"

    if ! declare -p "ACTION_${action_name}" &>/dev/null; then
        return
    fi

    local -n _action="ACTION_${action_name}"
    local verb="${action%%:*}"
    local noun="${action##*:}"
    local can="${_action[can]}"
    local cannot="${_action[cannot]}"
    local inputs="${_action[inputs]}"
    local output="${_action[output]}"
    local effects="${_action[effects]}"
    local immediate="${_action[immediate]}"

    # Build preview content
    local preview="Action Preview: $verb:$noun\n\n"
    preview+="Environment: $env\n"
    preview+="Execution: $([ "$immediate" == "true" ] && echo "immediate" || echo "manual")\n\n"

    preview+="Capabilities:\n"
    preview+="  ✓ Can: $can\n"
    preview+="  ✗ Cannot: $cannot\n\n"

    preview+="Signature:\n"
    preview+="  Inputs: ${inputs:-∅}\n"
    preview+="  Output: $output\n"
    [[ -n "$effects" ]] && preview+="  Effects: $effects\n"

    # Add contextual info based on action
    preview+="\nWill execute:\n"
    case "$action" in
        view:toml)
            preview+="  → Display ${TETRA_DIR}/org/pixeljam-arcade/tetra.toml"
            ;;
        view:services)
            preview+="  → Run: tsm list"
            ;;
        view:org)
            preview+="  → List files in ${TETRA_DIR}/org/pixeljam-arcade/"
            ;;
        status:tsm)
            if [[ "$env" == "Dev" ]]; then
                preview+="  → SSH to @dev: tsm list"
            else
                preview+="  → Local: tsm list"
            fi
            ;;
        status:watchdog)
            if [[ "$env" == "Dev" ]]; then
                preview+="  → SSH to @dev: pgrep -f 'tetra.*watchdog'"
            else
                preview+="  → Local: pgrep -f 'tetra.*watchdog'"
            fi
            ;;
        start:tsm|stop:tsm|restart:tsm)
            if [[ "$env" == "Dev" ]]; then
                preview+="  → SSH to @dev: tsm $verb"
            else
                preview+="  → Local: tsm $verb"
            fi
            ;;
        start:watchdog|stop:watchdog)
            if [[ "$env" == "Dev" ]]; then
                preview+="  → SSH to @dev: tetra watchdog $verb"
            else
                preview+="  → Local: tetra watchdog $verb"
            fi
            ;;
        deploy:*)
            preview+="  → Deploy to ${noun^^} environment"
            preview+="  → Rsync + remote restart"
            ;;
        edit:toml)
            preview+="  → Open vim ${TETRA_DIR}/org/pixeljam-arcade/tetra.toml"
            ;;
        view:logs)
            preview+="  → List and tail recent logs"
            ;;
        validate:tes)
            preview+="  → Test SSH connection to @dev"
            preview+="  → Validate connector configuration"
            ;;
        *)
            preview+="  → (No preview available)"
            ;;
    esac

    TUI_BUFFERS["@tui[info]"]="Preview Mode: Action Details"
    TUI_BUFFERS["@tui[content]"]="$preview"
}

show_routing_table() {
    TUI_BUFFERS["@tui[info]"]="Action Registry - Routing Signatures with TES Metadata"
    TUI_BUFFERS["@tui[status]"]=""
    TUI_BUFFERS["@tui[content]"]="$(list_action_signatures)"
}

show_app_stream() {
    local stream_output=$(get_app_stream "@app[stdout]")

    TUI_BUFFERS["@tui[info]"]="@app[stdout] Stream - Application Output"
    TUI_BUFFERS["@tui[status]"]=""
    if [[ -z "$stream_output" ]]; then
        TUI_BUFFERS["@tui[content]"]="No entries yet.\n\nActions that route to @app[stdout] will appear here."
    else
        TUI_BUFFERS["@tui[content]"]="$stream_output"
    fi
}

show_execution_log_view() {
    TUI_BUFFERS["@tui[info]"]="Execution Log - Action History"
    TUI_BUFFERS["@tui[status]"]=""
    local log_content=$(show_execution_log)
    TUI_BUFFERS["@tui[content]"]="$log_content"
}

show_tes_plan_view() {
    # If in preview mode, TES plan is already visible
    if [[ "$PREVIEW_MODE" == "true" ]]; then
        # Already showing preview, just ensure TES plans are visible
        update_action_preview
        return
    fi

    # Manual TES view (preview mode OFF)
    if [[ -n "${TUI_BUFFERS["@tui[diagnostic]"]}" ]]; then
        TUI_BUFFERS["@tui[info]"]="TES Resolution Plan - 8 Phase Pipeline"
        TUI_BUFFERS["@tui[status]"]=""
        TUI_BUFFERS["@tui[content]"]="${TUI_BUFFERS["@tui[diagnostic]"]}"
    else
        TUI_BUFFERS["@tui[info]"]="No TES plan available"
        TUI_BUFFERS["@tui[status]"]=""
        TUI_BUFFERS["@tui[content]"]="No TES resolution has been performed yet.\n\nNavigate to Dev environment or enable preview mode (press 'p') to see TES plans."
    fi
}

toggle_preview_mode() {
    if [[ "$PREVIEW_MODE" == "true" ]]; then
        PREVIEW_MODE=false
        clear_content
        TUI_BUFFERS["@tui[footer]"]="Preview mode disabled"
    else
        PREVIEW_MODE=true
        update_action_preview
        TUI_BUFFERS["@tui[footer]"]="Preview mode enabled - content updates automatically"
    fi
}

# Main loop
main() {
    echo "🎯 Tetra Control Center"
    echo "Navigate: e=env  m=mode  a=action  Enter=execute"
    sleep 1

    while true; do
        render_screen

        if [[ "$REPL_MODE" == "true" ]]; then
            # REPL input mode - character by character
            read -rsn1 key

            case "$key" in
                $'\x7f'|$'\b')  # Backspace
                    REPL_INPUT="${REPL_INPUT%?}"
                    ;;
                $'\n'|'')  # Enter
                    if [[ "$REPL_INPUT" == "exit" || "$REPL_INPUT" == "q" ]]; then
                        REPL_MODE=false
                        REPL_INPUT=""
                    elif [[ -n "$REPL_INPUT" ]]; then
                        execute_repl_command "$REPL_INPUT"
                        REPL_INPUT=""
                    fi
                    ;;
                $'\e')  # Escape
                    REPL_MODE=false
                    REPL_INPUT=""
                    ;;
                *)  # Regular character
                    REPL_INPUT="${REPL_INPUT}${key}"
                    ;;
            esac
        else
            # Normal navigation mode
            read -rsn1 key

            # DEBUG: Log all key presses
            printf "[%s] Key pressed: '%s' | hex: %s\n" "$(date '+%H:%M:%S')" "$key" "$(printf '%s' "$key" | od -An -tx1 | tr -d ' \n')" >> /tmp/keys_debug.log

            case "$key" in
                'e'|'E') nav_env_right ;;
                'm'|'M') nav_mode_right ;;
                'a'|'A') nav_action_right ;;
                ''|$'\n') execute_current_action ;;  # Enter key (empty string when piped, \n when interactive)
                'i'|'I') REPL_MODE=true ;;  # Enter REPL mode
                't'|'T') show_tes_plan_view ;;  # T = TES plan
                'p'|'P') toggle_preview_mode ;;  # P = Toggle preview mode
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
