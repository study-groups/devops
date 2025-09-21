#!/usr/bin/env bash

# TDash Module Integration - Tetra Dashboard

# Load new tdash REPL system
source "$TETRA_SRC/bash/tdash/tdash_repl.sh"

# Register dashboard command for standalone use
tetra_create_lazy_function "tdash" "tdash"

# Main tdash command interface
tdash() {
    local subcommand="${1:-repl}"
    shift

    case "$subcommand" in
        "repl"|""|*)
            # Always use the new 4-mode REPL system
            tdash_repl "$@"
            ;;
        "help"|"-h"|"--help")
            echo "Tetra Dashboard (TDash)"
            echo "Usage: tdash [repl]"
            echo ""
            echo "TDash uses a revolutionary 4-mode, 4-environment navigation:"
            echo "  • Modes: TOML ← → TKM ← → TSM ← → DEPLOY (a,d keys)"
            echo "  • Envs: SYSTEM ↕ LOCAL ↕ DEV ↕ STAGING ↕ PROD (w,s keys)"
            echo "  • Items: Navigate within mode+env (j,i,k,l keys)"
            echo ""
            echo "Commands:"
            echo "  repl        Interactive dashboard (default)"
            echo "  help        Show this help"
            ;;
    esac
}

# Main command interface for lazy loading
tetra_tdash() {
    tdash "$@"
}