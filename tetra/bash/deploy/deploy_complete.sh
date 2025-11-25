#!/usr/bin/env bash
# deploy_complete.sh - Simple tab completion for deploy command
#
# Provides completion for:
#   - deploy subcommands
#   - project names
#   - environment names
#   - nginx actions

# =============================================================================
# COMPLETION DATA
# =============================================================================

# All deploy subcommands
_DEPLOY_COMMANDS="status doctor list add remove edit pull restart full tsm nginx exec service services help"

# Nginx subcommands
_DEPLOY_NGINX_ACTIONS="list available reload test status edit"

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

# List registered project names
_deploy_complete_projects() {
    local projects_dir="$TETRA_DIR/deploy/projects"
    [[ -d "$projects_dir" ]] || return
    for conf in "$projects_dir"/*.conf; do
        [[ -f "$conf" ]] && basename "$conf" .conf
    done
}

# List environment names (reuse org's function)
_deploy_complete_envs() {
    org_env_names 2>/dev/null
}

# =============================================================================
# MAIN COMPLETION FUNCTION
# =============================================================================

_deploy_complete() {
    local cur="${COMP_WORDS[COMP_CWORD]}"
    local prev="${COMP_WORDS[COMP_CWORD-1]}"
    local cmd="${COMP_WORDS[1]:-}"

    COMPREPLY=()

    # First argument - complete subcommands
    if [[ $COMP_CWORD -eq 1 ]]; then
        COMPREPLY=($(compgen -W "$_DEPLOY_COMMANDS" -- "$cur"))
        return
    fi

    # Handle --dry-run anywhere
    if [[ "$cur" == -* ]]; then
        COMPREPLY=($(compgen -W "--dry-run" -- "$cur"))
        return
    fi

    # Second argument - depends on command
    if [[ $COMP_CWORD -eq 2 ]]; then
        case "$cmd" in
            # Project commands: complete project names
            remove|rm|edit|pull|restart|full|service|svc|status|s)
                COMPREPLY=($(compgen -W "$(_deploy_complete_projects)" -- "$cur"))
                return
                ;;

            # Remote commands: complete env names
            tsm|nginx|exec)
                COMPREPLY=($(compgen -W "$(_deploy_complete_envs)" -- "$cur"))
                return
                ;;

            # Add: no completion for name (user types)
            add)
                return
                ;;
        esac
    fi

    # Third argument
    if [[ $COMP_CWORD -eq 3 ]]; then
        case "$cmd" in
            # Project deploy commands: complete env names
            pull|restart|full|service|svc|status|s)
                COMPREPLY=($(compgen -W "$(_deploy_complete_envs)" -- "$cur"))
                return
                ;;

            # nginx: complete actions
            nginx)
                COMPREPLY=($(compgen -W "$_DEPLOY_NGINX_ACTIONS" -- "$cur"))
                return
                ;;

            # add: directory completion for local path
            add)
                COMPREPLY=($(compgen -d -- "$cur"))
                return
                ;;
        esac
    fi

    # Fourth argument
    if [[ $COMP_CWORD -eq 4 ]]; then
        case "$cmd" in
            # add: directory completion for remote path
            add)
                COMPREPLY=($(compgen -d -- "$cur"))
                return
                ;;
        esac
    fi
}

# Register completion
complete -F _deploy_complete deploy

# =============================================================================
# EXPORTS
# =============================================================================

export -f _deploy_complete
export -f _deploy_complete_projects _deploy_complete_envs
