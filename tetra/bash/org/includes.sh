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
        "validate")
            org_validate "$@"
            ;;
        "push")
            org_push "$@"
            ;;
        "pull")
            org_pull "$@"
            ;;
        "rollback")
            org_rollback "$@"
            ;;
        "template")
            org_template "$@"
            ;;
        "templates")
            org_list_templates "$@"
            ;;
        "history")
            org_history "$@"
            ;;
        "import")
            org_import "$@"
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
            echo "  validate <org>          Validate organization configuration"
            echo "  push <org> <env>        Deploy org config to environment"
            echo "  pull <org> <env>        Sync org config from environment"
            echo "  rollback <org> <env>    Rollback to previous deployment"
            echo "  template <name> [org]   Create org from template"
            echo "  templates               List available templates"
            echo "  history <org> [env]     Show deployment history"
            echo "  import <type> <path> [org]  Import org from external source"
            echo "  help                    Show this help"
            ;;
        *)
            echo "Unknown org command: $subcommand"
            echo "Use 'tetra org help' for available commands"
            return 1
            ;;
    esac
}