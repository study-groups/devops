#!/usr/bin/env bash

# Dash Module Integration

# Load dashboard components
source "$TETRA_SRC/bash/dash/repl_dashboard.sh"
source "$TETRA_SRC/bash/dash/dash_repl.sh"

# Register dashboard command for standalone use
tetra_create_lazy_function "dash" "dash"

# Main dash command interface
dash() {
    local subcommand="${1:-overview}"
    shift

    case "$subcommand" in
        "repl")
            dash_repl "$@"
            ;;
        "overview"|"systems"|"env")
            tetra_repl_dashboard "$subcommand" "$@"
            ;;
        "help"|"-h"|"--help")
            echo "Tetra Dashboard"
            echo "Usage: dash <command>"
            echo ""
            echo "Commands:"
            echo "  repl        Interactive dashboard with navigation"
            echo "  overview    System overview (default)"
            echo "  systems     Detailed system health"
            echo "  env         Environment summary"
            echo "  help        Show this help"
            ;;
        *)
            # Default to overview for unknown commands
            tetra_repl_dashboard "overview" "$@"
            ;;
    esac
}

# Main command interface for lazy loading
tetra_dash() {
    dash "$@"
}