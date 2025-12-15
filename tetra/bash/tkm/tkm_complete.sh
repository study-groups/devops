#!/usr/bin/env bash
# tkm_complete.sh - Tab completion for tkm command (SSH Key Management)
#
# Provides completion for:
#   - tkm subcommands
#   - environment names (from org)
#   - key names (from keys directory)
#   - remote subcommands and args
#   - flags for destructive operations

# =============================================================================
# COMPLETION DATA
# =============================================================================

# Main tkm commands (match tkm.sh case statement)
_TKM_COMMANDS="status doctor list init test generate deploy revoke rotate config remote fingerprint help"

# Config subcommands
_TKM_CONFIG_SUBCMDS="show gen edit"

# Remote subcommands (match tkm_remote.sh)
_TKM_REMOTE_SUBCMDS="fetch list audit add rm clean diff sync help"

# Doctor options
_TKM_DOCTOR_FLAGS="--verbose -v --fix"

# List options
_TKM_LIST_FLAGS="--verbose -v --revoked --all"

# Deploy/generate flags
_TKM_DEPLOY_FLAGS="--force -f --yes -y"

# Remote operation flags
_TKM_REMOTE_FLAGS="--force -f --dry-run -n"

# Revoke flags
_TKM_REVOKE_FLAGS="--force -f --yes -y"

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

# List environment names from org (excludes 'local')
_tkm_complete_envs() {
    if type org_env_names &>/dev/null; then
        org_env_names 2>/dev/null | grep -v '^local$'
    else
        # Fallback common names
        echo "dev"
        echo "staging"
        echo "prod"
    fi
}

# List key files from keys directory
_tkm_complete_keys() {
    local keys_dir
    if type tkm_keys_dir &>/dev/null; then
        keys_dir=$(tkm_keys_dir 2>/dev/null)
    else
        local org_name
        org_name=$(type org_active &>/dev/null && org_active 2>/dev/null)
        [[ -n "$org_name" ]] && keys_dir="$TETRA_DIR/orgs/$org_name/keys"
    fi

    [[ -z "$keys_dir" || ! -d "$keys_dir" ]] && return

    for key in "$keys_dir"/*; do
        [[ -f "$key" ]] || continue
        # Skip .pub files and revoked keys
        [[ "$key" == *.pub || "$key" == *.revoked.* ]] && continue
        basename "$key"
    done
}

# List .pub key files (for add operations)
_tkm_complete_pubkeys() {
    local keys_dir
    if type tkm_keys_dir &>/dev/null; then
        keys_dir=$(tkm_keys_dir 2>/dev/null)
    fi

    [[ -z "$keys_dir" || ! -d "$keys_dir" ]] && return

    for key in "$keys_dir"/*.pub; do
        [[ -f "$key" ]] && basename "$key"
    done
}

# List users for remote operations (root + work users)
_tkm_complete_users() {
    echo "root"

    # Get work users from env configs
    if type org_env_names &>/dev/null && type _tkm_get_work_user &>/dev/null; then
        local envs=$(org_env_names 2>/dev/null)
        for env in $envs; do
            local work_user=$(_tkm_get_work_user "$env" 2>/dev/null)
            [[ -n "$work_user" ]] && echo "$work_user"
        done | sort -u
    fi
}

# Get key fingerprint for hint (first 8 chars of SHA256)
_tkm_key_fingerprint_hint() {
    local keyfile="$1"
    local keys_dir
    keys_dir=$(type tkm_keys_dir &>/dev/null && tkm_keys_dir 2>/dev/null)

    [[ -z "$keys_dir" || ! -f "$keys_dir/$keyfile.pub" ]] && return

    local fp=$(ssh-keygen -lf "$keys_dir/$keyfile.pub" 2>/dev/null | awk '{print $2}')
    [[ -n "$fp" ]] && echo "${fp:7:16}..."
}

# =============================================================================
# MAIN COMPLETION FUNCTION
# =============================================================================

_tkm_complete() {
    local cur="${COMP_WORDS[COMP_CWORD]}"
    local prev="${COMP_WORDS[COMP_CWORD-1]}"
    local cmd="${COMP_WORDS[1]:-}"
    local subcmd="${COMP_WORDS[2]:-}"

    COMPREPLY=()

    # Handle flags anywhere
    if [[ "$cur" == -* ]]; then
        case "$cmd" in
            doctor|doc)
                COMPREPLY=($(compgen -W "$_TKM_DOCTOR_FLAGS" -- "$cur"))
                ;;
            list|ls)
                COMPREPLY=($(compgen -W "$_TKM_LIST_FLAGS" -- "$cur"))
                ;;
            deploy|dep|generate|gen)
                COMPREPLY=($(compgen -W "$_TKM_DEPLOY_FLAGS" -- "$cur"))
                ;;
            revoke|rev)
                COMPREPLY=($(compgen -W "$_TKM_REVOKE_FLAGS" -- "$cur"))
                ;;
            remote|rem)
                COMPREPLY=($(compgen -W "$_TKM_REMOTE_FLAGS" -- "$cur"))
                ;;
            *)
                COMPREPLY=($(compgen -W "--verbose -v --help -h" -- "$cur"))
                ;;
        esac
        return
    fi

    # First arg - commands
    if [[ $COMP_CWORD -eq 1 ]]; then
        COMPREPLY=($(compgen -W "$_TKM_COMMANDS" -- "$cur"))
        return
    fi

    # Second arg - based on command
    if [[ $COMP_CWORD -eq 2 ]]; then
        case "$cmd" in
            # Commands that take env name
            generate|gen|deploy|dep|rotate|rot|test)
                COMPREPLY=($(compgen -W "all $(_tkm_complete_envs)" -- "$cur"))
                ;;

            # Revoke takes env (no 'all' for safety)
            revoke|rev)
                COMPREPLY=($(compgen -W "$(_tkm_complete_envs)" -- "$cur"))
                ;;

            # Config subcommands
            config|cfg)
                COMPREPLY=($(compgen -W "$_TKM_CONFIG_SUBCMDS" -- "$cur"))
                ;;

            # Remote subcommands
            remote|rem)
                COMPREPLY=($(compgen -W "$_TKM_REMOTE_SUBCMDS" -- "$cur"))
                ;;

            # Fingerprint takes key name
            fingerprint|fp)
                COMPREPLY=($(compgen -W "$(_tkm_complete_keys)" -- "$cur"))
                ;;

            # List takes flags or env
            list|ls)
                COMPREPLY=($(compgen -W "$_TKM_LIST_FLAGS $(_tkm_complete_envs)" -- "$cur"))
                ;;

            # Doctor takes flags
            doctor|doc)
                COMPREPLY=($(compgen -W "$_TKM_DOCTOR_FLAGS" -- "$cur"))
                ;;

            # Status takes optional env
            status|s)
                COMPREPLY=($(compgen -W "$(_tkm_complete_envs)" -- "$cur"))
                ;;

            # Init takes no args
            init)
                return
                ;;

            # Help takes optional topic
            help)
                COMPREPLY=($(compgen -W "remote config generate deploy" -- "$cur"))
                ;;
        esac
        return
    fi

    # Third arg - for remote commands
    if [[ $COMP_CWORD -eq 3 ]]; then
        case "$cmd" in
            remote|rem)
                case "$subcmd" in
                    # These take env name
                    fetch|get|list|ls|audit|diff|sync)
                        COMPREPLY=($(compgen -W "$(_tkm_complete_envs)" -- "$cur"))
                        ;;
                    # Add/rm/clean also take env
                    add|rm|remove|clean)
                        COMPREPLY=($(compgen -W "$(_tkm_complete_envs)" -- "$cur"))
                        ;;
                esac
                ;;

            # Generate/deploy after env: offer flags
            generate|gen|deploy|dep)
                COMPREPLY=($(compgen -W "$_TKM_DEPLOY_FLAGS" -- "$cur"))
                ;;

            # Revoke after env: offer flags
            revoke|rev)
                COMPREPLY=($(compgen -W "$_TKM_REVOKE_FLAGS" -- "$cur"))
                ;;
        esac
        return
    fi

    # Fourth arg - for remote commands (user)
    if [[ $COMP_CWORD -eq 4 && ( "$cmd" == "remote" || "$cmd" == "rem" ) ]]; then
        case "$subcmd" in
            # These take optional user
            fetch|get|list|ls|audit|diff|sync)
                COMPREPLY=($(compgen -W "$(_tkm_complete_users)" -- "$cur"))
                ;;
            # Add/rm/clean require user
            add|rm|remove|clean)
                COMPREPLY=($(compgen -W "$(_tkm_complete_users)" -- "$cur"))
                ;;
        esac
        return
    fi

    # Fifth arg - for remote add (keyfile) or rm (selector)
    if [[ $COMP_CWORD -eq 5 && ( "$cmd" == "remote" || "$cmd" == "rem" ) ]]; then
        case "$subcmd" in
            add)
                # Complete with .pub key files
                COMPREPLY=($(compgen -W "$(_tkm_complete_pubkeys)" -- "$cur"))
                ;;
            rm|remove)
                # Could be index, fingerprint, or pattern - offer keys as hint
                COMPREPLY=($(compgen -W "$(_tkm_complete_keys) 1 2 3" -- "$cur"))
                ;;
            clean)
                # Pattern - no completion, but offer example
                [[ -z "$cur" ]] && COMPREPLY=("# pattern: old-* or SHA256:...")
                ;;
        esac
        return
    fi

    # Sixth+ arg - usually flags
    if [[ $COMP_CWORD -ge 6 && ( "$cmd" == "remote" || "$cmd" == "rem" ) ]]; then
        case "$subcmd" in
            rm|remove|clean|sync)
                COMPREPLY=($(compgen -W "$_TKM_REMOTE_FLAGS" -- "$cur"))
                ;;
        esac
    fi
}

# =============================================================================
# REGISTER COMPLETION
# =============================================================================

complete -F _tkm_complete tkm

# =============================================================================
# EXPORTS
# =============================================================================

export -f _tkm_complete
export -f _tkm_complete_envs _tkm_complete_keys _tkm_complete_pubkeys
export -f _tkm_complete_users _tkm_key_fingerprint_hint
