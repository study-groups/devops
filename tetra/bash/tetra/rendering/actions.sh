#!/usr/bin/env bash
# Tetra TUI Action System
# Simplified action registry and routing (from 013)

# Action registry - stores action definitions
declare -gA TETRA_ACTIONS=()

# Action context-aware lists
get_actions_for_context() {
    local env="$1"
    local mode="$2"

    local actions=""

    case "$env:$mode" in
        "Local:Inspect")
            actions="view:toml view:services check:local"
            ;;
        "Local:Transfer")
            actions="sync:local backup:local"
            ;;
        "Local:Execute")
            actions="start:tsm stop:tsm restart:tsm"
            ;;
        "Dev:Inspect")
            actions="view:remote check:remote view:logs"
            ;;
        "Dev:Transfer")
            actions="push:dev fetch:dev sync:dev"
            ;;
        "Dev:Execute")
            actions="deploy:dev restart:remote"
            ;;
        "Staging:Inspect")
            actions="view:remote check:remote"
            ;;
        "Staging:Transfer")
            actions="push:staging fetch:staging"
            ;;
        "Staging:Execute")
            actions="deploy:staging"
            ;;
        "Production:Inspect")
            actions="view:remote check:remote"
            ;;
        "Production:Transfer")
            actions="fetch:prod"
            ;;
        "Production:Execute")
            actions="deploy:prod"
            ;;
        *)
            actions="view:toml"
            ;;
    esac

    echo "$actions"
}

# Register an action
register_action() {
    local action_id="$1"
    local verb="${action_id%%:*}"
    local noun="${action_id##*:}"
    local description="$2"
    local handler="$3"

    TETRA_ACTIONS["${action_id}:verb"]="$verb"
    TETRA_ACTIONS["${action_id}:noun"]="$noun"
    TETRA_ACTIONS["${action_id}:description"]="$description"
    TETRA_ACTIONS["${action_id}:handler"]="$handler"
    TETRA_ACTIONS["${action_id}:state"]="idle"
}

# Get action state
get_action_state() {
    local action_id="$1"
    echo "${TETRA_ACTIONS[${action_id}:state]:-idle}"
}

# Set action state
set_action_state() {
    local action_id="$1"
    local state="$2"
    TETRA_ACTIONS["${action_id}:state"]="$state"
}

# Execute action handler
execute_action_handler() {
    local action_id="$1"
    local handler="${TETRA_ACTIONS[${action_id}:handler]}"

    if [[ -n "$handler" ]] && declare -f "$handler" >/dev/null 2>&1; then
        set_action_state "$action_id" "executing"

        # Execute handler and capture output
        local output
        output=$($handler 2>&1)
        local exit_code=$?

        if [[ $exit_code -eq 0 ]]; then
            set_action_state "$action_id" "success"
            echo "$output"
            return 0
        else
            set_action_state "$action_id" "error"
            echo "Error: $output"
            return 1
        fi
    else
        echo "Error: No handler found for $action_id"
        return 1
    fi
}

# ============================================================================
# ACTION HANDLERS
# ============================================================================

action_view_toml() {
    local toml_path="${TETRA_DIR}/org/pixeljam-arcade/tetra.toml"
    if [[ -f "$toml_path" ]]; then
        echo "⁘ Configuration: $toml_path"
        echo
        cat "$toml_path"
    else
        echo "⁘ Configuration file not found: $toml_path"
        return 1
    fi
}

action_view_services() {
    if command -v tsm &>/dev/null; then
        echo "⁘ Registered Services (tsm)"
        echo
        tsm list 2>&1
    else
        echo "⁘ tsm not available"
        return 1
    fi
}

action_check_local() {
    echo "⁘ Local System Check"
    echo
    echo "Hostname: $(hostname)"
    echo "User: $USER"
    echo "TETRA_SRC: $TETRA_SRC"
    echo "TETRA_DIR: ${TETRA_DIR:-not set}"
    echo
    echo "Available commands:"
    for cmd in tsm tetra; do
        if command -v $cmd &>/dev/null; then
            echo "  ⁘ $cmd: $(command -v $cmd)"
        else
            echo "  · $cmd: not found"
        fi
    done
}

action_view_remote() {
    echo "⁘ Remote Environment View"
    echo
    echo "Target: @${CONTENT_MODEL[env],,}"
    echo
    echo "This would show remote system information."
    echo "TES integration coming soon."
}

action_start_tsm() {
    echo "⁘ Starting TSM"
    echo
    if command -v tsm &>/dev/null; then
        tsm start 2>&1
    else
        echo "tsm not available"
        return 1
    fi
}

action_stop_tsm() {
    echo "⁘ Stopping TSM"
    echo
    if command -v tsm &>/dev/null; then
        tsm stop 2>&1
    else
        echo "tsm not available"
        return 1
    fi
}

action_restart_tsm() {
    echo "⁘ Restarting TSM"
    echo
    if command -v tsm &>/dev/null; then
        tsm restart 2>&1
    else
        echo "tsm not available"
        return 1
    fi
}

action_deploy() {
    local target="${CONTENT_MODEL[env],,}"
    echo "⁘ Deploy to $target"
    echo
    echo "Deployment to $target environment"
    echo "This would trigger rsync + remote restart"
    echo
    echo "[Deployment simulation - not actually executed]"
}

# ============================================================================
# REGISTER ALL ACTIONS
# ============================================================================

register_action "view:toml" "Display tetra.toml configuration" "action_view_toml"
register_action "view:services" "List registered services" "action_view_services"
register_action "view:remote" "View remote environment" "action_view_remote"
register_action "check:local" "Check local system" "action_check_local"
register_action "check:remote" "Check remote system" "action_view_remote"

register_action "start:tsm" "Start TSM service" "action_start_tsm"
register_action "stop:tsm" "Stop TSM service" "action_stop_tsm"
register_action "restart:tsm" "Restart TSM service" "action_restart_tsm"

register_action "deploy:dev" "Deploy to Dev" "action_deploy"
register_action "deploy:staging" "Deploy to Staging" "action_deploy"
register_action "deploy:prod" "Deploy to Production" "action_deploy"

register_action "sync:local" "Sync local files" "action_deploy"
register_action "sync:dev" "Sync to Dev" "action_deploy"
register_action "push:dev" "Push to Dev" "action_deploy"
register_action "push:staging" "Push to Staging" "action_deploy"
register_action "fetch:dev" "Fetch from Dev" "action_deploy"
register_action "fetch:staging" "Fetch from Staging" "action_deploy"
register_action "fetch:prod" "Fetch from Production" "action_deploy"

# Export functions
export -f get_actions_for_context
export -f register_action
export -f get_action_state
export -f set_action_state
export -f execute_action_handler
