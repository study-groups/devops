#!/usr/bin/env bash
# TSM Module Action Interface
# Standard interface for Mode-Module-REPL system

# Source TSM functionality
: "${TSM_SRC:=$TETRA_SRC/bash/tsm}"
source "$TSM_SRC/tsm.sh" 2>/dev/null || echo "TSM module not found" >&2

# Get actions for context
tsm_get_actions() {
    local env="${1:-Local}"
    local mode="${2:-Inspect}"

    local actions=""

    case "$env:$mode" in
        "Local:Inspect")
            actions="list:services status:service view:config"
            ;;
        "Local:Transfer")
            actions="export:config backup:services"
            ;;
        "Local:Execute")
            actions="start:service stop:service restart:service"
            ;;
        "Dev:Inspect")
            actions="list:services status:service view:logs"
            ;;
        "Dev:Transfer")
            actions="sync:services"
            ;;
        "Dev:Execute")
            actions="start:service stop:service restart:service deploy:service"
            ;;
        *)
            actions="list:services status:service"
            ;;
    esac

    echo "$actions"
}

# REPL processing function
tsm_repl_process() {
    local input="$1"

    if [[ "$input" =~ ^([a-z]+):([a-z]+)$ ]]; then
        local verb="${input%%:*}"
        local noun="${input##*:}"

        case "$verb:$noun" in
            list:services)
                echo
                if command -v tsm &>/dev/null; then
                    tsm list
                else
                    echo "TSM not available"
                fi
                echo
                ;;
            status:service)
                echo
                echo "Service status:"
                echo "(service name required - not yet implemented)"
                echo
                ;;
            *)
                echo "Action not implemented: $input"
                echo "Type 'actions' to see available actions"
                ;;
        esac
    elif [[ "$input" == "actions" ]]; then
        local actions=$(tsm_get_actions "$MODE_REPL_ENV" "$MODE_REPL_MODE")
        echo
        echo "Available actions for $MODE_REPL_ENV:$MODE_REPL_MODE:"
        for action in $actions; do
            local marker=$(get_module_marker "tsm")
            echo "  $marker $action"
        done
        echo
    else
        echo "Unknown command: $input"
        echo "Type 'actions' for available actions"
    fi
}

# Export functions
export -f tsm_get_actions
export -f tsm_repl_process
