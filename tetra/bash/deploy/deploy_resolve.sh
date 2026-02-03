#!/usr/bin/env bash
# deploy_resolve.sh - Target resolution and smart dispatch
#
# Functions: _deploy_is_env, _deploy_find_target, _deploy_resolve,
#            _deploy_is_engine_toml, _deploy_smart_dispatch

# =============================================================================
# TARGET RESOLUTION
# =============================================================================

# Check if arg is a known environment name
_deploy_is_env() {
    local arg="$1"

    # Check org envs if available
    if type org_env_names &>/dev/null; then
        org_env_names 2>/dev/null | grep -qx "$arg" && return 0
    fi

    # Common env names as fallback
    [[ "$arg" =~ ^(dev|staging|prod|production|local)$ ]]
}

# Find TOML file for named target
# Prefers dir/tetra-deploy.toml over name.toml (full config over simple)
_deploy_find_target() {
    local name="$1"

    # Use deploy context org, or fall back to global org
    local org=$(_deploy_active_org)
    if [[ -n "$org" && "$org" != "none" ]]; then
        # Prefer directory with tetra-deploy.toml (full pipeline config)
        local target_dir="$TETRA_DIR/orgs/$org/targets/$name"
        [[ -f "$target_dir/tetra-deploy.toml" ]] && { echo "$target_dir/tetra-deploy.toml"; return 0; }

        # Fall back to simple .toml file
        local target_file="$TETRA_DIR/orgs/$org/targets/${name}.toml"
        [[ -f "$target_file" ]] && { echo "$target_file"; return 0; }
    fi

    return 1
}

# Resolve arguments to (toml_file, env)
# Sets DEPLOY_RESOLVED_TOML, DEPLOY_RESOLVED_ENV
#
# Patterns:
#   deploy dev                  -> cwd, dev
#   deploy docs dev             -> targets/docs, dev
#   deploy push dev             -> cwd, dev
#   deploy push docs dev        -> targets/docs, dev
_deploy_resolve() {
    local arg1="${1:-}"
    local arg2="${2:-}"

    DEPLOY_RESOLVED_TOML=""
    DEPLOY_RESOLVED_ENV=""

    if [[ -z "$arg1" ]]; then
        echo "Usage: deploy <env> | deploy <target> <env>" >&2
        return 1
    fi

    # Single arg: must be env with cwd TOML
    if [[ -z "$arg2" ]]; then
        if [[ -f "./tetra-deploy.toml" ]]; then
            DEPLOY_RESOLVED_TOML="./tetra-deploy.toml"
            DEPLOY_RESOLVED_ENV="$arg1"
            return 0
        else
            echo "No tetra-deploy.toml in current directory" >&2
            echo "Usage: deploy <target> <env>" >&2
            return 1
        fi
    fi

    # Two args: target + env
    local target="$arg1"
    local env="$arg2"

    local toml=$(_deploy_find_target "$target")
    if [[ -z "$toml" ]]; then
        echo "Target not found: $target" >&2
        if type org_active &>/dev/null; then
            echo "Looked in: \$TETRA_DIR/orgs/$(org_active)/targets/" >&2
        fi
        return 1
    fi

    DEPLOY_RESOLVED_TOML="$toml"
    DEPLOY_RESOLVED_ENV="$env"
    return 0
}

# =============================================================================
# ENGINE DETECTION & SMART DISPATCH
# =============================================================================

# Check if a TOML file uses the engine format (has [pipeline] section)
_deploy_is_engine_toml() {
    grep -q '^\[pipeline\]' "$1"
}

# Smart dispatch: route bare targets through engine or legacy path
_deploy_smart_dispatch() {
    local dry_run=0 args=()
    while [[ $# -gt 0 ]]; do
        case "$1" in
            -n|--dry-run) dry_run=1; shift ;;
            *) args+=("$1"); shift ;;
        esac
    done

    _deploy_resolve "${args[@]}" || return 1

    if _deploy_is_engine_toml "$DEPLOY_RESOLVED_TOML"; then
        de_load "$DEPLOY_RESOLVED_TOML" || return 1
        de_run "default" "$DEPLOY_RESOLVED_ENV" "$dry_run"
    else
        deploy_push "${args[@]}" $( (( dry_run )) && echo "-n" )
    fi
}

# =============================================================================
# EXPORTS
# =============================================================================

