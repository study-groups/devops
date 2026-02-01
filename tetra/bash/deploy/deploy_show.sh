#!/usr/bin/env bash
# deploy_show.sh - Show target configuration and context-based deployment
#
# Functions: deploy_show, deploy_with_context

deploy_show() {
    _deploy_resolve "$@" || return 1

    # If engine TOML, use engine's richer output
    if _deploy_is_engine_toml "$DEPLOY_RESOLVED_TOML"; then
        de_load "$DEPLOY_RESOLVED_TOML" || return 1
        de_show "$DEPLOY_RESOLVED_ENV"
        return $?
    fi

    _deploy_load "$DEPLOY_RESOLVED_TOML" "$DEPLOY_RESOLVED_ENV" || return 1

    echo "Target:     ${DEPLOY_NAME:-?}"
    echo "TOML:       $DEPLOY_TOML"
    echo "Mode:       $DEPLOY_MODE"
    echo "Env:        $DEPLOY_ENV"
    echo ""
    echo "Host:       $DEPLOY_HOST"
    echo "Auth user:  $DEPLOY_AUTH_USER"
    echo "Work user:  $DEPLOY_WORK_USER"
    echo "SSH:        $DEPLOY_SSH"
    echo "Remote:     ${DEPLOY_REMOTE//\{\{user\}\}/$DEPLOY_WORK_USER}"
    echo "Domain:     ${DEPLOY_DOMAIN:--}"
    echo ""
    echo "Pre:        ${DEPLOY_PRE[*]:-(none)}"
    echo "Commands:   ${DEPLOY_COMMANDS[*]:-(none)}"
    echo "Post:       ${DEPLOY_POST[*]:-(none)}"
}

# Deploy with current context using de_run engine
# Usage: deploy              (runs default pipeline)
#        deploy quick        (runs quick pipeline)
#        deploy restart      (runs restart pipeline)
deploy_with_context() {
    local pipeline="${1:-default}"
    local dry_run=0

    # Check for -n/--dry-run flag
    if [[ "$pipeline" == "-n" || "$pipeline" == "--dry-run" ]]; then
        dry_run=1
        pipeline="${2:-default}"
    fi

    if [[ -z "$DEPLOY_CTX_TARGET" ]]; then
        echo "need target" >&2
        return 1
    fi

    if [[ -z "$DEPLOY_CTX_ENV" ]]; then
        echo "need env" >&2
        return 1
    fi

    local toml
    if [[ "$DEPLOY_CTX_TARGET" == "." ]]; then
        toml="./tetra-deploy.toml"
    else
        toml=$(_deploy_find_target "$DEPLOY_CTX_TARGET")
    fi

    if [[ -z "$toml" || ! -f "$toml" ]]; then
        echo "Target TOML not found: $DEPLOY_CTX_TARGET" >&2
        return 1
    fi

    de_load "$toml" || return 1

    # Pass items if modified
    local items=""
    if [[ ${DEPLOY_CTX_ITEMS_MODIFIED:-0} -eq 1 && ${#DEPLOY_CTX_ITEMS[@]} -gt 0 ]]; then
        items="${DEPLOY_CTX_ITEMS[*]}"
    fi

    de_run "$pipeline" "$DEPLOY_CTX_ENV" "$dry_run" "$items"
}

# =============================================================================
# EXPORTS
# =============================================================================

export -f deploy_show deploy_with_context
