#!/usr/bin/env bash
# tps/tps_complete.sh - Tab completion for tps command

# Color elements for completion
_TPS_COLOR_ELEMENTS="user git path path_dim org target env sep bracket duration error purple"

_tps_complete() {
    local cur="${COMP_WORDS[COMP_CWORD]}"
    local prev="${COMP_WORDS[COMP_CWORD-1]}"
    local cmd="${COMP_WORDS[1]:-}"

    COMPREPLY=()

    # First argument - complete subcommands
    if [[ $COMP_CWORD -eq 1 ]]; then
        local commands="style toggle multiline color osc providers hooks segments status metrics help"
        COMPREPLY=($(compgen -W "$commands" -- "$cur"))
        return
    fi

    # Second argument - depends on command
    case "$cmd" in
        style|s)
            COMPREPLY=($(compgen -W "tiny compact default verbose" -- "$cur"))
            ;;
        toggle|t)
            if [[ $COMP_CWORD -eq 2 ]]; then
                COMPREPLY=($(compgen -W "git python node logtime" -- "$cur"))
            else
                COMPREPLY=($(compgen -W "on off auto" -- "$cur"))
            fi
            ;;
        multiline|m)
            COMPREPLY=($(compgen -W "on off" -- "$cur"))
            ;;
        color|c)
            if [[ $COMP_CWORD -eq 2 ]]; then
                COMPREPLY=($(compgen -W "list set reset" -- "$cur"))
            elif [[ $COMP_CWORD -eq 3 ]]; then
                case "$prev" in
                    set|reset)
                        COMPREPLY=($(compgen -W "$_TPS_COLOR_ELEMENTS all" -- "$cur"))
                        ;;
                esac
            fi
            ;;
        osc|o)
            COMPREPLY=($(compgen -W "on off status" -- "$cur"))
            ;;
    esac
}

# Register completion for both tps and tp
complete -F _tps_complete tps
complete -F _tps_complete tp

export -f _tps_complete
