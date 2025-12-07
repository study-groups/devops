#!/usr/bin/env bash
# deploy_complete.sh - Tab completion for deploy command
#
# Provides completion for:
#   - deploy subcommands
#   - project names (from TOML)
#   - environment names

# =============================================================================
# COMPLETION DATA
# =============================================================================

_DEPLOY_COMMANDS=(
    status doctor
    project:add project:list project:show project:edit
    list show edit
    push git sync perms
    domain:show
    nginx:gen nginx:show nginx:list nginx:install nginx:uninstall nginx:status
    tsm nginx exec
    help
)

_DEPLOY_NGINX_ACTIONS="list available reload test status edit"

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

_deploy_complete_projects() {
    deploy_toml_names 2>/dev/null
}

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
        COMPREPLY=($(compgen -W "${_DEPLOY_COMMANDS[*]}" -- "$cur"))
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
            project:show|project:edit|proj:show|proj:edit|show|edit)
                COMPREPLY=($(compgen -W "$(_deploy_complete_projects)" -- "$cur"))
                return
                ;;

            # Deploy commands: complete project names
            push|git|sync|perms|domain:show|domain)
                COMPREPLY=($(compgen -W "$(_deploy_complete_projects)" -- "$cur"))
                return
                ;;

            # Nginx config commands: complete project names
            nginx:gen|nginx:generate|nginx:show|nginx:install|nginx:uninstall|nginx:status)
                COMPREPLY=($(compgen -W "$(_deploy_complete_projects)" -- "$cur"))
                return
                ;;

            # Remote commands: complete env names
            tsm|nginx|exec)
                COMPREPLY=($(compgen -W "$(_deploy_complete_envs)" -- "$cur"))
                return
                ;;

            # project:add - no completion for name
            project:add|proj:add)
                return
                ;;
        esac
    fi

    # Third argument
    if [[ $COMP_CWORD -eq 3 ]]; then
        case "$cmd" in
            # Deploy/nginx commands: complete env names
            push|git|sync|perms|domain:show|domain|\
            nginx:gen|nginx:generate|nginx:show|nginx:install|nginx:uninstall|nginx:status)
                COMPREPLY=($(compgen -W "$(_deploy_complete_envs)" -- "$cur"))
                return
                ;;

            # nginx remote: complete actions
            nginx)
                COMPREPLY=($(compgen -W "$_DEPLOY_NGINX_ACTIONS" -- "$cur"))
                return
                ;;
        esac
    fi
}

complete -F _deploy_complete deploy

# =============================================================================
# EXPORTS
# =============================================================================

export -f _deploy_complete
export -f _deploy_complete_projects _deploy_complete_envs
