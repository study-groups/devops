#!/usr/bin/env bash

# RCM Render - UI rendering functions for RCM modes
# Single responsibility: Generate display content for RCM interface

# Show SSH prefix status for system overview
rcm_show_prefix_status() {
    local count=0
    for env in "${!CURRENT_SSH_PREFIXES[@]}"; do
        local prefix="${CURRENT_SSH_PREFIXES[$env]}"
        local status="default"
        if [[ "$prefix" != "${DEFAULT_SSH_PREFIXES[$env]:-}" ]]; then
            status="modified"
        fi
        printf "  %-15s → %s (%s)\n" "$env" "$prefix" "$status"
        ((count++))
        if [[ $count -ge 5 ]]; then
            echo "  ... and $((${#CURRENT_SSH_PREFIXES[@]} - 5)) more"
            break
        fi
    done | sort
}

# Show top 3 user prefixes per environment for system overview
rcm_show_top_user_prefixes() {
    # Group environments by their base (dev, staging, prod, qa, local)
    local environments=("local" "dev" "staging" "prod" "qa")

    for base_env in "${environments[@]}"; do
        echo "  ${base_env^^}:"

        # Find all user variants for this environment
        local user_count=0
        for env_key in "${!DEFAULT_SSH_PREFIXES[@]}"; do
            if [[ "$env_key" == "$base_env"* ]]; then
                local prefix="${DEFAULT_SSH_PREFIXES[$env_key]}"
                local comment="${ENV_COMMENTS[$env_key]:-}"

                # Extract user@host from SSH command
                local user_host=""
                if [[ -n "$prefix" ]]; then
                    user_host=$(echo "$prefix" | sed -n 's/.*ssh \([^@]*@[^ ]*\).*/\1/p')
                    if [[ -z "$user_host" ]]; then
                        user_host="$prefix"
                    fi
                else
                    user_host="(local execution)"
                fi

                printf "    %-25s  %s\n" "$user_host" "$comment"
                ((user_count++))

                # Limit to top 3 per environment
                if [[ $user_count -ge 3 ]]; then
                    break
                fi
            fi
        done

        if [[ $user_count -eq 0 ]]; then
            echo "    (no configured access)"
        fi
        echo
    done
}

# Render command list with states for a specific environment
rcm_render_command_list() {
    local env="$1"
    local item_count=0

    for cmd_name in "${!RCM_COMMANDS[@]}"; do
        local command_id="${cmd_name}_${env}"
        local state=$(rcm_get_command_state "$command_id")
        local expanded=$(rcm_is_command_expanded "$command_id")
        local is_selected=""

        # Check if this is the currently selected item
        if [[ $item_count -eq $CURRENT_ITEM ]]; then
            is_selected="true"
        else
            is_selected="false"
        fi

        # State indicator
        local state_indicator
        case "$state" in
            "idle") state_indicator="[IDLE]" ;;
            "executing") state_indicator="[EXECUTING...] ⟳" ;;
            "success") state_indicator="[SUCCESS] ✓" ;;
            "error") state_indicator="[ERROR] ✗" ;;
            *) state_indicator="[UNKNOWN]" ;;
        esac

        # Selection indicator and command name
        local selection_indicator
        if [[ "$is_selected" == "true" ]]; then
            selection_indicator="▶"
        else
            selection_indicator=" "
        fi

        printf "%s [%-20s] %s\n" "$selection_indicator" "$cmd_name" "$state_indicator"

        # Show expanded results if available
        if [[ "$expanded" == "true" ]]; then
            local result=$(rcm_get_command_result "$command_id")
            if [[ -n "$result" ]]; then
                echo "  │"
                echo "$result" | sed 's/^/  │ /' | head -10
                echo "  │"

                # Show truncation indicator if needed
                local line_count=$(echo "$result" | wc -l)
                if [[ $line_count -gt 10 ]]; then
                    echo "  │ ... ($((line_count - 10)) more lines)"
                fi
            fi
        fi

        ((item_count++))
    done | sort
}

# Render SSH prefix edit interface
rcm_render_ssh_edit() {
    local env="$1"
    local current_prefix="${CURRENT_SSH_PREFIXES[$env]:-}"
    local default_prefix="${DEFAULT_SSH_PREFIXES[$env]:-}"

    cat << EOF

SSH Prefix Editor - Environment: $env

Current: $current_prefix
Default: $default_prefix

Edit Buffer: $RCM_EDIT_BUFFER

Commands:
  ENTER    - Save changes
  ESC      - Cancel edit
  CTRL+Z   - Reset to default
  CTRL+C   - Clear buffer

EOF
}

# Render command execution summary
rcm_render_execution_summary() {
    local env="$1"
    local total_commands=${#RCM_COMMANDS[@]}
    local running_count=0
    local success_count=0
    local error_count=0
    local idle_count=0

    # Count command states
    for cmd_name in "${!RCM_COMMANDS[@]}"; do
        local command_id="${cmd_name}_${env}"
        local state=$(rcm_get_command_state "$command_id")

        case "$state" in
            "executing") ((running_count++)) ;;
            "success") ((success_count++)) ;;
            "error") ((error_count++)) ;;
            "idle") ((idle_count++)) ;;
        esac
    done

    cat << EOF

Execution Summary for $env:
  Total Commands: $total_commands
  Running: $running_count
  Success: $success_count
  Errors: $error_count
  Idle: $idle_count

EOF
}

# Render environment connection status
rcm_render_connection_status() {
    local env="$1"
    local ssh_prefix="${CURRENT_SSH_PREFIXES[$env]:-}"

    if [[ -z "$ssh_prefix" ]]; then
        if [[ "$env" == "local" ]]; then
            echo "Connection: LOCAL (direct execution)"
        else
            echo "Connection: NOT CONFIGURED"
        fi
    else
        echo "Connection: $ssh_prefix"

        # Show last connectivity test if available
        # This could be enhanced to show cached test results
        echo "Status: Use 't' to test connectivity"
    fi
}

# Render command detail view (when drilled into a command)
rcm_render_command_detail() {
    local command_name="$1"
    local env="$2"
    local command_id="${command_name}_${env}"

    local command="${RCM_COMMANDS[$command_name]:-}"
    local state=$(rcm_get_command_state "$command_id")
    local result=$(rcm_get_command_result "$command_id")
    local exit_code=$(rcm_get_command_exit_code "$command_id")
    local timestamp=$(rcm_get_command_timestamp "$command_id")

    cat << EOF

Command Detail: $command_name

Command: $command
Environment: $env
SSH Prefix: ${CURRENT_SSH_PREFIXES[$env]:-"(not configured)"}

State: $state
Exit Code: $exit_code
Timestamp: $(date -d "@$timestamp" 2>/dev/null || echo "$timestamp")

Full Command: $(rcm_build_ssh_command "$command_name" "$env" 2>/dev/null || echo "N/A")

Result:
$result

EOF
}

# Render available actions based on current context
rcm_render_actions() {
    local context="$1"  # "list", "edit", "detail"

    case "$context" in
        "edit")
            echo "EDIT> enter=save esc=cancel ctrl+z=reset ctrl+c=clear"
            ;;
        "detail")
            echo "DETAIL> r=re-run c=cancel space=expand j=back esc=list"
            ;;
        "list")
            echo "LIST> enter=execute space=expand e=edit t=test r=retry c=cancel"
            ;;
        *)
            echo "RCM> enter=execute space=expand e=edit navigation: ↑↓←→"
            ;;
    esac
}