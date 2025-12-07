#!/usr/bin/env bash
# deploy.sh - Main dispatcher for deploy module
#
# Purpose: Deploy TOML-configured targets to remote environments
# Assumes: org and tkm are configured, SSH connectivity is established
#
# Pattern:
#   deploy push <target> <env>        # Full deployment pipeline
#   deploy preflight <target> <env>   # Pre-deploy checks
#   deploy status                     # Show deployment status

# =============================================================================
# STATUS
# =============================================================================

deploy_status() {
    local target="${1:-}"

    echo "Deploy Status"
    echo "============="
    echo ""

    # Show active org
    local org=$(org_active 2>/dev/null)
    if [[ -z "$org" || "$org" == "none" ]]; then
        echo "Org: (none)"
        echo "Run: org switch <name>"
        return 1
    fi
    echo "Org: $org"
    echo ""

    # Show targets
    echo "Targets:"
    local targets_dir=$(_deploy_targets_dir 2>/dev/null)

    if [[ ! -d "$targets_dir" ]] || [[ -z "$(ls -A "$targets_dir"/*.toml 2>/dev/null)" ]]; then
        echo "  (none)"
        echo "  Run: deploy target add <name>"
        return 0
    fi

    for toml in "$targets_dir"/*.toml; do
        [[ -f "$toml" ]] || continue
        local name=$(basename "$toml" .toml)

        # Filter by target if specified
        [[ -n "$target" && "$name" != "$target" ]] && continue

        if deploy_target_load "$name" 2>/dev/null; then
            echo "  $name"
            echo "    Repo:  ${TGT_REPO:-(none)}"
            echo "    Local: ${TGT_PATH_LOCAL:-(none)}"
            echo "    WWW:   ${TGT_WWW:-(none)}"
            echo "    Envs:  ${TGT_ENVS:-(none)}"
            echo ""
        fi
    done
}

# =============================================================================
# DOCTOR
# =============================================================================

deploy_doctor() {
    echo "Deploy Doctor"
    echo "============="
    echo ""

    # 1. Check org
    echo "Organization"
    echo "------------"
    local org=$(org_active 2>/dev/null)
    if [[ -z "$org" || "$org" == "none" ]]; then
        echo "  [X] No active org"
        echo "      Fix: org switch <name>"
        return 1
    fi
    echo "  [OK] $org"
    echo ""

    # 2. Check SSH connectivity
    echo "SSH Connectivity"
    echo "----------------"
    local envs=$(org_env_names 2>/dev/null)
    local ssh_ok=0
    local ssh_fail=0

    for env in $envs; do
        [[ "$env" == "local" ]] && continue
        local host=$(_org_get_host "$env")
        [[ -z "$host" ]] && continue

        local user=$(_org_get_user "$env")
        [[ -z "$user" ]] && user="root"

        if ssh $DEPLOY_SSH_OPTIONS "$user@$host" true 2>/dev/null; then
            echo "  [OK] $env ($user@$host)"
            ((ssh_ok++))
        else
            echo "  [X]  $env ($user@$host)"
            ((ssh_fail++))
        fi
    done

    if [[ $ssh_fail -gt 0 ]]; then
        echo ""
        echo "  Fix: tkm test"
        echo "       tkm deploy all"
    fi
    echo ""

    # 3. Check targets
    echo "Targets"
    echo "-------"
    local targets_dir=$(_deploy_targets_dir 2>/dev/null)

    if [[ ! -d "$targets_dir" ]] || [[ -z "$(ls -A "$targets_dir"/*.toml 2>/dev/null)" ]]; then
        echo "  [--] No targets configured"
        echo "       Run: deploy target add <name>"
    else
        for toml in "$targets_dir"/*.toml; do
            [[ -f "$toml" ]] || continue
            local name=$(basename "$toml" .toml)

            if deploy_target_load "$name" 2>/dev/null; then
                if [[ -d "$TGT_PATH_LOCAL" ]]; then
                    echo "  [OK] $name"
                else
                    echo "  [X]  $name (local path missing: $TGT_PATH_LOCAL)"
                fi
            else
                echo "  [X]  $name (failed to load TOML)"
            fi
        done
    fi
    echo ""

    # 4. Summary
    echo "Summary"
    echo "-------"
    echo "  SSH: $ssh_ok connected, $ssh_fail failed"
    if [[ $ssh_fail -eq 0 ]]; then
        echo "  Ready to deploy!"
    fi
}

# =============================================================================
# HELP
# =============================================================================

deploy_help() {
    cat << 'EOF'
deploy - Target deployment for tetra

USAGE
    deploy [command] [args]

PREREQUISITES
    org switch <name>    # Activate organization
    tkm test             # Verify SSH connectivity

STATUS & INFO
    status [target]      Show deployment status (default)
    doctor               Audit deployment setup

TARGET MANAGEMENT
    target add <name>    Register target (interactive)
    target list          List targets for org
    target show <name>   Show target config
    target edit <name>   Edit target TOML
    target remove <name> Remove target
    targets              Alias for 'target list'

ENVIRONMENT FILES
    env status <target> [env]     Show env file status
    env validate <target> <env>   Validate against tetra-deploy.toml
    env diff <target> <env>       Show local vs remote diff
    env push <target> <env>       Push local env to server
    env pull <target> <env>       Pull server env to local
    env edit <target> <env>       Edit remote env via SSH

DEPLOYMENT
    preflight <target> <env>      Run pre-deploy checks (mandatory)
    push <target> <env>           Full pipeline: preflight -> hooks -> git -> service
    push --skip-preflight ...     Bypass preflight checks

    --dry-run, -n                 Show what would be executed

NGINX CONFIG
    nginx:gen <target> <env>      Generate nginx config locally
    nginx:show <target> <env>     Show generated config
    nginx:install <target> <env>  Push to remote server
    nginx:uninstall <target> <env> Remove from remote

REMOTE MANAGEMENT
    exec <env> <cmd...>           Run command on remote

EXAMPLES
    # Setup
    deploy target add arcade              # Create target config
    # Create tetra-deploy.toml in repo    # Define deployment

    # Pre-flight
    deploy preflight arcade dev           # Check everything
    deploy env status arcade              # Check env files

    # Deploy
    deploy push --dry-run arcade dev      # Preview
    deploy push arcade dev                # Deploy to dev
    deploy push arcade prod               # Deploy to production

CONFIGURATION
    Targets stored in:
      $TETRA_DIR/orgs/<org>/targets/<name>.toml

    Repo deployment config:
      <repo>/tetra-deploy.toml

    Environment files:
      <repo>/env/<environment>.env
EOF
}

# =============================================================================
# MAIN DISPATCHER
# =============================================================================

deploy() {
    local cmd="${1:-status}"
    shift 2>/dev/null || true

    case "$cmd" in
        # Status/info
        status|s)
            deploy_status "$@"
            ;;

        doctor|doc)
            deploy_doctor "$@"
            ;;

        # Target Management (new)
        target)
            local subcmd="${1:-list}"
            shift 2>/dev/null || true
            case "$subcmd" in
                add)      deploy_target_add "$@" ;;
                list|ls)  deploy_target_list "$@" ;;
                show)     deploy_target_show "$@" ;;
                edit)     deploy_target_edit "$@" ;;
                remove|rm) deploy_target_remove "$@" ;;
                names)    deploy_target_names "$@" ;;
                *)
                    echo "Unknown: target $subcmd"
                    echo "Try: deploy target list"
                    return 1
                    ;;
            esac
            ;;

        targets|ts)
            deploy_target_list "$@"
            ;;

        # Environment file management (new)
        env)
            local subcmd="${1:-status}"
            shift 2>/dev/null || true
            case "$subcmd" in
                status)   deploy_env_status "$@" ;;
                validate) deploy_env_validate "$@" ;;
                diff)     deploy_env_diff "$@" ;;
                push)     deploy_env_push "$@" ;;
                pull)     deploy_env_pull "$@" ;;
                edit)     deploy_env_edit "$@" ;;
                *)
                    echo "Unknown: env $subcmd"
                    echo "Try: deploy env status <target>"
                    return 1
                    ;;
            esac
            ;;

        # Preflight checks (new)
        preflight|pre)
            deploy_preflight "$@"
            ;;

        # Deployment Operations
        push)
            deploy_push "$@"
            ;;

        git)
            deploy_git "$@"
            ;;

        sync)
            deploy_sync "$@"
            ;;

        perms)
            deploy_perms "$@"
            ;;

        domain:show|domain)
            deploy_domain_show "$@"
            ;;

        # Nginx config generation/installation
        nginx:gen|nginx:generate)
            deploy_nginx_generate "$@"
            ;;

        nginx:show)
            deploy_nginx_show "$@"
            ;;

        nginx:list)
            deploy_nginx_list "$@"
            ;;

        nginx:install)
            deploy_nginx_install "$@"
            ;;

        nginx:uninstall)
            deploy_nginx_uninstall "$@"
            ;;

        nginx:status)
            deploy_nginx_status "$@"
            ;;

        # Remote management
        tsm)
            deploy_tsm "$@"
            ;;

        nginx)
            deploy_nginx "$@"
            ;;

        exec)
            deploy_exec "$@"
            ;;

        # Repo config (new)
        repo)
            local subcmd="${1:-show}"
            shift 2>/dev/null || true
            case "$subcmd" in
                show)
                    local target="$1"
                    if [[ -z "$target" ]]; then
                        echo "Usage: deploy repo show <target>"
                        return 1
                    fi
                    deploy_target_load "$target" || return 1
                    deploy_repo_show "$TGT_PATH_LOCAL"
                    ;;
                *)
                    echo "Unknown: repo $subcmd"
                    return 1
                    ;;
            esac
            ;;

        # Legacy backward compatibility
        project:add|proj:add)
            echo "DEPRECATED: Use 'deploy target add' instead"
            deploy_target_add "$@"
            ;;

        project:list|proj:ls|proj:list|list|ls)
            echo "DEPRECATED: Use 'deploy target list' instead"
            deploy_target_list "$@"
            ;;

        project:edit|proj:edit|edit)
            echo "DEPRECATED: Use 'deploy target edit' instead"
            deploy_target_edit "$@"
            ;;

        project:show|proj:show|show)
            echo "DEPRECATED: Use 'deploy target show' instead"
            deploy_target_show "$@"
            ;;

        project)
            echo "DEPRECATED: Use 'deploy target' instead"
            local subcmd="${1:-list}"
            shift 2>/dev/null || true
            case "$subcmd" in
                add)      deploy_target_add "$@" ;;
                list|ls)  deploy_target_list "$@" ;;
                show)     deploy_target_show "$@" ;;
                edit)     deploy_target_edit "$@" ;;
                remove|rm) deploy_target_remove "$@" ;;
                *)
                    echo "Unknown: project $subcmd"
                    return 1
                    ;;
            esac
            ;;

        # Help
        help|h|--help|-h)
            deploy_help
            ;;

        *)
            echo "Unknown: $cmd"
            echo "Try: deploy help"
            return 1
            ;;
    esac
}

export -f deploy deploy_status deploy_doctor deploy_help
