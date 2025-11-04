#!/usr/bin/env bash
# Org Module Action Interface
# Standard interface for Mode-Module-REPL system

# Source existing actions
source "${TETRA_SRC}/bash/org/actions.sh"

# REPL processing function for mode_repl
org_repl_process() {
    local input="$1"

    # Parse input as potential action
    if [[ "$input" =~ ^([a-z]+):([a-z]+)$ ]]; then
        local action="$input"
        local env="$MODE_REPL_ENV"

        # Execute the action
        org_execute_action "$action" "$env"
    elif [[ "$input" == "actions" ]]; then
        # List available actions
        local actions=$(org_get_actions "$MODE_REPL_ENV" "$MODE_REPL_MODE")
        echo
        echo "Available actions for $MODE_REPL_ENV:$MODE_REPL_MODE:"
        for action in $actions; do
            local marker=$(get_module_marker "org")
            echo "  $marker $action"
        done
        echo
    else
        # Treat as org command
        if [[ -f "${TETRA_SRC}/bash/org/org_repl.sh" ]]; then
            # Delegate to existing org REPL if available
            # For now, just show a message
            echo "Org command: $input"
            echo "(org REPL integration pending)"
        else
            echo "Unknown command: $input"
            echo "Type 'actions' to see available actions"
            echo "Type 'help' for REPL help"
        fi
    fi
}

# Export function
export -f org_repl_process
