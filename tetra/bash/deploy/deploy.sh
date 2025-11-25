#!/usr/bin/env bash
# deploy.sh - Main dispatcher for deploy module
#
# Purpose: Deploy projects to remote environments
# Assumes: org and tkm are configured, SSH connectivity is established
#
# Pattern:
#   deploy add <project> <local_path> <remote_path>
#   deploy pull <project> <env>       # git pull on remote
#   deploy restart <project> <env>    # restart via tsm
#   deploy status [project] [env]     # show deployment status
#
# Projects are defined in $TETRA_DIR/deploy/projects/<name>.conf

DEPLOY_SRC="${TETRA_SRC}/bash/deploy"

# =============================================================================
# STATUS
# =============================================================================

deploy_status() {
    local project="${1:-}"
    local env="${2:-}"

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

    # Show projects
    echo "Projects:"
    local projects_dir="$MOD_DIR/projects"
    if [[ ! -d "$projects_dir" ]] || [[ -z "$(ls -A "$projects_dir" 2>/dev/null)" ]]; then
        echo "  (none registered)"
        echo "  Run: deploy add <name> <local_path> <remote_path>"
        return 0
    fi

    for conf in "$projects_dir"/*.conf; do
        [[ -f "$conf" ]] || continue
        local name=$(basename "$conf" .conf)

        # Filter by project if specified
        [[ -n "$project" && "$name" != "$project" ]] && continue

        # Source config
        local DEPLOY_LOCAL="" DEPLOY_REMOTE="" DEPLOY_SERVICE=""
        source "$conf"

        echo "  $name"
        echo "    Local:   $DEPLOY_LOCAL"
        echo "    Remote:  $DEPLOY_REMOTE"
        [[ -n "$DEPLOY_SERVICE" ]] && echo "    Service: $DEPLOY_SERVICE"
        echo ""
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

        if ssh -o BatchMode=yes -o ConnectTimeout=3 "$user@$host" true 2>/dev/null; then
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

    # 3. Check projects
    echo "Projects"
    echo "--------"
    local projects_dir="$MOD_DIR/projects"
    if [[ ! -d "$projects_dir" ]] || [[ -z "$(ls -A "$projects_dir" 2>/dev/null)" ]]; then
        echo "  [--] No projects registered"
        echo "       Run: deploy add <name> <local_path> <remote_path>"
    else
        for conf in "$projects_dir"/*.conf; do
            [[ -f "$conf" ]] || continue
            local name=$(basename "$conf" .conf)
            local DEPLOY_LOCAL="" DEPLOY_REMOTE=""
            source "$conf"

            if [[ -d "$DEPLOY_LOCAL" ]]; then
                echo "  [OK] $name"
            else
                echo "  [X]  $name (local path missing: $DEPLOY_LOCAL)"
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
deploy - Project deployment for tetra

USAGE
    deploy [command] [args]

PREREQUISITES
    org switch <name>    # Activate organization
    tkm test             # Verify SSH connectivity

COMMANDS
    status [project]     Show deployment status (default)
    doctor               Audit deployment setup
    list, ls             List registered projects

PROJECT MANAGEMENT
    add <name> <local> <remote>   Register a project
    remove <name>                 Unregister a project
    edit <name>                   Edit project config

DEPLOYMENT (all support --dry-run)
    pull <project> <env>          Git pull on remote server
    restart <project> <env>       Restart service via tsm
    full <project> <env>          Pull + restart

REMOTE MANAGEMENT
    tsm <env> <cmd...>            Run TSM command on remote
    nginx <env> [action]          Manage nginx (list/reload/test/status)
    exec <env> <cmd...>           Run arbitrary command on remote

SERVICE INTEGRATION
    service <project> <env>       Create TSM service definition
    services                      List TSM services for projects

OPTIONS
    --dry-run, -n                 Show what would be executed

EXAMPLES
    # Register and deploy a project
    deploy add arcade ~/src/arcade /home/dev/arcade
    deploy pull arcade dev        # Git pull on dev server
    deploy restart arcade dev     # Restart arcade service
    deploy full arcade dev        # Pull and restart
    deploy full --dry-run arcade staging  # Preview staging deploy

    # Remote TSM management
    deploy tsm dev list           # List processes on dev
    deploy tsm dev logs arcade    # View arcade logs on dev
    deploy tsm staging restart arcade

    # Remote nginx management
    deploy nginx dev              # List enabled sites
    deploy nginx dev reload       # Reload nginx config
    deploy nginx staging test     # Test nginx config

    # Generic remote commands
    deploy exec dev 'df -h'       # Check disk space
    deploy exec prod 'pm2 list'   # List PM2 processes

WORKFLOW
    1. org switch myorg           # Activate org
    2. tkm test                   # Verify SSH
    3. deploy add arcade ~/src/arcade /home/dev/arcade
    4. deploy full --dry-run arcade dev  # Preview
    5. deploy full arcade dev     # Deploy to dev
    6. deploy tsm dev list        # Verify running
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

        # Project management
        list|ls)
            deploy_list "$@"
            ;;

        add)
            deploy_add "$@"
            ;;

        remove|rm)
            deploy_remove "$@"
            ;;

        edit)
            deploy_edit "$@"
            ;;

        # Deployment operations
        pull)
            deploy_pull "$@"
            ;;

        restart)
            deploy_restart "$@"
            ;;

        full)
            deploy_full "$@"
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

        # Service integration
        service|svc)
            deploy_service "$@"
            ;;

        services)
            deploy_services "$@"
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
