#!/usr/bin/env bash
# tkm_complete.sh - Tab completion for tkm command

_TKM_COMMANDS="status doctor list test generate deploy revoke rotate config remote fingerprint help"
_TKM_CONFIG_SUBCMDS="show gen edit"
_TKM_REMOTE_SUBCMDS="list audit add rm clean diff sync"

_tkm_complete_envs() {
    org_env_names 2>/dev/null | grep -v '^local$'
}

_tkm_complete_keys() {
    local keys_dir=$(tkm_keys_dir 2>/dev/null)
    [[ -z "$keys_dir" || ! -d "$keys_dir" ]] && return

    for key in "$keys_dir"/*; do
        [[ -f "$key" && ! "$key" == *.pub && ! "$key" == *.revoked.* ]] || continue
        basename "$key"
    done
}

_tkm_complete_users() {
    echo "root"
    local envs=$(org_env_names 2>/dev/null)
    for env in $envs; do
        local work_user=$(_tkm_get_work_user "$env" 2>/dev/null)
        [[ -n "$work_user" ]] && echo "$work_user"
    done | sort -u
}

_tkm_complete() {
    local cur="${COMP_WORDS[COMP_CWORD]}"
    local cmd="${COMP_WORDS[1]:-}"
    local subcmd="${COMP_WORDS[2]:-}"

    COMPREPLY=()

    # First arg - commands
    if [[ $COMP_CWORD -eq 1 ]]; then
        COMPREPLY=($(compgen -W "$_TKM_COMMANDS" -- "$cur"))
        return
    fi

    # Second arg
    if [[ $COMP_CWORD -eq 2 ]]; then
        case "$cmd" in
            generate|gen|deploy|dep|rotate|rot|test)
                COMPREPLY=($(compgen -W "all $(_tkm_complete_envs)" -- "$cur"))
                ;;
            revoke|rev)
                COMPREPLY=($(compgen -W "$(_tkm_complete_envs)" -- "$cur"))
                ;;
            config|cfg)
                COMPREPLY=($(compgen -W "$_TKM_CONFIG_SUBCMDS" -- "$cur"))
                ;;
            remote|rem)
                COMPREPLY=($(compgen -W "$_TKM_REMOTE_SUBCMDS" -- "$cur"))
                ;;
            fingerprint|fp)
                COMPREPLY=($(compgen -W "$(_tkm_complete_keys)" -- "$cur"))
                ;;
        esac
        return
    fi

    # Third arg (for remote commands)
    if [[ $COMP_CWORD -eq 3 && ( "$cmd" == "remote" || "$cmd" == "rem" ) ]]; then
        case "$subcmd" in
            list|ls|audit|add|rm|remove|clean|diff|sync)
                COMPREPLY=($(compgen -W "$(_tkm_complete_envs)" -- "$cur"))
                ;;
        esac
        return
    fi

    # Fourth arg (for remote commands - user)
    if [[ $COMP_CWORD -eq 4 && ( "$cmd" == "remote" || "$cmd" == "rem" ) ]]; then
        case "$subcmd" in
            list|ls|audit|diff|sync)
                COMPREPLY=($(compgen -W "$(_tkm_complete_users)" -- "$cur"))
                ;;
            add|rm|remove|clean)
                COMPREPLY=($(compgen -W "$(_tkm_complete_users)" -- "$cur"))
                ;;
        esac
        return
    fi

    # Fifth arg (for remote add - key file)
    if [[ $COMP_CWORD -eq 5 && ( "$cmd" == "remote" || "$cmd" == "rem" ) ]]; then
        case "$subcmd" in
            add)
                COMPREPLY=($(compgen -W "$(_tkm_complete_keys)" -- "$cur"))
                ;;
        esac
        return
    fi
}

complete -F _tkm_complete tkm

export -f _tkm_complete _tkm_complete_envs _tkm_complete_keys _tkm_complete_users
