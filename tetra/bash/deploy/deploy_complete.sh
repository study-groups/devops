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
    push
    status list
    show
    doctor
    help
)

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

_deploy_complete_targets() {
    local org=$(org_active 2>/dev/null)
    [[ -z "$org" || "$org" == "none" ]] && return

    local targets_dir="$TETRA_DIR/orgs/$org/targets"
    [[ ! -d "$targets_dir" ]] && return

    # .toml files (without extension)
    for f in "$targets_dir"/*.toml; do
        [[ -f "$f" ]] && basename "$f" .toml
    done

    # Directories with tetra-deploy.toml
    for d in "$targets_dir"/*/; do
        [[ -d "$d" && -f "$d/tetra-deploy.toml" ]] && basename "$d"
    done
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

    # Handle flags anywhere
    if [[ "$cur" == -* ]]; then
        COMPREPLY=($(compgen -W "--dry-run --cmd" -- "$cur"))
        return
    fi

    # Second argument - depends on command
    if [[ $COMP_CWORD -eq 2 ]]; then
        case "$cmd" in
            push|show)
                # Complete target names or envs (if cwd has tetra-deploy.toml)
                local targets=$(_deploy_complete_targets)
                local envs=$(_deploy_complete_envs)
                COMPREPLY=($(compgen -W "$targets $envs" -- "$cur"))
                return
                ;;
        esac
    fi

    # Third argument
    if [[ $COMP_CWORD -eq 3 ]]; then
        case "$cmd" in
            push|show)
                # Complete env names
                COMPREPLY=($(compgen -W "$(_deploy_complete_envs)" -- "$cur"))
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
export -f _deploy_complete_targets _deploy_complete_envs
