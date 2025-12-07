#!/usr/bin/env bash
# deploy_preflight.sh - Pre-deployment validation checks
#
# Runs comprehensive checks before deployment:
#   1. Target config valid
#   2. Local repo path exists
#   3. tetra-deploy.toml present
#   4. Env file exists and valid
#   5. SSH connectivity
#   6. Remote www path status
#   7. Domain resolution
#   8. Nginx template available
#
# Usage: deploy preflight <target> <env>

# =============================================================================
# MAIN PREFLIGHT CHECK
# =============================================================================

deploy_preflight() {
    _deploy_parse_opts "$@"
    local target="${DEPLOY_ARGS[0]}"
    local env="${DEPLOY_ARGS[1]}"

    if [[ -z "$target" || -z "$env" ]]; then
        echo "Usage: deploy preflight <target> <env>"
        return 1
    fi

    echo "Pre-flight: $target -> $env"
    echo "============================="
    echo ""

    local errors=0
    local warnings=0

    # -----------------------------------------------------
    # 1. Target config
    # -----------------------------------------------------
    printf "%-35s" "[1] Target config"
    if deploy_target_load "$target" 2>/dev/null; then
        echo "ok"
    else
        echo "FAIL (not found)"
        ((errors++))
        # Can't continue without target
        echo ""
        echo "---"
        echo "FAILED: Cannot load target '$target'"
        echo "Create with: deploy target add $target"
        return 1
    fi

    # -----------------------------------------------------
    # 2. Environment configured
    # -----------------------------------------------------
    printf "%-35s" "[2] Environment '$env' configured"
    if deploy_target_can_deploy "$env"; then
        local branch=$(deploy_target_get_branch "$env")
        local domain=$(deploy_target_get_domain "$env")
        echo "ok (branch: $branch)"
    else
        echo "FAIL (not in target config)"
        ((errors++))
    fi

    # -----------------------------------------------------
    # 3. Local repo path
    # -----------------------------------------------------
    printf "%-35s" "[3] Local repo path"
    if [[ -d "$TGT_PATH_LOCAL" ]]; then
        echo "ok ($TGT_PATH_LOCAL)"
    else
        echo "FAIL (not found: $TGT_PATH_LOCAL)"
        ((errors++))
    fi

    # -----------------------------------------------------
    # 4. Git repository
    # -----------------------------------------------------
    printf "%-35s" "[4] Git repository"
    if [[ -d "$TGT_PATH_LOCAL/.git" ]]; then
        local current_branch=$(cd "$TGT_PATH_LOCAL" && git rev-parse --abbrev-ref HEAD 2>/dev/null)
        echo "ok (on: $current_branch)"
    elif [[ -n "$TGT_REPO" ]]; then
        echo "WARN (no .git, will clone)"
        ((warnings++))
    else
        echo "FAIL (no .git and no repo URL)"
        ((errors++))
    fi

    # -----------------------------------------------------
    # 5. tetra-deploy.toml
    # -----------------------------------------------------
    printf "%-35s" "[5] tetra-deploy.toml"
    if deploy_repo_load "$TGT_PATH_LOCAL" 2>/dev/null; then
        echo "ok (type: ${REPO_TYPE:-static})"
    else
        echo "WARN (not found, using defaults)"
        ((warnings++))
    fi

    # -----------------------------------------------------
    # 6. Env file
    # -----------------------------------------------------
    printf "%-35s" "[6] Env file (${env}.env)"
    local env_file="$TGT_PATH_LOCAL/env/${env}.env"
    if [[ -f "$env_file" ]]; then
        # Validate if we have requirements
        if [[ -n "$REPO_ENV_REQUIRED" ]]; then
            if deploy_repo_validate_env "$env_file" >/dev/null 2>&1; then
                echo "ok (validated)"
            else
                echo "FAIL (missing required vars)"
                ((errors++))
            fi
        else
            echo "ok (no validation)"
        fi
    else
        echo "FAIL (not found)"
        ((errors++))
    fi

    # -----------------------------------------------------
    # 7. SSH connectivity
    # -----------------------------------------------------
    printf "%-35s" "[7] SSH connectivity"
    local ssh_target=$(_deploy_ssh_target "$env" 2>/dev/null)
    if [[ -z "$ssh_target" ]]; then
        echo "FAIL (no SSH target for '$env')"
        ((errors++))
    elif ssh $DEPLOY_SSH_OPTIONS "$ssh_target" "true" 2>/dev/null; then
        echo "ok ($ssh_target)"
    else
        echo "FAIL (cannot connect: $ssh_target)"
        ((errors++))
    fi

    # -----------------------------------------------------
    # 8. Remote www path
    # -----------------------------------------------------
    printf "%-35s" "[8] Remote www path"
    local www_path=$(deploy_target_get_www "$env")
    if [[ -z "$www_path" ]]; then
        echo "FAIL (not configured)"
        ((errors++))
    elif [[ -n "$ssh_target" ]] && _deploy_remote_exec "$ssh_target" "test -d $www_path" 2>/dev/null; then
        echo "ok ($www_path)"
    elif [[ -n "$ssh_target" ]]; then
        echo "WARN (will create: $www_path)"
        ((warnings++))
    else
        echo "skip (no SSH)"
    fi

    # -----------------------------------------------------
    # 9. Domain resolution
    # -----------------------------------------------------
    printf "%-35s" "[9] Domain"
    local domain=$(deploy_target_get_domain "$env")
    if [[ -n "$domain" ]]; then
        echo "ok ($domain)"
    else
        echo "WARN (not configured)"
        ((warnings++))
    fi

    # -----------------------------------------------------
    # 10. Nginx template (if static or needs proxy)
    # -----------------------------------------------------
    printf "%-35s" "[10] Nginx template"
    local deploy_type="${REPO_TYPE:-static}"
    if [[ "$deploy_type" == "static" ]]; then
        local template="$MOD_SRC/templates/nginx/static-subdomain.conf.tmpl"
        if [[ -f "$template" ]]; then
            echo "ok (static)"
        else
            echo "WARN (template not found)"
            ((warnings++))
        fi
    elif deploy_repo_is_service 2>/dev/null; then
        local template="$MOD_SRC/templates/nginx/proxy-subdomain.conf.tmpl"
        if [[ -f "$template" ]]; then
            echo "ok (proxy)"
        else
            echo "WARN (proxy template not found)"
            ((warnings++))
        fi
    else
        echo "skip"
    fi

    # -----------------------------------------------------
    # Summary
    # -----------------------------------------------------
    echo ""
    echo "---"

    if [[ $errors -eq 0 ]]; then
        if [[ $warnings -eq 0 ]]; then
            echo "All checks passed. Ready to deploy."
            echo ""
            echo "Next: deploy push $target $env"
        else
            echo "Passed with $warnings warning(s). Deploy will proceed."
            echo ""
            echo "Next: deploy push $target $env"
        fi
        return 0
    else
        echo "FAILED: $errors error(s), $warnings warning(s)"
        echo ""
        echo "Fix errors before deploying."
        echo "Use --skip-preflight to bypass (not recommended)."
        return 1
    fi
}

# =============================================================================
# QUICK CHECKS (for use in deploy push)
# =============================================================================

# Quick preflight - returns 0/1 without verbose output
# Usage: deploy_preflight_quick <target> <env>
deploy_preflight_quick() {
    local target="$1"
    local env="$2"

    # Load target
    deploy_target_load "$target" 2>/dev/null || return 1

    # Check env is configured
    deploy_target_can_deploy "$env" || return 1

    # Check local path exists
    [[ -d "$TGT_PATH_LOCAL" ]] || return 1

    # Check env file exists
    [[ -f "$TGT_PATH_LOCAL/env/${env}.env" ]] || return 1

    # Check SSH
    local ssh_target=$(_deploy_ssh_target "$env" 2>/dev/null) || return 1
    ssh $DEPLOY_SSH_OPTIONS "$ssh_target" "true" 2>/dev/null || return 1

    return 0
}

# =============================================================================
# EXPORTS
# =============================================================================

export -f deploy_preflight deploy_preflight_quick
