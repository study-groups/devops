#!/usr/bin/env bash
# Deploy Module Action Interface
# Standard interface for Mode-Module-REPL system

# Source deploy functionality if available
: "${DEPLOY_SRC:=$TETRA_SRC/bash/deploy}"

# Get actions for context
deploy_get_actions() {
    local env="${1:-Local}"
    local mode="${2:-Transfer}"

    local actions=""

    case "$env:$mode" in
        "Local:Transfer")
            actions="build:local package:artifacts test:build"
            ;;
        "Local:Execute")
            actions="deploy:local rollback:local"
            ;;
        "Dev:Transfer")
            actions="push:code sync:assets upload:build"
            ;;
        "Dev:Execute")
            actions="deploy:dev restart:services test:deployment rollback:dev"
            ;;
        "Staging:Transfer")
            actions="push:release sync:database"
            ;;
        "Staging:Execute")
            actions="deploy:staging validate:deployment rollback:staging"
            ;;
        "Production:Transfer")
            actions="push:release backup:current"
            ;;
        "Production:Execute")
            actions="deploy:prod validate:deployment rollback:prod"
            ;;
        *)
            actions="build:local"
            ;;
    esac

    echo "$actions"
}

# REPL processing function
deploy_repl_process() {
    local input="$1"

    if [[ "$input" =~ ^([a-z]+):([a-z]+)$ ]]; then
        local verb="${input%%:*}"
        local noun="${input##*:}"

        case "$verb:$noun" in
            build:local)
                echo
                echo "Building local deployment..."
                echo "(build system integration pending)"
                echo
                ;;
            deploy:*)
                echo
                echo "Deploying to: $noun"
                echo "Target: $(get_tes_target_for_env "$MODE_REPL_ENV")"
                echo "(deployment integration pending)"
                echo
                ;;
            rollback:*)
                echo
                echo "Rolling back: $noun"
                echo "(rollback integration pending)"
                echo
                ;;
            *)
                echo "Action not implemented: $input"
                echo "Type 'actions' to see available actions"
                ;;
        esac
    elif [[ "$input" == "actions" ]]; then
        local actions=$(deploy_get_actions "$MODE_REPL_ENV" "$MODE_REPL_MODE")
        echo
        echo "Available actions for $MODE_REPL_ENV:$MODE_REPL_MODE:"
        for action in $actions; do
            local marker=$(get_module_marker "deploy")
            echo "  $marker $action"
        done
        echo
    else
        echo "Unknown command: $input"
        echo "Type 'actions' for available actions"
    fi
}

# Export functions
export -f deploy_get_actions
export -f deploy_repl_process
