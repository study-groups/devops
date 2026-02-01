#!/usr/bin/env bash
# deploy_push.sh - Legacy push deployment and TSM build integration
#
# Functions: _deploy_tsm_needs_rebuild, _deploy_tsm_build_if_needed, deploy_push

# =============================================================================
# TSM BUILD INTEGRATION
# =============================================================================

# Check if .tsm file needs rebuild
# Returns 0 if rebuild needed, 1 if up to date
# Usage: _deploy_tsm_needs_rebuild <toml_dir> <env>
_deploy_tsm_needs_rebuild() {
    local toml_dir="$1"
    local env="$2"

    # Check for env.toml (convention: proj/tsm/env.toml)
    local env_toml=""
    if [[ -f "$toml_dir/tsm/env.toml" ]]; then
        env_toml="$toml_dir/tsm/env.toml"
    elif [[ -f "$toml_dir/env.toml" ]]; then
        env_toml="$toml_dir/env.toml"
    fi

    # No env.toml = no tsm build needed
    [[ -z "$env_toml" ]] && return 1

    # Get service name from env.toml
    local name
    name=$(_tsm_toml_get "$env_toml" "service" "name" 2>/dev/null)
    [[ -z "$name" ]] && return 1

    # Expected .tsm file location (sibling to env.toml)
    local tsm_file="$(dirname "$env_toml")/${name}-${env}.tsm"

    # Missing?
    [[ ! -f "$tsm_file" ]] && return 0

    # Stale? (env.toml newer than .tsm)
    [[ "$env_toml" -nt "$tsm_file" ]] && return 0

    # Check secrets.env staleness
    local org
    org=$(_tsm_toml_get "$env_toml" "service" "org" 2>/dev/null)
    [[ -z "$org" ]] && org="${TETRA_ORG:-tetra}"

    local secrets="$TETRA_DIR/orgs/$org/secrets.env"
    [[ -f "$secrets" && "$secrets" -nt "$tsm_file" ]] && return 0

    return 1  # up to date
}

# Run tsm build if needed for the target
# Usage: _deploy_tsm_build_if_needed <toml_dir> <env> <force>
_deploy_tsm_build_if_needed() {
    local toml_dir="$1"
    local env="$2"
    local force="${3:-0}"

    # Check for env.toml
    local env_toml=""
    if [[ -f "$toml_dir/tsm/env.toml" ]]; then
        env_toml="$toml_dir/tsm/env.toml"
    elif [[ -f "$toml_dir/env.toml" ]]; then
        env_toml="$toml_dir/env.toml"
    fi

    # No env.toml = skip
    [[ -z "$env_toml" ]] && return 0

    if [[ "$force" -eq 1 ]] || _deploy_tsm_needs_rebuild "$toml_dir" "$env"; then
        echo "[tsm build]"
        if [[ "$force" -eq 1 ]]; then
            echo "  Forcing rebuild..."
        else
            echo "  Rebuilding (stale)..."
        fi
        (cd "$toml_dir" && tsm_build "$env") || {
            echo "  tsm build failed" >&2
            return 1
        }
        echo ""
    else
        echo "[tsm build] up to date"
        echo ""
    fi

    return 0
}

# =============================================================================
# LEGACY PUSH
# =============================================================================

deploy_push() {
    local dry_run=0
    local force_build=0
    local args=()
    local start_time=$SECONDS

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --dry-run|-n) dry_run=1; shift ;;
            --force|-f) force_build=1; shift ;;
            *) args+=("$1"); shift ;;
        esac
    done

    _deploy_resolve "${args[@]}" || return 1
    _deploy_load "$DEPLOY_RESOLVED_TOML" "$DEPLOY_RESOLVED_ENV" || return 1

    local target_name="${DEPLOY_NAME:-$(basename "$DEPLOY_TOML_DIR")}"

    echo "========================================"
    echo "Deploy: $target_name -> $DEPLOY_ENV"
    echo "========================================"
    echo ""
    echo "Mode:   $DEPLOY_MODE"
    echo "Target: $DEPLOY_TOML"
    echo "Remote: ${DEPLOY_SSH}:${DEPLOY_REMOTE//\{\{user\}\}/$DEPLOY_WORK_USER}"
    [[ -n "$DEPLOY_DOMAIN" ]] && echo "Domain: $DEPLOY_DOMAIN"
    [[ "$dry_run" -eq 1 ]] && echo "[DRY RUN]"
    [[ "$force_build" -eq 1 ]] && echo "[FORCE BUILD]"
    echo ""

    # TSM build (if env.toml exists and stale/missing, or -f)
    if [[ "$dry_run" -eq 0 ]]; then
        _deploy_tsm_build_if_needed "$DEPLOY_TOML_DIR" "$DEPLOY_ENV" "$force_build" || return 1
    fi

    # Pre hooks
    if [[ ${#DEPLOY_PRE[@]} -gt 0 ]]; then
        echo "[pre]"
        for cmd in "${DEPLOY_PRE[@]}"; do
            (cd "$DEPLOY_TOML_DIR" && _deploy_exec "$cmd" "$dry_run") || return 1
        done
        echo ""
    fi

    # Commands
    if [[ ${#DEPLOY_COMMANDS[@]} -gt 0 ]]; then
        echo "[commands]"
        for cmd in "${DEPLOY_COMMANDS[@]}"; do
            (cd "$DEPLOY_TOML_DIR" && _deploy_exec "$cmd" "$dry_run") || return 1
        done
        echo ""
    fi

    # Post hooks
    if [[ ${#DEPLOY_POST[@]} -gt 0 ]]; then
        echo "[post]"
        for cmd in "${DEPLOY_POST[@]}"; do
            (cd "$DEPLOY_TOML_DIR" && _deploy_exec "$cmd" "$dry_run") || {
                local duration=$((SECONDS - start_time))
                _deploy_log "$target_name" "$DEPLOY_ENV" "push" "failed" "$duration"
                return 1
            }
        done
        echo ""
    fi

    local duration=$((SECONDS - start_time))

    echo "========================================"
    echo "Done (${duration}s)"
    echo "========================================"

    # Log successful deployment (skip for dry runs)
    if [[ "$dry_run" -eq 0 ]]; then
        _deploy_log "$target_name" "$DEPLOY_ENV" "push" "success" "$duration"
    fi
}

# =============================================================================
# EXPORTS
# =============================================================================

export -f deploy_push
export -f _deploy_tsm_needs_rebuild _deploy_tsm_build_if_needed
