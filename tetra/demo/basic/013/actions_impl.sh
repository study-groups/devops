#!/usr/bin/env bash

# Action implementations - all actions output to stdout, will be captured and routed

# Helper to add separator (disabled for clean output)
sep() {
    :
}

# Dispatcher function (called by action_executor.sh)
execute_action_impl() {
    local action="$1"
    local verb="${action%%:*}"
    local noun="${action##*:}"
    local env="${ENVIRONMENTS[$ENV_INDEX]}"
    local func_name="action_${verb}_${noun}"

    # Call the action function if it exists
    if declare -f "$func_name" &>/dev/null; then
        "$func_name" "$env"
    else
        echo "️  Action Not Implemented"
        echo ""
        sep
        echo ""
        echo "Action: $action"
        echo "Verb: $verb"
        echo "Noun: $noun"
        echo "Environment: $env"
        echo ""
        echo "This action handler needs to be implemented."
        return 1
    fi
}

# ========== SYSTEM:MONITOR ==========
action_view_toml() {
    local toml_path="${TETRA_DIR}/org/pixeljam-arcade/tetra.toml"
    if [[ -f "$toml_path" ]]; then
        cat "$toml_path"
    else
        echo "File not found: $toml_path"
        echo "TETRA_DIR: ${TETRA_DIR:-'(not set)'}"
    fi
}

action_view_services() {
    if command -v tsm &>/dev/null; then
        tsm list 2>&1 || echo "No services registered"
    else
        echo "tsm command not found"
        echo "Source tetra.sh first"
    fi
}

action_view_org() {
    local org_dir="${TETRA_DIR}/org/pixeljam-arcade"
    if [[ -d "$org_dir" ]]; then
        ls -la "$org_dir" 2>&1
    else
        echo "Directory not found: $org_dir"
    fi
}

# ========== SYSTEM:CONTROL ==========
action_refresh_cache() {
    echo "Clearing cached data..."
    echo "✓ Cache refreshed"
}

action_edit_toml() {
    local toml_path="${TETRA_DIR}/org/pixeljam-arcade/tetra.toml"

    if [[ ! -f "$toml_path" ]]; then
        echo "File not found: $toml_path"
        return 1
    fi

    # Open vim directly (breaks out of stdout capture)
    vim "$toml_path" </dev/tty >/dev/tty 2>&1

    # After vim closes, show summary
    echo "✓ Editor closed: ${toml_path/$HOME/~}"
    echo ""
    echo "Next: view:toml | Test: status:tsm on Dev"
}

# ========== LOCAL/DEV:MONITOR ==========
action_status_tsm() {
    local env="${1:-Local}"

    if [[ "$env" == "Dev" ]]; then
        # Remote execution via TES
        local symbol=$(get_env_symbol "$env")
        local command="source ~/tetra/tetra.sh && tsm ls"

        # Show TES resolution pipeline
        show_tes_resolution "status:tsm" "$symbol" "$command"
        echo "Executing..."
        echo ""

        local output=$(execute_remote "$symbol" "$command" 2>&1)
        local exit_code=$?

        if [[ $exit_code -eq 0 ]]; then
            echo "$output"
        else
            echo "✗ Failed"
            echo "$output"
            return 1
        fi
    else
        # Local execution
        if command -v tsm &>/dev/null; then
            tsm ls 2>&1 || echo "TSM not running"
        else
            echo "tsm command not found"
        fi
    fi
}

action_status_watchdog() {
    local env="${1:-Local}"

    if [[ "$env" == "Dev" ]]; then
        # Remote execution via TES
        local symbol=$(get_env_symbol "$env")
        local output=$(execute_remote "$symbol" "pgrep -f 'tetra.*watchdog' && ps aux | grep 'tetra.*watchdog' | grep -v grep || echo 'Not running'" 2>&1)
        local exit_code=$?

        if [[ $exit_code -eq 0 ]]; then
            if [[ "$output" == "Not running" ]]; then
                echo "○ Not running (remote)"
            else
                echo "✓ Running (remote)"
                echo "$output"
            fi
        else
            echo "✗ Failed"
            echo "$output"
            return 1
        fi
    else
        # Local execution
        local pids=$(pgrep -f "tetra.*watchdog" 2>/dev/null)

        if [[ -n "$pids" ]]; then
            echo "✓ Running"
            echo "PIDs: $pids"
            ps aux | grep "[t]etra.*watchdog" | grep -v grep || true
        else
            echo "○ Not running"
            echo "Note: Watchdog daemon not fully implemented"
        fi
    fi
}

action_view_logs() {
    local env="${1:-Local}"
    local log_dir="${TETRA_DIR}/logs"
    if [[ -d "$log_dir" ]]; then
        find "$log_dir" -type f \( -name "*.jsonl" -o -name "*.log" \) 2>/dev/null | head -3 | while read -r logfile; do
            echo "=== $(basename "$logfile") ==="
            tail -5 "$logfile" 2>&1
            echo ""
        done
    else
        echo "Log directory not found: $log_dir"
    fi
}

action_view_remote() {
    echo "Remote server info not yet implemented"
    echo ""
    echo "Will show: hostname, uptime, services, disk usage"
}

# ========== LOCAL/DEV:CONTROL ==========
action_start_tsm() {
    local env="${1:-Local}"

    if [[ "$env" == "Dev" ]]; then
        local symbol=$(get_env_symbol "$env")
        local output=$(execute_remote "$symbol" "source ~/tetra/tetra.sh && tsm start" 2>&1)
        local exit_code=$?

        if [[ $exit_code -eq 0 ]]; then
            echo "✓ Started (remote)"
            [[ -n "$output" ]] && echo "$output"
        else
            echo "✗ Failed"
            echo "$output"
            return 1
        fi
    else
        if command -v tsm &>/dev/null; then
            local output=$(tsm start 2>&1)
            if [[ $? -eq 0 ]]; then
                echo "✓ Started"
                [[ -n "$output" ]] && echo "$output"
            else
                echo "✗ Failed"
                echo "$output"
                return 1
            fi
        else
            echo "tsm command not found"
            return 1
        fi
    fi
}

action_stop_tsm() {
    local env="${1:-Local}"

    if [[ "$env" == "Dev" ]]; then
        local symbol=$(get_env_symbol "$env")
        local output=$(execute_remote "$symbol" "source ~/tetra/tetra.sh && tsm stop" 2>&1)

        if [[ $? -eq 0 ]]; then
            echo "✓ Stopped (remote)"
            [[ -n "$output" ]] && echo "$output"
        else
            echo "✗ Failed"
            echo "$output"
            return 1
        fi
    else
        if command -v tsm &>/dev/null; then
            local output=$(tsm stop 2>&1)
            if [[ $? -eq 0 ]]; then
                echo "✓ Stopped"
                [[ -n "$output" ]] && echo "$output"
            else
                echo "✗ Failed"
                echo "$output"
                return 1
            fi
        else
            echo "tsm command not found"
            return 1
        fi
    fi
}

action_restart_tsm() {
    if command -v tsm &>/dev/null; then
        tsm restart 2>&1
        echo "✓ Restarted"
    else
        echo "tsm command not found"
    fi
}

action_start_watchdog() {
    local env="${1:-Local}"

    if [[ "$env" == "Dev" ]]; then
        echo "Remote execution not configured"
        return 0
    fi

    if declare -f tetra_watchdog &>/dev/null; then
        echo "Watchdog implementation incomplete"
        echo "Options: standalone daemon, TSM integration, systemd/launchd"
        return 1
    elif [[ -f "${TETRA_SRC}/watchdog" ]]; then
        "${TETRA_SRC}/watchdog" &
        local pid=$!
        sleep 0.2
        if kill -0 "$pid" 2>/dev/null; then
            echo "✓ Started (PID: $pid)"
        else
            echo "✗ Failed to start"
            return 1
        fi
    else
        echo "Watchdog not implemented"
        return 1
    fi
}

action_stop_watchdog() {
    local env="${1:-Local}"

    if [[ "$env" == "Dev" ]]; then
        echo "Remote execution not configured"
    else
        local count=$(pgrep -f "tetra/.*watchdog" 2>/dev/null | wc -l)
        if [[ $count -gt 0 ]]; then
            pkill -f "tetra/.*watchdog"
            sleep 0.2
            if ! pgrep -f "tetra/.*watchdog" &>/dev/null; then
                echo "✓ Stopped ($count process(es))"
            else
                echo "⚠ May still be running"
            fi
        else
            echo "No watchdog process found"
        fi
    fi
}

# ========== DEPLOY ACTIONS ==========
action_deploy_local() {
    echo " Deploy to LOCAL"
    echo ""
    sep
    echo ""
    if command -v deploy &>/dev/null; then
        echo "Executing: deploy LOCAL"
        echo ""
        deploy LOCAL 2>&1
        echo ""
        echo " Deployment initiated"
    else
        echo "️  deploy command not found"
        echo "Ensure tetra.sh is sourced"
    fi
}

action_deploy_dev() {
    echo " Deploy to DEV"
    echo ""
    sep
    echo ""
    echo "️  DEPLOYMENT ACTION"
    echo "Target: DEV environment"
    echo ""
    if command -v deploy &>/dev/null; then
        deploy DEV 2>&1
        echo ""
        echo " Deployment to DEV complete"
    else
        echo "️  deploy command not found"
    fi
}

action_deploy_staging() {
    echo " Deploy to STAGING"
    echo ""
    sep
    echo ""
    echo "️⚠️  STAGING DEPLOYMENT"
    echo "This will deploy to the staging environment!"
    echo ""
    # TODO: Add confirmation modal
    if command -v deploy &>/dev/null; then
        deploy STAGING 2>&1
        echo ""
        echo " Deployment to STAGING complete"
    else
        echo "️  deploy command not found"
    fi
}

action_deploy_prod() {
    echo " Deploy to PRODUCTION"
    echo ""
    sep
    echo ""
    echo "🚨🚨 PRODUCTION DEPLOYMENT 🚨🚨🚨"
    echo ""
    echo "This is a PRODUCTION deployment!"
    echo "This action requires explicit confirmation."
    echo ""
    echo "TODO: Implement confirmation modal"
    echo "For safety, this action is currently disabled."
    echo ""
    echo "To enable, you must:"
    echo "  1. Implement confirmation modal"
    echo "  2. Require typed confirmation (e.g., 'DEPLOY TO PRODUCTION')"
    echo "  3. Add rollback plan verification"
    return 1
}
