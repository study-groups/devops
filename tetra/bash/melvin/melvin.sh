#!/usr/bin/env bash

# MELVIN - Machine Electronics Live Virtual Intelligence Network
# Core Logic and Command Dispatcher

# Strong globals
: "${MELVIN_SRC:=$TETRA_SRC/bash/melvin}"
: "${MELVIN_DIR:=$TETRA_DIR/melvin}"

# Export strong globals
export MELVIN_SRC MELVIN_DIR

# Load all MELVIN components
source "$MELVIN_SRC/melvin_classifier.sh"
source "$MELVIN_SRC/melvin_health.sh"
source "$MELVIN_SRC/melvin_scanner.sh"
source "$MELVIN_SRC/melvin_stats.sh"
source "$MELVIN_SRC/melvin_docs.sh"
source "$MELVIN_SRC/melvin_db.sh"
source "$MELVIN_SRC/melvin_repl.sh"

# Main MELVIN command dispatcher
# Usage: melvin <command> [args...]
melvin() {
    local cmd="${1:-help}"
    shift 2>/dev/null

    case "$cmd" in
        health)
            melvin_cmd_health "$@"
            ;;
        explain)
            melvin_cmd_explain "$@"
            ;;
        classify)
            melvin_cmd_classify "$@"
            ;;
        list)
            melvin_cmd_list "$@"
            ;;
        refresh)
            melvin_cmd_refresh "$@"
            ;;
        stats)
            melvin_cmd_stats "$@"
            ;;
        docs)
            melvin_cmd_docs "$@"
            ;;
        concepts)
            melvin_cmd_concepts "$@"
            ;;
        db)
            melvin_cmd_db "$@"
            ;;
        repl)
            melvin_repl
            ;;
        help|--help|-h)
            melvin_cmd_help
            ;;
        *)
            echo "Unknown command: $cmd"
            echo "Type 'melvin help' for available commands"
            return 1
            ;;
    esac
}

# Utility: echo64 (kept from original for compatibility)
echo64() {
    if [[ $# -eq 0 ]]; then
        echo -n ""
    else
        echo -n "$@" | base64 -w 0 2>/dev/null || echo -n "$@" | base64
    fi
}

# Export main function
export -f melvin
export -f echo64
