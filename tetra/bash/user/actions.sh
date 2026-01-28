#!/usr/bin/env bash
# user module actions
# Minimal actions.sh to register as a tetra module

: "${USER_SRC:=$TETRA_SRC/bash/user}"
source "$USER_SRC/user.sh" 2>/dev/null || true

user_register_actions() {
    [[ $(type -t declare_action) != "function" ]] && return 1

    declare_action "create_user" \
        "verb=create" \
        "noun=user" \
        "exec_at=@local" \
        "contexts=Local" \
        "modes=Execute" \
        "inputs=username" \
        "can=Create local user with SSH keys"

    declare_action "delete_user" \
        "verb=delete" \
        "noun=user" \
        "exec_at=@local" \
        "contexts=Local" \
        "modes=Execute" \
        "inputs=username" \
        "can=Delete local user"

    declare_action "setup_tetra" \
        "verb=setup" \
        "noun=tetra" \
        "exec_at=@local" \
        "contexts=Local" \
        "modes=Execute" \
        "inputs=username" \
        "can=Bootstrap tetra for user"
}

user_execute_action() {
    local action="$1"
    shift

    case "$action" in
        create:user)   _user_create "$@" ;;
        delete:user)   _user_delete "$@" ;;
        setup:tetra)   _user_setup_tetra "$@" ;;
        *)             echo "Unknown action: $action"; return 1 ;;
    esac
}

export -f user_register_actions user_execute_action
