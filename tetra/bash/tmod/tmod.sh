#!/usr/bin/env bash

# Tetra Module Manager (tmod) - Core module management system
# Standalone module with REPL interface

# tmod directory setup
TMOD_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TMOD_HISTORY_FILE="${TETRA_DIR}/.tmod_history"

# Source tmod components
source "$TMOD_DIR/tmod_core.sh"
source "$TMOD_DIR/tmod_repl.sh"

# Source module config system for persistent enable/disable
source "$TETRA_SRC/bash/utils/module_config.sh"

# Main tmod command interface
tmod() {
    local cmd="${1:-help}"
    shift
    
    case "$cmd" in
        repl|r)
            tmod_repl "$@"
            ;;
        load|l)
            tmod_load_module "$@"
            ;;
        unload|remove|rm)
            tmod_unload_module "$@"
            ;;
        list|ls)
            tmod_list_modules "$@"
            ;;
        find|search|f)
            tmod_find_modules "$@"
            ;;
        help|info|h)
            tmod_help "$@"
            ;;
        status|st)
            tmod_status "$@"
            ;;
        enable|e|on)
            tetra_module_enable "$@"
            ;;
        disable|d|off)
            tetra_module_disable "$@"
            ;;
        config|c)
            tetra_module_list "$@"
            ;;
        dev)
            tmod_dev "$@"
            ;;
        fix)
            tmod_fix "$@"
            ;;
        index)
            tmod_index "$@"
            ;;
        *)
            echo "Unknown command: $cmd"
            echo "Use 'tmod help' for available commands or 'tmod repl' for interactive mode"
            return 1
            ;;
    esac
}

# Tab completion for tmod
_tmod_completion() {
    local cur="${COMP_WORDS[COMP_CWORD]}"
    local prev="${COMP_WORDS[COMP_CWORD-1]}"
    local cmd="${COMP_WORDS[1]}"
    
    case "$COMP_CWORD" in
        1)
            COMPREPLY=($(compgen -W "repl load unload list find help status dev fix index" -- "$cur"))
            ;;
        2)
            case "$cmd" in
                load|l)
                    COMPREPLY=($(compgen -W "$(tetra_get_unloaded_modules)" -- "$cur"))
                    ;;
                unload|remove|rm)
                    COMPREPLY=($(compgen -W "$(tetra_get_loaded_modules)" -- "$cur"))
                    ;;
                list|ls)
                    COMPREPLY=($(compgen -W "all loaded unloaded available registered category -dev" -- "$cur"))
                    ;;
                help|info|h)
                    COMPREPLY=($(compgen -W "$(tetra_get_available_modules)" -- "$cur"))
                    ;;
                dev)
                    COMPREPLY=($(compgen -W "register list help" -- "$cur"))
                    ;;
                fix)
                    COMPREPLY=($(compgen -d -- "$cur"))
                    ;;
            esac
            ;;
        3)
            case "$cmd" in
                load|l|find|search|f)
                    if [[ "$cur" == "-"* ]]; then
                        COMPREPLY=($(compgen -W "-dev" -- "$cur"))
                    fi
                    ;;
                list|ls)
                    if [[ "$prev" != "-dev" && "$cur" == "-"* ]]; then
                        COMPREPLY=($(compgen -W "-dev" -- "$cur"))
                    fi
                    ;;
            esac
            ;;
    esac
}

# Register completion
complete -F _tmod_completion tmod
