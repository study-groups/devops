#!/usr/bin/env bash

# TView Module Integration - Tetra View

# Load new tview REPL system
source "$TETRA_SRC/bash/tview/tview_repl.sh"

# Register view command for standalone use
tetra_create_lazy_function "tview" "tview"

# Main tview command interface
tview() {
    local subcommand="${1:-repl}"
    shift

    case "$subcommand" in
        "repl"|""|*)
            # Always use the new modal REPL system
            tview_repl "$@"
            ;;
        "help"|"-h"|"--help")
            echo "Tetra View (TView)"
            echo "Usage: tview [repl]"
            echo ""
            echo "TView uses revolutionary modal navigation:"
            echo "  • Modes: TOML ← → TKM ← → TSM ← → DEPLOY (a,d keys)"
            echo "  • Envs: SYSTEM ↕ LOCAL ↕ DEV ↕ STAGING ↕ PROD (w,s keys)"
            echo "  • Items: Navigate within mode+env (j,i,k,l keys)"
            echo ""
            echo "Commands:"
            echo "  repl        Interactive view (default)"
            echo "  help        Show this help"
            ;;
    esac
}

# Main command interface for lazy loading
tetra_tview() {
    tview "$@"
}