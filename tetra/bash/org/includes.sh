#!/usr/bin/env bash

# Org Module Integration - Tetra Organization Management

# Load org management system
source "$TETRA_SRC/bash/org/tetra_org.sh"

# Register org command for tetra integration
tetra_create_lazy_function "tetra_org" "org"

# Main org command interface
tetra_org() {
    local subcommand="${1:-list}"
    shift

    case "$subcommand" in
        "list"|"ls")
            org_list "$@"
            ;;
        "switch"|"sw")
            org_switch "$@"
            ;;
        "active"|"current")
            org_active "$@"
            ;;
        "create")
            org_create "$@"
            ;;
        "push")
            org_push "$@"
            ;;
        "pull")
            org_pull "$@"
            ;;
        "sync")
            org_sync "$@"
            ;;
        "help"|"-h"|"--help")
            echo "Tetra Organization Management"
            echo "Usage: tetra org <command>"
            echo ""
            echo "Commands:"
            echo "  list, ls                List all organizations"
            echo "  switch, sw <org>        Switch to organization"
            echo "  active, current         Show active organization"
            echo "  create <org>            Create new organization"
            echo "  push <org> <env>        Deploy org config to environment"
            echo "  pull <org> <env>        Sync org config from environment"
            echo "  sync <org>              Bi-directional sync across environments"
            echo "  help                    Show this help"
            ;;
        *)
            echo "Unknown org command: $subcommand"
            echo "Use 'tetra org help' for available commands"
            return 1
            ;;
    esac
}