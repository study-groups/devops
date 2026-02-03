#!/usr/bin/env bash
# vocoder_complete.sh - Tab completion for vocoder CLI

_vocoder_completion() {
    local cur="${COMP_WORDS[COMP_CWORD]}"
    local cmd="${COMP_WORDS[1]:-}"

    COMPREPLY=()

    if [[ $COMP_CWORD -eq 1 ]]; then
        COMPREPLY=($(compgen -W "encode info player version help" -- "$cur"))
        return
    fi

    case "$cmd" in
        encode)
            if [[ $COMP_CWORD -eq 2 ]]; then
                COMPREPLY=($(compgen -W "opus c2" -- "$cur"))
            else
                COMPREPLY=($(compgen -f -- "$cur"))
            fi
            ;;
        info)
            COMPREPLY=($(compgen -f -- "$cur"))
            ;;
    esac
}
complete -F _vocoder_completion vocoder
