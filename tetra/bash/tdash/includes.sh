#!/usr/bin/env bash

# TDash Module Integration - Tetra Dashboard

# Load dashboard components
source "$TETRA_SRC/bash/tdash/repl_dashboard.sh"
source "$TETRA_SRC/bash/tdash/tdash_repl.sh"

# Register dashboard command for standalone use
tetra_create_lazy_function "tdash" "tdash"

# Main tdash command interface
tdash() {
    local subcommand="${1:-repl}"
    shift

    case "$subcommand" in
        "repl")
            tdash_repl "$@"
            ;;
        "overview"|"systems"|"env")
            tetra_repl_dashboard "$subcommand" "$@"
            ;;
        "help"|"-h"|"--help")
            echo "Tetra Dashboard (TDash)"
            echo "Usage: tdash <command>"
            echo ""
            echo "Commands:"
            echo "  repl        Interactive dashboard with 4-mode navigation (default)"
            echo "  overview    System overview"
            echo "  systems     Detailed system health"
            echo "  env         Environment summary"
            echo "  help        Show this help"
            ;;
        *)
            # Default to repl for unknown commands
            tdash_repl "$@"
            ;;
    esac
}

# Main command interface for lazy loading
tetra_tdash() {
    tdash "$@"
}