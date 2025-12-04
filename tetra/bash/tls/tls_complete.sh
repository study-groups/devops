#!/usr/bin/env bash
# tls_complete.sh - Tab completion for tls command
#
# Completion as documentation/exploration

# =============================================================================
# COMPLETION DATA
# =============================================================================

# Top-level subcommands
_TLS_COMMANDS="list config help"

# List options
_TLS_LIST_OPTIONS="-r -n -t -a"

# Config subcommands
_TLS_CONFIG_COMMANDS="show set get save load"

# Config keys (placeholder - will grow)
_TLS_CONFIG_KEYS="limit date_format show_hidden theme"

# Type filters
_TLS_TYPES="f d l"

# =============================================================================
# MAIN COMPLETION FUNCTION
# =============================================================================

_tls_complete() {
    local cur="${COMP_WORDS[COMP_CWORD]}"
    local prev="${COMP_WORDS[COMP_CWORD-1]}"
    local cmd="${COMP_WORDS[1]:-}"

    COMPREPLY=()

    # First argument - complete subcommands
    if [[ $COMP_CWORD -eq 1 ]]; then
        COMPREPLY=($(compgen -W "$_TLS_COMMANDS" -- "$cur"))
        return
    fi

    # Second+ argument - depends on subcommand
    case "$cmd" in
        list|l)
            case "$prev" in
                -n) COMPREPLY=($(compgen -W "5 10 20 50 100" -- "$cur")); return ;;
                -t) COMPREPLY=($(compgen -W "$_TLS_TYPES" -- "$cur")); return ;;
            esac
            if [[ "$cur" == -* ]]; then
                COMPREPLY=($(compgen -W "$_TLS_LIST_OPTIONS" -- "$cur"))
            else
                # Directory completion
                COMPREPLY=($(compgen -d -- "$cur"))
                [[ ${#COMPREPLY[@]} -eq 1 && -d "${COMPREPLY[0]}" ]] && {
                    COMPREPLY=("${COMPREPLY[0]}/")
                    compopt -o nospace
                }
            fi
            ;;

        config|c)
            if [[ $COMP_CWORD -eq 2 ]]; then
                COMPREPLY=($(compgen -W "$_TLS_CONFIG_COMMANDS" -- "$cur"))
                return
            fi
            local subcmd="${COMP_WORDS[2]:-}"
            case "$subcmd" in
                set|get)
                    if [[ $COMP_CWORD -eq 3 ]]; then
                        COMPREPLY=($(compgen -W "$_TLS_CONFIG_KEYS" -- "$cur"))
                    fi
                    ;;
                save|load)
                    # TODO: complete saved config names
                    ;;
            esac
            ;;

        help|h)
            # Complete help topics
            COMPREPLY=($(compgen -W "list config colors" -- "$cur"))
            ;;
    esac
}

# Register completion
complete -F _tls_complete tls

export -f _tls_complete
