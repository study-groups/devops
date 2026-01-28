#!/usr/bin/env bash
# user_complete.sh - Tab completion for user command

_USER_COMMANDS="create delete list status exists setup-tetra test-install help"
_USER_CREATE_OPTS="--admin --no-ssh"
_USER_DELETE_OPTS="--backup"

_user_complete_users() {
    # Complete non-system usernames
    case "$OSTYPE" in
        darwin*)
            dscl . list /Users UniqueID 2>/dev/null | while read -r name uid; do
                [[ "$name" == _* ]] && continue
                [[ "$uid" -lt 500 ]] && continue
                [[ "$name" == "nobody" ]] && continue
                echo "$name"
            done
            ;;
        linux*)
            getent passwd 2>/dev/null | while IFS=: read -r name _ uid _; do
                [[ "$uid" -lt 1000 ]] && continue
                [[ "$uid" -eq 65534 ]] && continue
                echo "$name"
            done
            ;;
    esac
}

_user_complete() {
    local cur="${COMP_WORDS[COMP_CWORD]}"
    local prev="${COMP_WORDS[COMP_CWORD-1]}"
    local cmd="${COMP_WORDS[1]:-}"

    COMPREPLY=()

    # First argument - complete commands
    if [[ $COMP_CWORD -eq 1 ]]; then
        COMPREPLY=($(compgen -W "$_USER_COMMANDS" -- "$cur"))
        return
    fi

    # Second+ arguments based on command
    case "$cmd" in
        create|add|new)
            if [[ "$cur" == -* ]]; then
                COMPREPLY=($(compgen -W "$_USER_CREATE_OPTS" -- "$cur"))
            fi
            ;;
        delete|remove|rm)
            if [[ "$cur" == -* ]]; then
                COMPREPLY=($(compgen -W "$_USER_DELETE_OPTS" -- "$cur"))
            else
                COMPREPLY=($(compgen -W "$(_user_complete_users)" -- "$cur"))
            fi
            ;;
        status|info|show)
            COMPREPLY=($(compgen -W "$(_user_complete_users)" -- "$cur"))
            ;;
        exists|check)
            COMPREPLY=($(compgen -W "$(_user_complete_users)" -- "$cur"))
            ;;
        setup-tetra|bootstrap)
            COMPREPLY=($(compgen -W "$(_user_complete_users)" -- "$cur"))
            ;;
        test-install|test)
            # Default username suggestion
            COMPREPLY=($(compgen -W "tetratest $(_user_complete_users)" -- "$cur"))
            ;;
        list|ls|help)
            ;;
    esac
}

complete -F _user_complete user
