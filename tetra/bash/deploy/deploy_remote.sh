#!/usr/bin/env bash
# deploy_remote.sh - Remote deployment operations for TOML projects
#
# All commands support --dry-run to preview without executing.
# Uses centralized helpers from includes.sh.

# =============================================================================
# REMOTE TSM MANAGEMENT
# =============================================================================

deploy_tsm() {
    _deploy_parse_opts "$@"
    local env="${DEPLOY_ARGS[0]}"
    local tsm_cmd="${DEPLOY_ARGS[*]:1}"

    if [[ -z "$env" ]]; then
        echo "Usage: deploy tsm <env> <tsm-command...>"
        echo ""
        echo "Examples:"
        echo "  deploy tsm dev list"
        echo "  deploy tsm dev logs myapp"
        echo "  deploy tsm dev restart myapp"
        return 1
    fi

    local target
    target=$(_deploy_ssh_target "$env") || return 1

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
        return 1
    fi

    local target
    target=$(_deploy_ssh_target "$env") || return 1

    local remote_cmd
    case "$action" in
        list)
            remote_cmd="ls -la $DEPLOY_NGINX_SITES_ENABLED/"
            ;;
        available)
            remote_cmd="ls -la $DEPLOY_NGINX_SITES_AVAILABLE/"
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
            remote_cmd="cat $DEPLOY_NGINX_SITES_AVAILABLE/$site"
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

deploy_exec() {
    _deploy_parse_opts "$@"
    local env="${DEPLOY_ARGS[0]}"
    local cmd="${DEPLOY_ARGS[*]:1}"
    local dry_run=$DEPLOY_DRY_RUN

    if [[ -z "$env" || -z "$cmd" ]]; then
        echo "Usage: deploy exec [--dry-run] <env> <command...>"
        echo ""
        echo "Examples:"
        echo "  deploy exec dev 'ls -la'"
        echo "  deploy exec dev 'pm2 list'"
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

# =============================================================================
# DEPLOY PUSH - Full Pipeline for TOML Projects
# =============================================================================

deploy_push() {
    local project env dry_run with_env force
    _deploy_setup "push" "$@" || return 1

    if ! deploy_toml_can_deploy "$env"; then
        echo "Project '$project' cannot deploy to '$env'"
        echo "Allowed: ${PROJ_ENVS:-all}"
        return 1
    fi

    local dry_flag=""
    [[ $dry_run -eq 1 ]] && dry_flag="--dry-run"

    # Determine step count based on project type
    local total_steps=7
    [[ "${PROJ_TYPE:-static}" == "service" ]] && total_steps=8

    [[ $dry_run -eq 1 ]] && echo "[DRY RUN]"
    echo "============================================"
    echo "Deploy Push: $project -> $env"
    echo "============================================"
    echo ""

    # Step 1: Show config
    echo "[1/$total_steps] Project config"
    echo "----------------------------"
    echo "Project:  $PROJ_NAME"
    echo "Type:     ${PROJ_TYPE:-static}"
    echo "Local:    $PROJ_PATH_LOCAL"
    echo "WWW:      $(deploy_toml_get_www "$env")"
    [[ $with_env -eq 1 ]] && echo "Env sync: enabled"
    echo ""

    # Step 2: Resolve SSH target and domain
    echo "[2/$total_steps] Resolving targets"
    echo "----------------------"
    local target
    target=$(_deploy_ssh_target "$env") || return 1

    local domain
    domain=$(deploy_domain_resolve "$env") || return 1
    local www_path=$(deploy_toml_get_www "$env")
    local branch=$(deploy_toml_get_branch "$env")

    echo "SSH:    $target"
    echo "Domain: $domain"
    echo "Branch: $branch"
    echo ""

    # Step 2.5: Env file sync (if --with-env)
    if [[ $with_env -eq 1 ]]; then
        echo "[2.5/$total_steps] Environment file sync"
        echo "------------------------"
        local env_file="$PROJ_PATH_LOCAL/env/${env}.env"
        if [[ -f "$env_file" ]]; then
            echo "Local: $env_file"
            if [[ $dry_run -eq 1 ]]; then
                echo "[DRY RUN] Would sync env file"
            else
                local force_flag=""
                [[ $force -eq 1 ]] && force_flag="--force"
                if ! project_env_push "$project" "$env" $force_flag </dev/null; then
                    echo "WARNING: Env sync failed (continuing)"
                fi
            fi
        else
            echo "No local env file: $env_file"
        fi
        echo ""
    fi

    # Step 3: Git clone or pull
    echo "[3/$total_steps] Git operations"
    echo "--------------------"
    local git_cmd
    local remote_exists="unknown"

    if [[ $dry_run -eq 0 ]]; then
        if _deploy_remote_exec "$target" "test -d $www_path/.git" 2>/dev/null; then
            remote_exists="yes"
        else
            remote_exists="no"
        fi
    fi

    if [[ "$remote_exists" == "no" ]]; then
        echo "Remote path does not exist - will clone"
        if [[ -z "$PROJ_GIT_REPO" ]]; then
            echo "FAILED: No git repo URL configured"
            return 1
        fi
        git_cmd="git clone $PROJ_GIT_REPO $www_path && cd $www_path && git checkout $branch"
    else
        echo "Remote path exists - will pull"
        git_cmd="cd $www_path && git fetch origin && git checkout $branch && git pull origin $branch"
    fi

    echo "Command: ssh $target \"$git_cmd\""

    if [[ $dry_run -eq 1 ]]; then
        echo "[DRY RUN] Would execute git command"
    else
        if ! _deploy_remote_exec "$target" "$git_cmd"; then
            echo "FAILED: Git operation failed"
            _deploy_log "$project" "$env" "push:git" "failed"
            return 1
        fi
    fi
    echo ""

    # Step 4: Post-pull hook
    echo "[4/$total_steps] Post-pull hook"
    echo "--------------------"
    if [[ -n "$PROJ_HOOK_POST_PULL" ]]; then
        local hook_cmd="cd $www_path && $PROJ_HOOK_POST_PULL"
        echo "Hook: $PROJ_HOOK_POST_PULL"
        echo "Command: ssh $target \"$hook_cmd\""

        if [[ $dry_run -eq 1 ]]; then
            echo "[DRY RUN] Would execute hook"
        else
            if ! _deploy_remote_exec "$target" "$hook_cmd"; then
                echo "WARNING: Hook failed (continuing)"
            fi
        fi
    else
        echo "(no hook configured)"
    fi
    echo ""

    # Step 5: Rsync assets (if enabled)
    echo "[5/$total_steps] Rsync assets"
    echo "------------------"
    if [[ "${PROJ_RSYNC_ENABLED:-false}" == "true" ]]; then
        local rsync_source="${PROJ_PATH_LOCAL}/${PROJ_RSYNC_SOURCE:-.}"

        # Build exclude list
        local -a excludes=()
        for excl in $PROJ_RSYNC_EXCLUDE; do
            excludes+=("$excl")
        done

        echo "Source: $rsync_source"
        echo "Dest:   $target:$www_path/"
        echo "Excludes: ${PROJ_RSYNC_EXCLUDE:-none}"

        _deploy_build_rsync_args "$rsync_source/" "$target:$www_path/" "${excludes[@]}"
        echo "Command: ${DEPLOY_RSYNC_CMD[*]}"

        if [[ $dry_run -eq 1 ]]; then
            echo "[DRY RUN] Would execute rsync"
        else
            if ! "${DEPLOY_RSYNC_CMD[@]}"; then
                echo "WARNING: Rsync failed (continuing)"
            fi
        fi
    else
        echo "(rsync disabled)"
    fi
    echo ""

    # Step 6: File permissions
    echo "[6/$total_steps] File permissions"
    echo "----------------------"
    echo "Owner: ${DEPLOY_WWW_USER}:${DEPLOY_WWW_GROUP}"
    echo "Perms: $DEPLOY_WWW_PERMS"
    echo "Path:  $www_path"

    if [[ $dry_run -eq 1 ]]; then
        echo "[DRY RUN] Would set permissions"
    else
        if ! _deploy_set_permissions "$target" "$www_path"; then
            echo "WARNING: Permission setting failed (continuing)"
        fi
    fi
    echo ""

    # Step 7: Service deployment (for type=service)
    if [[ "${PROJ_TYPE:-static}" == "service" ]]; then
        echo "[7/$total_steps] Service deployment"
        echo "-----------------------"
        local services_dir="$PROJ_PATH_LOCAL/services"

        if [[ -d "$services_dir" ]]; then
            local service_count=0
            for tsm_file in "$services_dir"/*.tsm; do
                [[ -f "$tsm_file" ]] || continue
                ((service_count++))
            done

            if [[ $service_count -eq 0 ]]; then
                echo "(no services/*.tsm files found)"
            else
                echo "Services: $service_count"
                echo ""

                for tsm_file in "$services_dir"/*.tsm; do
                    [[ -f "$tsm_file" ]] || continue
                    local svc_name=$(basename "$tsm_file" .tsm)

                    # Load service manifest
                    project_service_load "$project" "$svc_name" 2>/dev/null || {
                        echo "  $svc_name: failed to load manifest"
                        continue
                    }

                    echo "  Service: $svc_name"
                    echo "    Command: ${TSM_COMMAND:-?}"
                    echo "    Port: ${TSM_PORT:-none}"
                    echo "    Proxy: ${TSM_PROXY:-none}"

                    if [[ $dry_run -eq 1 ]]; then
                        echo "    [DRY RUN] Would: tsm stop $svc_name; tsm start $svc_name --env $env"
                    else
                        # Stop existing service (ignore errors)
                        echo "    Stopping..."
                        _deploy_remote_exec "$target" "cd $www_path && tsm stop $svc_name 2>/dev/null || true"

                        # Start service
                        echo "    Starting..."
                        if ! _deploy_remote_exec "$target" "cd $www_path && tsm start $svc_name --env $env"; then
                            echo "    WARNING: Failed to start $svc_name"
                        fi
                    fi

                    # Generate proxy nginx config if needed
                    if [[ "${TSM_PROXY:-none}" != "none" && -n "${TSM_PORT:-}" ]]; then
                        echo "    Generating nginx proxy config..."
                        if [[ $dry_run -eq 1 ]]; then
                            echo "    [DRY RUN] Would generate proxy config"
                        else
                            _deploy_generate_proxy_config "$project" "$svc_name" "$env" "$domain" "$TSM_PORT" "${TSM_PROXY:-subdomain}"
                        fi
                    fi
                    echo ""
                done
            fi
        else
            echo "(no services/ directory)"
        fi
        echo ""
    fi

    # Step 7/8: Nginx config (static) or Step 8 (service)
    local nginx_step=7
    [[ "${PROJ_TYPE:-static}" == "service" ]] && nginx_step=8

    echo "[$nginx_step/$total_steps] Nginx configuration"
    echo "-------------------------"

    if [[ $dry_run -eq 1 ]]; then
        echo "[DRY RUN] Would generate nginx config"
        deploy_nginx_generate --dry-run "$project" "$env" 2>&1 | sed 's/^/  /'
    else
        echo "Generating nginx config..."
        if ! deploy_nginx_generate "$project" "$env"; then
            echo "WARNING: Nginx generation failed"
        else
            echo "Installing nginx config..."
            if ! deploy_nginx_install "$project" "$env"; then
                echo "WARNING: Nginx installation failed"
            fi
        fi
    fi
    echo ""

    # Summary
    echo "============================================"
    if [[ $dry_run -eq 1 ]]; then
        echo "[DRY RUN] Would deploy: $project -> $env"
        echo "URL: https://$domain"
    else
        echo "Deploy COMPLETE: $project -> $env"
        echo "URL: https://$domain"
        _deploy_log "$project" "$env" "push" "success"
    fi
    echo "============================================"
}

# =============================================================================
# GIT-ONLY OPERATION
# =============================================================================

deploy_git() {
    local project env dry_run
    _deploy_setup "git" "$@" || return 1

    [[ $dry_run -eq 1 ]] && echo "[DRY RUN]"
    echo "Git operation: $project -> $env"
    echo ""

    local target=$(_deploy_ssh_target "$env") || return 1
    local www_path=$(deploy_toml_get_www "$env")
    local branch=$(deploy_toml_get_branch "$env")

    local git_cmd
    if [[ $dry_run -eq 0 ]] && _deploy_remote_exec "$target" "test -d $www_path/.git" 2>/dev/null; then
        git_cmd="cd $www_path && git fetch origin && git checkout $branch && git pull origin $branch"
    else
        if [[ -z "$PROJ_GIT_REPO" ]]; then
            echo "No git repo URL configured"
            return 1
        fi
        git_cmd="git clone $PROJ_GIT_REPO $www_path && cd $www_path && git checkout $branch"
    fi

    echo "Target: $target"
    echo "Path:   $www_path"
    echo "Branch: $branch"
    echo "Command: ssh $target \"$git_cmd\""
    echo ""

    if [[ $dry_run -eq 1 ]]; then
        echo "[DRY RUN] Would execute git command"
        return 0
    fi

    if _deploy_remote_exec "$target" "$git_cmd"; then
        _deploy_log "$project" "$env" "git" "success"
    else
        _deploy_log "$project" "$env" "git" "failed"
        return 1
    fi
}

# =============================================================================
# RSYNC-ONLY OPERATION
# =============================================================================

deploy_sync() {
    local project env dry_run
    _deploy_setup "sync" "$@" || return 1

    [[ $dry_run -eq 1 ]] && echo "[DRY RUN]"
    echo "Rsync: $project -> $env"
    echo ""

    local target=$(_deploy_ssh_target "$env") || return 1
    local www_path=$(deploy_toml_get_www "$env")
    local rsync_source="${PROJ_PATH_LOCAL}/${PROJ_RSYNC_SOURCE:-.}"

    # Build exclude list
    local -a excludes=()
    for excl in $PROJ_RSYNC_EXCLUDE; do
        excludes+=("$excl")
    done

    echo "Source: $rsync_source"
    echo "Dest:   $target:$www_path/"
    echo "Excludes: ${PROJ_RSYNC_EXCLUDE:-none}"
    echo ""

    _deploy_build_rsync_args "$rsync_source/" "$target:$www_path/" "${excludes[@]}"
    echo "Command: ${DEPLOY_RSYNC_CMD[*]}"
    echo ""

    if [[ $dry_run -eq 1 ]]; then
        echo "[DRY RUN] Would execute rsync"
        return 0
    fi

    if "${DEPLOY_RSYNC_CMD[@]}"; then
        _deploy_log "$project" "$env" "sync" "success"
    else
        _deploy_log "$project" "$env" "sync" "failed"
        return 1
    fi
}

# =============================================================================
# PERMISSIONS-ONLY OPERATION
# =============================================================================

deploy_perms() {
    local project env dry_run
    _deploy_setup "perms" "$@" || return 1

    [[ $dry_run -eq 1 ]] && echo "[DRY RUN]"
    echo "Setting permissions: $project -> $env"
    echo ""

    local target=$(_deploy_ssh_target "$env") || return 1
    local www_path=$(deploy_toml_get_www "$env")

    echo "Target: $target"
    echo "Path:   $www_path"
    echo "Owner:  ${DEPLOY_WWW_USER}:${DEPLOY_WWW_GROUP}"
    echo "Perms:  $DEPLOY_WWW_PERMS"
    echo ""

    if [[ $dry_run -eq 1 ]]; then
        echo "[DRY RUN] Would set permissions"
        return 0
    fi

    if _deploy_set_permissions "$target" "$www_path"; then
        _deploy_log "$project" "$env" "perms" "success"
    else
        _deploy_log "$project" "$env" "perms" "failed"
        return 1
    fi
}

# =============================================================================
# EXPORTS
# =============================================================================

export -f deploy_tsm deploy_nginx deploy_exec
export -f deploy_push deploy_git deploy_sync deploy_perms
