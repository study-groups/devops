#!/usr/bin/env bash

# Tetra Module Manager (tmod) - Core module management system
# Standalone module with REPL interface

# tmod directory setup - fallback for direct usage
if [[ -z "$TMOD_SRC" ]]; then
    TMOD_SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
fi
TMOD_HISTORY_FILE="${TMOD_DIR:-$TETRA_DIR/tmod}/.tmod_history"

# Source tmod components
source "$TMOD_SRC/tmod_core.sh"
source "$TMOD_SRC/tmod_repl.sh"

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
        reload|rl)
            tmod_reload_module "$@"
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
            COMPREPLY=($(compgen -W "repl load unload reload list find help status dev fix index" -- "$cur"))
            ;;
        2)
            case "$cmd" in
                load|l)
                    COMPREPLY=($(compgen -W "$(tetra_get_unloaded_modules)" -- "$cur"))
                    ;;
                unload|remove|rm|reload|rl)
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

# === TMOD MODULE DISCOVERY INTERFACE ===
# Mandatory functions for module registry compliance

# TMOD Module Actions - Available commands/verbs
tmod_module_actions() {
    echo "load unload list find help status enable disable config dev fix index repl"
}

# TMOD Module Properties - Available data/nouns
tmod_module_properties() {
    echo "loaded_modules available_modules unloaded_modules registry config categories index"
}

# TMOD Module Information
tmod_module_info() {
    echo "TMOD - Tetra Module Manager"
    echo "Purpose: Module system management and discovery"
    echo "Scope: Load/unload modules, dependency management, module registry"

    # Show module counts if available
    if declare -f tetra_get_loaded_modules >/dev/null; then
        local loaded_count=$(tetra_get_loaded_modules | wc -w)
        echo "Loaded Modules: $loaded_count"
    fi

    if declare -f tetra_get_available_modules >/dev/null; then
        local available_count=$(tetra_get_available_modules | wc -w)
        echo "Available Modules: $available_count"
    fi
}

# TMOD Module Initialization
tmod_module_init() {
    # TMOD manages other modules, so it initializes the module system
    echo "TMOD module initialized successfully"

    # Validate core functions are available
    if ! declare -f tmod_load_module >/dev/null; then
        echo "ERROR: TMOD initialization failed - missing core functions" >&2
        return 1
    fi
}
