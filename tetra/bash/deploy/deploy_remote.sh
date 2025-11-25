#!/usr/bin/env bash
# deploy_remote.sh - Remote operations for deploy module
#
# Handles:
#   - Git pull on remote servers
#   - Service restart via SSH
#   - Post-deploy hooks
#
# All deployment commands support --dry-run to preview without executing

# =============================================================================
# HELPERS
# =============================================================================

# Parse --dry-run flag from args, return remaining args via DEPLOY_ARGS array
# Sets DEPLOY_DRY_RUN=1 if flag present
_deploy_parse_opts() {
    DEPLOY_DRY_RUN=0
    DEPLOY_ARGS=()

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --dry-run|-n)
                DEPLOY_DRY_RUN=1
                shift
                ;;
            *)
                DEPLOY_ARGS+=("$1")
                shift
                ;;
        esac
    done
}

# Get SSH target for environment (user@host)
_deploy_ssh_target() {
    local env="$1"

    local host=$(_org_get_host "$env")
    if [[ -z "$host" ]]; then
        echo "No host configured for: $env" >&2
        return 1
    fi

    local user=$(_org_get_work_user "$env")
    [[ -z "$user" ]] && user="$env"  # fallback to env name (dev, staging, prod)

    echo "${user}@${host}"
}

# Run command on remote server
_deploy_remote_exec() {
    local target="$1"
    shift
    local cmd="$*"

    ssh -o BatchMode=yes -o ConnectTimeout=10 "$target" "$cmd"
}

# Log deployment event
_deploy_log() {
    local project="$1"
    local env="$2"
    local action="$3"
    local status="$4"

    local log_dir="$MOD_DIR/logs"
    local log_file="$log_dir/deploy.log"

    mkdir -p "$log_dir"
    echo "$(date -Iseconds) | $project | $env | $action | $status" >> "$log_file"
}

# =============================================================================
# GIT PULL
# =============================================================================

deploy_pull() {
    _deploy_parse_opts "$@"
    local project="${DEPLOY_ARGS[0]}"
    local env="${DEPLOY_ARGS[1]}"
    local dry_run=$DEPLOY_DRY_RUN

    if [[ -z "$project" || -z "$env" ]]; then
        echo "Usage: deploy pull [--dry-run] <project> <env>"
        echo ""
        echo "Options:"
        echo "  --dry-run, -n   Show what would be executed without running"
        echo ""
        echo "Examples:"
        echo "  deploy pull arcade dev"
        echo "  deploy pull --dry-run arcade staging"
        return 1
    fi

    # Load project config
    local DEPLOY_LOCAL="" DEPLOY_REMOTE="" DEPLOY_BRANCH="" DEPLOY_POST_HOOK=""
    if ! _deploy_get_project "$project"; then
        echo "Project not found: $project"
        deploy_list
        return 1
    fi

    # Get SSH target
    local target
    target=$(_deploy_ssh_target "$env") || return 1

    local branch="${DEPLOY_BRANCH:-main}"

    [[ $dry_run -eq 1 ]] && echo "[DRY RUN]"
    echo "Deploying $project to $env"
    echo "  Target: $target"
    echo "  Path:   $DEPLOY_REMOTE"
    echo "  Branch: $branch"
    echo ""

    # Build remote command
    local remote_cmd="cd '$DEPLOY_REMOTE' && git fetch origin && git checkout '$branch' && git pull origin '$branch'"

    # Add post-hook if defined
    if [[ -n "$DEPLOY_POST_HOOK" ]]; then
        remote_cmd="$remote_cmd && $DEPLOY_POST_HOOK"
        echo "Post-hook: $DEPLOY_POST_HOOK"
        echo ""
    fi

    echo "Command:"
    echo "  ssh $target \"$remote_cmd\""
    echo ""

    if [[ $dry_run -eq 1 ]]; then
        echo "[DRY RUN] Would execute above command"
        return 0
    fi

    echo "Running git pull..."
    echo "---"

    if _deploy_remote_exec "$target" "$remote_cmd"; then
        echo "---"
        echo "Pull complete"
        _deploy_log "$project" "$env" "pull" "success"
        return 0
    else
        echo "---"
        echo "Pull FAILED"
        _deploy_log "$project" "$env" "pull" "failed"
        return 1
    fi
}

# =============================================================================
# SERVICE RESTART
# =============================================================================

deploy_restart() {
    _deploy_parse_opts "$@"
    local project="${DEPLOY_ARGS[0]}"
    local env="${DEPLOY_ARGS[1]}"
    local dry_run=$DEPLOY_DRY_RUN

    if [[ -z "$project" || -z "$env" ]]; then
        echo "Usage: deploy restart [--dry-run] <project> <env>"
        return 1
    fi

    # Load project config
    local DEPLOY_SERVICE="" DEPLOY_PRE_HOOK=""
    if ! _deploy_get_project "$project"; then
        echo "Project not found: $project"
        return 1
    fi

    local service="${DEPLOY_SERVICE:-$project}"

    # Get SSH target
    local target
    target=$(_deploy_ssh_target "$env") || return 1

    [[ $dry_run -eq 1 ]] && echo "[DRY RUN]"
    echo "Restarting $service on $env"
    echo "  Target: $target"
    echo ""

    # Build remote command
    local remote_cmd=""

    # Add pre-hook if defined
    if [[ -n "$DEPLOY_PRE_HOOK" ]]; then
        remote_cmd="$DEPLOY_PRE_HOOK && "
        echo "Pre-hook: $DEPLOY_PRE_HOOK"
    fi

    # Use tsm if available, fallback to systemctl
    remote_cmd="${remote_cmd}if command -v tsm &>/dev/null; then tsm restart $service; else sudo systemctl restart $service; fi"

    echo "Command:"
    echo "  ssh $target \"$remote_cmd\""
    echo ""

    if [[ $dry_run -eq 1 ]]; then
        echo "[DRY RUN] Would execute above command"
        return 0
    fi

    echo "Running restart..."
    echo "---"

    if _deploy_remote_exec "$target" "$remote_cmd"; then
        echo "---"
        echo "Restart complete"
        _deploy_log "$project" "$env" "restart" "success"
        return 0
    else
        echo "---"
        echo "Restart FAILED"
        _deploy_log "$project" "$env" "restart" "failed"
        return 1
    fi
}

# =============================================================================
# FULL DEPLOYMENT
# =============================================================================

deploy_full() {
    _deploy_parse_opts "$@"
    local project="${DEPLOY_ARGS[0]}"
    local env="${DEPLOY_ARGS[1]}"
    local dry_run=$DEPLOY_DRY_RUN

    if [[ -z "$project" || -z "$env" ]]; then
        echo "Usage: deploy full [--dry-run] <project> <env>"
        return 1
    fi

    local dry_flag=""
    [[ $dry_run -eq 1 ]] && dry_flag="--dry-run"

    [[ $dry_run -eq 1 ]] && echo "[DRY RUN]"
    echo "Full deployment: $project -> $env"
    echo "================================="
    echo ""

    # Step 1: Git pull
    echo "[1/2] Git pull"
    echo "--------------"
    if ! deploy_pull $dry_flag "$project" "$env"; then
        [[ $dry_run -eq 0 ]] && echo ""
        [[ $dry_run -eq 0 ]] && echo "Deployment ABORTED (pull failed)"
        [[ $dry_run -eq 0 ]] && return 1
    fi
    echo ""

    # Step 2: Restart service
    echo "[2/2] Restart service"
    echo "---------------------"
    if ! deploy_restart $dry_flag "$project" "$env"; then
        [[ $dry_run -eq 0 ]] && echo ""
        [[ $dry_run -eq 0 ]] && echo "Deployment PARTIAL (restart failed)"
        [[ $dry_run -eq 0 ]] && return 1
    fi
    echo ""

    echo "================================="
    if [[ $dry_run -eq 1 ]]; then
        echo "[DRY RUN] Would deploy: $project -> $env"
    else
        echo "Deployment COMPLETE: $project -> $env"
        _deploy_log "$project" "$env" "full" "success"
    fi
}

# =============================================================================
# TSM SERVICE INTEGRATION
# =============================================================================

# Create TSM service definition for a project
deploy_service() {
    local project="$1"
    local env="${2:-local}"

    if [[ -z "$project" ]]; then
        echo "Usage: deploy service <project> [env]"
        echo ""
        echo "Creates a TSM service definition for the project."
        echo "Default env: local"
        return 1
    fi

    # Load project config
    local DEPLOY_LOCAL="" DEPLOY_REMOTE="" DEPLOY_SERVICE=""
    if ! _deploy_get_project "$project"; then
        echo "Project not found: $project"
        return 1
    fi

    local service="${DEPLOY_SERVICE:-$project}"
    local services_dir="$TETRA_DIR/tsm/services-available"
    mkdir -p "$services_dir"

    local service_file="$services_dir/${service}.tsm"

    # Determine working directory based on env
    local cwd
    if [[ "$env" == "local" ]]; then
        cwd="$DEPLOY_LOCAL"
    else
        cwd="$DEPLOY_REMOTE"
    fi

    cat > "$service_file" << EOF
#!/usr/bin/env bash
# TSM Service: $service
# Project: $project
# Environment: $env
# Generated by: deploy service $project $env
# Created: $(date -Iseconds)

TSM_NAME="$service"
TSM_CWD="$cwd"
TSM_ENV="$env"

# Start command - customize as needed
# Examples:
#   TSM_COMMAND="npm start"
#   TSM_COMMAND="python app.py"
#   TSM_COMMAND="./start.sh"
TSM_COMMAND="npm start"

# Optional description
TSM_DESCRIPTION="$project deployed to $env"
EOF

    chmod +x "$service_file"

    echo "Created TSM service: $service_file"
    echo ""
    echo "Edit to customize start command:"
    echo "  \$EDITOR $service_file"
    echo ""
    echo "Then:"
    echo "  tsm enable $service   # Enable for autostart"
    echo "  tsm start $service    # Start now"
}

# List TSM services for registered projects
deploy_services() {
    local services_dir="$TETRA_DIR/tsm/services-available"

    echo "TSM Services for Projects"
    echo "========================="
    echo ""

    if [[ ! -d "$services_dir" ]]; then
        echo "(none)"
        return 0
    fi

    # Get project names
    local projects=$(deploy_project_names)

    for project in $projects; do
        local DEPLOY_SERVICE=""
        _deploy_get_project "$project" 2>/dev/null
        local service="${DEPLOY_SERVICE:-$project}"

        local service_file="$services_dir/${service}.tsm"
        if [[ -f "$service_file" ]]; then
            local enabled=""
            [[ -L "$TETRA_DIR/tsm/services-enabled/${service}.tsm" ]] && enabled=" [enabled]"
            echo "  $project -> $service$enabled"
        else
            echo "  $project -> (no service)"
        fi
    done
    echo ""
    echo "Create with: deploy service <project> [env]"
}

# =============================================================================
# REMOTE TSM MANAGEMENT
# =============================================================================

# Run tsm command on remote server
deploy_tsm() {
    _deploy_parse_opts "$@"
    local env="${DEPLOY_ARGS[0]}"
    shift  # Remove env from args
    local tsm_cmd="${DEPLOY_ARGS[@]:1}"  # Rest of args are tsm command

    if [[ -z "$env" ]]; then
        echo "Usage: deploy tsm <env> <tsm-command...>"
        echo ""
        echo "Run TSM commands on remote server."
        echo ""
        echo "Examples:"
        echo "  deploy tsm dev list"
        echo "  deploy tsm dev logs arcade"
        echo "  deploy tsm dev restart arcade"
        echo "  deploy tsm staging services"
        return 1
    fi

    # Get SSH target
    local target
    target=$(_deploy_ssh_target "$env") || return 1

    # Default to 'list' if no command given
    [[ -z "$tsm_cmd" ]] && tsm_cmd="list"

    echo "TSM on $env ($target)"
    echo "Command: tsm $tsm_cmd"
    echo "---"

    _deploy_remote_exec "$target" "tsm $tsm_cmd"
}

# =============================================================================
# REMOTE NGINX MANAGEMENT
# =============================================================================

deploy_nginx() {
    _deploy_parse_opts "$@"
    local env="${DEPLOY_ARGS[0]}"
    local action="${DEPLOY_ARGS[1]:-list}"

    if [[ -z "$env" ]]; then
        echo "Usage: deploy nginx <env> [action]"
        echo ""
        echo "Actions:"
        echo "  list      List enabled sites (default)"
        echo "  available List available sites"
        echo "  reload    Reload nginx configuration"
        echo "  test      Test nginx configuration"
        echo "  status    Show nginx status"
        echo "  edit <site>  Edit site config"
        echo ""
        echo "Examples:"
        echo "  deploy nginx dev"
        echo "  deploy nginx dev reload"
        echo "  deploy nginx staging test"
        return 1
    fi

    local target
    target=$(_deploy_ssh_target "$env") || return 1

    local remote_cmd
    case "$action" in
        list)
            remote_cmd="ls -la /etc/nginx/sites-enabled/"
            ;;
        available)
            remote_cmd="ls -la /etc/nginx/sites-available/"
            ;;
        reload)
            remote_cmd="sudo nginx -t && sudo systemctl reload nginx"
            ;;
        test)
            remote_cmd="sudo nginx -t"
            ;;
        status)
            remote_cmd="sudo systemctl status nginx --no-pager"
            ;;
        edit)
            local site="${DEPLOY_ARGS[2]}"
            if [[ -z "$site" ]]; then
                echo "Usage: deploy nginx $env edit <site>"
                return 1
            fi
            # Can't really edit remotely, but we can show the file
            remote_cmd="cat /etc/nginx/sites-available/$site"
            ;;
        *)
            echo "Unknown action: $action"
            return 1
            ;;
    esac

    echo "Nginx on $env ($target)"
    echo "---"

    _deploy_remote_exec "$target" "$remote_cmd"
}

# =============================================================================
# GENERIC REMOTE EXEC
# =============================================================================

# Run arbitrary command on remote server for a project's environment
deploy_exec() {
    _deploy_parse_opts "$@"
    local env="${DEPLOY_ARGS[0]}"
    local cmd="${DEPLOY_ARGS[*]:1}"
    local dry_run=$DEPLOY_DRY_RUN

    if [[ -z "$env" || -z "$cmd" ]]; then
        echo "Usage: deploy exec [--dry-run] <env> <command...>"
        echo ""
        echo "Run arbitrary command on remote server."
        echo ""
        echo "Examples:"
        echo "  deploy exec dev 'ls -la'"
        echo "  deploy exec dev 'pm2 list'"
        echo "  deploy exec staging 'df -h'"
        echo "  deploy exec --dry-run prod 'systemctl status nginx'"
        return 1
    fi

    local target
    target=$(_deploy_ssh_target "$env") || return 1

    [[ $dry_run -eq 1 ]] && echo "[DRY RUN]"
    echo "Remote exec on $env"
    echo "  Target: $target"
    echo "  Command: $cmd"
    echo ""

    if [[ $dry_run -eq 1 ]]; then
        echo "[DRY RUN] Would execute: ssh $target \"$cmd\""
        return 0
    fi

    echo "---"
    _deploy_remote_exec "$target" "$cmd"
}

export -f deploy_pull deploy_restart deploy_full deploy_service deploy_services
export -f deploy_tsm deploy_nginx deploy_exec
export -f _deploy_ssh_target _deploy_remote_exec _deploy_log _deploy_parse_opts
