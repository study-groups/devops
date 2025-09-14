#!/usr/bin/env bash

# tmod Module Index - Self-describing module metadata

tetra_register_module_meta "tmod" \
    "Tetra Module Manager - Interactive module management system" \
    "tmod" \
    "tmod:repl|load|unload|list|find|help|status|dev|fix|index" \
    "core" "stable"

# tmod-specific tab completion
_tmod_enhanced_completion() {
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
                    COMPREPLY=($(compgen -W "$(tetra_get_unloaded_modules 2>/dev/null || echo '')" -- "$cur"))
                    ;;
                unload|remove|rm)
                    COMPREPLY=($(compgen -W "$(tetra_get_loaded_modules 2>/dev/null || echo '')" -- "$cur"))
                    ;;
                list|ls)
                    COMPREPLY=($(compgen -W "all loaded unloaded available registered category -dev" -- "$cur"))
                    ;;
                find|search|f)
                    COMPREPLY=($(compgen -W "service key deploy python node" -- "$cur"))
                    ;;
                help|info|h)
                    COMPREPLY=($(compgen -W "$(tetra_get_available_modules 2>/dev/null || echo '')" -- "$cur"))
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

# Override the basic completion with enhanced version
complete -F _tmod_enhanced_completion tmod
