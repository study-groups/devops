#!/usr/bin/env bash
# gamma_complete.sh - Tab completion for gamma command

# All gamma subcommands
_GAMMA_COMMANDS="start stop restart status logs dashboard create join leave close list info lobby help"

# List active match codes (for join/leave/close/info)
_gamma_complete_codes() {
    local result
    result=$(gamma_send '{"type":"list"}' 2>/dev/null) || return
    echo "$result" | jq -r '.[].code' 2>/dev/null
}

# Main completion function
_gamma_complete() {
    local cur="${COMP_WORDS[COMP_CWORD]}"
    local prev="${COMP_WORDS[COMP_CWORD-1]}"
    local cmd="${COMP_WORDS[1]:-}"

    COMPREPLY=()

    # First argument - complete subcommands
    if [[ $COMP_CWORD -eq 1 ]]; then
        COMPREPLY=($(compgen -W "$_GAMMA_COMMANDS" -- "$cur"))
        return
    fi

    # Second argument - depends on command
    if [[ $COMP_CWORD -eq 2 ]]; then
        case "$cmd" in
            join|leave|close|info|get)
                # Complete with active match codes
                COMPREPLY=($(compgen -W "$(_gamma_complete_codes)" -- "$cur"))
                return
                ;;
            create)
                # Complete with known game names
                COMPREPLY=($(compgen -W "trax magnetar pong tennis" -- "$cur"))
                return
                ;;
            lobby)
                # Complete with game filter
                COMPREPLY=($(compgen -W "trax magnetar" -- "$cur"))
                return
                ;;
        esac
    fi

    # Third argument for create (options)
    if [[ $COMP_CWORD -ge 3 && "$cmd" == "create" ]]; then
        case "$prev" in
            --slots)
                COMPREPLY=($(compgen -W "2 3 4 5 6 7 8" -- "$cur"))
                return
                ;;
            *)
                COMPREPLY=($(compgen -W "--slots --public" -- "$cur"))
                return
                ;;
        esac
    fi
}

# Register completion
complete -F _gamma_complete gamma
