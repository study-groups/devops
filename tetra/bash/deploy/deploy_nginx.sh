#!/usr/bin/env bash
# deploy_nginx.sh - Nginx configuration management for deploy module
#
# Generates nginx configs from templates and manages remote installation.
# All commands support --dry-run to preview without executing.
#
# Uses centralized config from includes.sh:
#   DEPLOY_NGINX_SITES_AVAILABLE, DEPLOY_NGINX_SITES_ENABLED

DEPLOY_SRC="${TETRA_SRC}/bash/deploy"

# =============================================================================
# PATHS
# =============================================================================

_deploy_nginx_templates_dir() {
    echo "$DEPLOY_SRC/templates"
}

_deploy_nginx_output_dir() {
    local dir="$MOD_DIR/nginx"
    mkdir -p "$dir"
    echo "$dir"
}

_deploy_nginx_output_file() {
    local project="$1"
    local env="$2"
    echo "$(_deploy_nginx_output_dir)/${project}-${env}.conf"
}

# =============================================================================
# TEMPLATE PROCESSING
# =============================================================================

deploy_nginx_generate() {
    local project env dry_run
    _deploy_setup "nginx:gen" "$@" || return 1

    [[ $dry_run -eq 1 ]] && echo "[DRY RUN]"
    echo "Generating nginx config: $project -> $env"
    echo ""

    if ! deploy_toml_can_deploy "$env"; then
        echo "Project '$project' cannot deploy to '$env'"
        echo "Allowed envs: ${PROJ_ENVS:-all}"
        return 1
    fi

    # Resolve domain and paths
    local domain=$(deploy_domain_resolve "$env") || return 1
    local www_path=$(deploy_toml_get_www "$env")
    local ssl_cert=$(deploy_domain_get_ssl_cert "$domain")
    local ssl_key=$(deploy_domain_get_ssl_key "$domain")

    echo "Domain:   $domain"
    echo "WWW Path: $www_path"
    echo "SSL Cert: $ssl_cert"
    echo ""

    # Select template based on pattern
    local pattern="${PROJ_DOMAIN_PATTERN:-subdomain}"
    local template_file
    case "$pattern" in
        subdomain)
            template_file="$(_deploy_nginx_templates_dir)/static-subdomain.conf.tmpl"
            ;;
        path)
            template_file="$(_deploy_nginx_templates_dir)/static-path.conf.tmpl"
            ;;
        *)
            echo "Unknown pattern: $pattern"
            return 1
            ;;
    esac

    if [[ ! -f "$template_file" ]]; then
        echo "Template not found: $template_file"
        return 1
    fi

    echo "Template: $(basename "$template_file")"

    # Generate config with variable substitution (single sed, multiple expressions)
    local timestamp=$(date -Iseconds)
    local config
    config=$(sed -e "s|{{PROJECT}}|$project|g" \
                 -e "s|{{ENV}}|$env|g" \
                 -e "s|{{DOMAIN}}|$domain|g" \
                 -e "s|{{WWW_PATH}}|$www_path|g" \
                 -e "s|{{SSL_CERT}}|$ssl_cert|g" \
                 -e "s|{{SSL_KEY}}|$ssl_key|g" \
                 -e "s|{{TIMESTAMP}}|$timestamp|g" \
                 "$template_file")

    local output_file=$(_deploy_nginx_output_file "$project" "$env")

    if [[ $dry_run -eq 1 ]]; then
        echo ""
        echo "[DRY RUN] Would write to: $output_file"
        echo ""
        echo "--- Generated config ---"
        echo "$config"
        echo "--- End config ---"
        return 0
    fi

    echo "$config" > "$output_file"
    echo ""
    echo "Generated: $output_file"
    _deploy_log "$project" "$env" "nginx:gen" "success"
}

deploy_nginx_show() {
    local project="$1"
    local env="$2"

    if [[ -z "$project" || -z "$env" ]]; then
        echo "Usage: deploy nginx:show <project> <env>"
        return 1
    fi

    local config_file=$(_deploy_nginx_output_file "$project" "$env")

    if [[ ! -f "$config_file" ]]; then
        echo "Config not found: $config_file"
        echo "Generate with: deploy nginx:gen $project $env"
        return 1
    fi

    echo "File: $config_file"
    echo "---"
    cat "$config_file"
}

deploy_nginx_list() {
    local dir=$(_deploy_nginx_output_dir)

    echo "Generated Nginx Configs"
    echo "======================="
    echo ""

    if [[ -z "$(ls -A "$dir"/*.conf 2>/dev/null)" ]]; then
        echo "(none)"
        echo ""
        echo "Generate with: deploy nginx:gen <project> <env>"
        return 0
    fi

    for conf in "$dir"/*.conf; do
        [[ -f "$conf" ]] || continue
        echo "  $(basename "$conf")"
    done
}

# =============================================================================
# REMOTE OPERATIONS
# =============================================================================

deploy_nginx_install() {
    local project env dry_run
    _deploy_setup "nginx:install" "$@" || return 1

    [[ $dry_run -eq 1 ]] && echo "[DRY RUN]"
    echo "Installing nginx config: $project -> $env"
    echo ""

    local config_file=$(_deploy_nginx_output_file "$project" "$env")
    if [[ ! -f "$config_file" ]]; then
        echo "Config not found: $config_file"
        echo "Generate first: deploy nginx:gen $project $env"
        return 1
    fi

    local target
    target=$(_deploy_ssh_target "$env") || return 1

    local remote_name="${project}-${env}.conf"
    local remote_available="$DEPLOY_NGINX_SITES_AVAILABLE/$remote_name"
    local remote_enabled="$DEPLOY_NGINX_SITES_ENABLED/$remote_name"

    echo "Config: $config_file"
    echo "Target: $target"
    echo "Remote: $remote_available"
    echo ""

    local tmp_path="/tmp/$remote_name"

    echo "Steps:"
    echo "  1. scp $config_file $target:$tmp_path"
    echo "  2. ssh $target 'sudo mv $tmp_path $remote_available'"
    echo "  3. ssh $target 'sudo ln -sf $remote_available $remote_enabled'"
    echo "  4. ssh $target 'sudo nginx -t'"
    echo "  5. ssh $target 'sudo systemctl reload nginx'"
    echo ""

    if [[ $dry_run -eq 1 ]]; then
        echo "[DRY RUN] Would execute above steps"
        return 0
    fi

    echo "Copying config..."
    if ! scp $DEPLOY_SSH_OPTIONS "$config_file" "$target:$tmp_path"; then
        echo "Failed to copy config"
        return 1
    fi

    echo "Installing to sites-available..."
    if ! _deploy_remote_exec "$target" "sudo mv $tmp_path $remote_available"; then
        echo "Failed to install config"
        return 1
    fi

    echo "Enabling site..."
    if ! _deploy_remote_exec "$target" "sudo ln -sf $remote_available $remote_enabled"; then
        echo "Failed to enable site"
        return 1
    fi

    echo "Testing nginx config..."
    if ! _deploy_remote_exec "$target" "sudo nginx -t"; then
        echo ""
        echo "NGINX CONFIG TEST FAILED - Rolling back..."
        _deploy_remote_exec "$target" "sudo rm -f $remote_enabled"
        return 1
    fi

    echo "Reloading nginx..."
    if ! _deploy_remote_exec "$target" "sudo systemctl reload nginx"; then
        echo "Failed to reload nginx"
        return 1
    fi

    echo ""
    echo "Nginx config installed successfully"
    _deploy_log "$project" "$env" "nginx:install" "success"
}

deploy_nginx_uninstall() {
    local project env dry_run
    _deploy_setup "nginx:uninstall" "$@" || return 1

    [[ $dry_run -eq 1 ]] && echo "[DRY RUN]"
    echo "Uninstalling nginx config: $project-$env"
    echo ""

    local target
    target=$(_deploy_ssh_target "$env") || return 1

    local remote_name="${project}-${env}.conf"
    local remote_available="$DEPLOY_NGINX_SITES_AVAILABLE/$remote_name"
    local remote_enabled="$DEPLOY_NGINX_SITES_ENABLED/$remote_name"

    echo "Target: $target"
    echo ""
    echo "Steps:"
    echo "  1. ssh $target 'sudo rm -f $remote_enabled'"
    echo "  2. ssh $target 'sudo nginx -t && sudo systemctl reload nginx'"
    echo ""

    if [[ $dry_run -eq 1 ]]; then
        echo "[DRY RUN] Would execute above steps"
        return 0
    fi

    echo "Disabling site..."
    _deploy_remote_exec "$target" "sudo rm -f $remote_enabled"

    echo "Reloading nginx..."
    _deploy_remote_exec "$target" "sudo nginx -t && sudo systemctl reload nginx"

    echo ""
    echo "Nginx config disabled"
    echo "Note: Config file remains at $remote_available"
    echo "To fully remove: ssh $target 'sudo rm $remote_available'"

    _deploy_log "$project" "$env" "nginx:uninstall" "success"
}

deploy_nginx_status() {
    local project="$1"
    local env="$2"

    if [[ -z "$project" || -z "$env" ]]; then
        echo "Usage: deploy nginx:status <project> <env>"
        return 1
    fi

    local target
    target=$(_deploy_ssh_target "$env") || return 1

    local remote_name="${project}-${env}.conf"
    local remote_available="$DEPLOY_NGINX_SITES_AVAILABLE/$remote_name"
    local remote_enabled="$DEPLOY_NGINX_SITES_ENABLED/$remote_name"

    echo "Nginx status: $project-$env"
    echo "Target: $target"
    echo ""

    echo "Config status:"
    _deploy_remote_exec "$target" "
        if [[ -f $remote_available ]]; then
            echo '  sites-available: present'
        else
            echo '  sites-available: missing'
        fi
        if [[ -L $remote_enabled ]]; then
            echo '  sites-enabled: enabled'
        else
            echo '  sites-enabled: disabled'
        fi
    "

    echo ""
    echo "Nginx status:"
    _deploy_remote_exec "$target" "sudo systemctl is-active nginx && echo '  nginx: running' || echo '  nginx: stopped'"
}

# =============================================================================
# EXPORTS
# =============================================================================

