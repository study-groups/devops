#!/usr/bin/env bash
# Tetra Action Executor
# TTS transaction wrapper for actions

# Source dependencies
if [[ -f "$TETRA_SRC/bash/actions/registry.sh" ]]; then
    source "$TETRA_SRC/bash/actions/registry.sh"
fi

# Execute an action (with optional TTS transaction)
# Usage: action_exec module.action [@endpoint] [args...]
action_exec() {
    local fqn="$1"
    shift

    # Check if action exists
    if ! action_exists "$fqn"; then
        echo "Error: Action not found: $fqn" >&2
        return 1
    fi

    # Parse arguments
    local endpoint=""
    local args=()

    # Check if first arg is a TES endpoint
    if [[ "$1" == @* ]]; then
        endpoint="$1"
        shift
    fi

    # Remaining args
    args=("$@")

    # Get action metadata
    local module="${fqn%%.*}"
    local action="${fqn#*.}"
    local tes_capable=$(action_is_tes_capable "$fqn" && echo "yes" || echo "no")

    # Check if TES endpoint required but not provided
    if [[ "$tes_capable" == "yes" && -z "$endpoint" ]]; then
        echo "Error: Action $fqn requires a TES endpoint (e.g., @dev, @staging)" >&2
        return 1
    fi

    # Build function name to call
    # Convention: module_action_impl or module_action
    local impl_fn="${module}_${action}_impl"
    local direct_fn="${module}_${action}"

    local fn_to_call=""
    if declare -f "$impl_fn" >/dev/null 2>&1; then
        fn_to_call="$impl_fn"
    elif declare -f "$direct_fn" >/dev/null 2>&1; then
        fn_to_call="$direct_fn"
    else
        echo "Error: Implementation function not found: $impl_fn or $direct_fn" >&2
        return 1
    fi

    # Execute with transaction if TES-capable
    if [[ "$tes_capable" == "yes" ]]; then
        _action_exec_with_txn "$fqn" "$endpoint" "$fn_to_call" "${args[@]}"
    else
        _action_exec_direct "$fqn" "$fn_to_call" "${args[@]}"
    fi
}

# Execute action with TTS transaction wrapper
_action_exec_with_txn() {
    local fqn="$1"
    local endpoint="$2"
    local fn="$3"
    shift 3
    local args=("$@")

    # Check if TTM (transaction manager) is available
    if ! type txn_create &>/dev/null; then
        echo "Warning: TTS transaction system not available, running directly" >&2
        _action_exec_direct "$fqn" "$fn" "${args[@]}"
        return $?
    fi

    # Display colored action execution start
    if type tds_text_color &>/dev/null; then
        tds_text_color "action.module"
        echo -n "${fqn%%.*}"
        tput sgr0
        tds_text_color "action.separator"
        echo -n "."
        tput sgr0
        tds_text_color "action.name"
        echo -n "${fqn#*.}"
        tput sgr0
        echo -n " "
        tds_text_color "action.tes.prefix"
        echo -n "@"
        tput sgr0
        tds_text_color "action.tes.endpoint"
        echo "${endpoint#@}"
        tput sgr0
    else
        echo "$fqn $endpoint"
    fi

    # Create transaction
    local description="$fqn $endpoint"
    local txn_id
    txn_id=$(txn_create "$description" "$endpoint" "repl")

    if [[ -z "$txn_id" ]]; then
        echo "Error: Failed to create transaction" >&2
        return 1
    fi

    echo "Transaction: $txn_id"

    # Transition to EXECUTE stage
    txn_transition "$txn_id" "EXECUTE" 2>/dev/null || true

    # Execute action
    local status=0
    if "$fn" "$endpoint" "${args[@]}"; then
        # Success - commit transaction
        txn_transition "$txn_id" "VALIDATE" 2>/dev/null || true
        txn_commit "$txn_id" 2>/dev/null || true

        if type tds_text_color &>/dev/null; then
            tds_text_color "status.success"
            echo "✓ Action completed successfully"
            tput sgr0
        else
            echo "✓ Action completed successfully"
        fi
    else
        status=$?
        # Failure - mark transaction as failed
        txn_fail "$txn_id" "Action execution failed with status $status" 2>/dev/null || true

        if type tds_text_color &>/dev/null; then
            tds_text_color "status.error"
            echo "✗ Action failed with status $status"
            tput sgr0
        else
            echo "✗ Action failed with status $status"
        fi
    fi

    return $status
}

# Execute action directly (no transaction)
_action_exec_direct() {
    local fqn="$1"
    local fn="$2"
    shift 2
    local args=("$@")

    # Display colored action execution
    if type tds_text_color &>/dev/null; then
        tds_text_color "action.module"
        echo -n "${fqn%%.*}"
        tput sgr0
        tds_text_color "action.separator"
        echo -n "."
        tput sgr0
        tds_text_color "action.name"
        echo "${fqn#*.}"
        tput sgr0
    else
        echo "$fqn"
    fi

    # Execute action
    "$fn" "${args[@]}"
}

# Export functions
export -f action_exec
export -f _action_exec_with_txn
export -f _action_exec_direct
