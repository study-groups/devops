#!/usr/bin/env bash
# deploy/includes.sh - Module loader for deploy
# Follows tetra module pattern from MODULE_SYSTEM_SPECIFICATION.md

# =============================================================================
# MODULE INITIALIZATION
# =============================================================================

source "$TETRA_SRC/bash/utils/module_init.sh"
source "$TETRA_SRC/bash/utils/function_helpers.sh"
source "$TETRA_SRC/bash/utils/toml_parser.sh"

tetra_module_init_with_alias "deploy" "DEPLOY" "nginx:logs:history"

# Source org dependency
tetra_source_if_exists "${TETRA_SRC}/bash/org/org.sh"

# =============================================================================
# PROMPT INTEGRATION
# =============================================================================

# Enable org display in prompt when deploy is loaded
_deploy_setup_prompt() {
    local org=$(org_active 2>/dev/null)
    [[ -z "$org" || "$org" == "none" ]] && return

    # Use the tetra prompt system if available
    export TETRA_PROMPT_ORG=1
}

# Set up prompt now
_deploy_setup_prompt

# =============================================================================
# CONFIGURATION DEFAULTS
# Centralized hardcoded values - override via environment if needed
# =============================================================================

DEPLOY_WWW_USER="${DEPLOY_WWW_USER:-www-data}"
DEPLOY_WWW_GROUP="${DEPLOY_WWW_GROUP:-www-data}"
DEPLOY_WWW_PERMS="${DEPLOY_WWW_PERMS:-755}"
DEPLOY_NGINX_SITES_AVAILABLE="${DEPLOY_NGINX_SITES_AVAILABLE:-/etc/nginx/sites-available}"
DEPLOY_NGINX_SITES_ENABLED="${DEPLOY_NGINX_SITES_ENABLED:-/etc/nginx/sites-enabled}"
DEPLOY_SSH_TIMEOUT="${DEPLOY_SSH_TIMEOUT:-10}"
DEPLOY_SSH_OPTIONS="${DEPLOY_SSH_OPTIONS:--o BatchMode=yes -o ConnectTimeout=$DEPLOY_SSH_TIMEOUT}"

# =============================================================================
# SHARED HELPER FUNCTIONS
# =============================================================================

# Parse deploy flags from args, return remaining args via DEPLOY_ARGS array
# Sets: DEPLOY_DRY_RUN=1, DEPLOY_WITH_ENV=1, DEPLOY_FORCE=1, DEPLOY_CMD=""
_deploy_parse_opts() {
    DEPLOY_DRY_RUN=0
    DEPLOY_WITH_ENV=0
    DEPLOY_FORCE=0
    DEPLOY_CMD=""
    DEPLOY_ARGS=()

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --dry-run|-n)
                DEPLOY_DRY_RUN=1
                shift
                ;;
            --with-env)
                DEPLOY_WITH_ENV=1
                shift
                ;;
            --force|-f)
                DEPLOY_FORCE=1
                shift
                ;;
            --cmd|-c)
                DEPLOY_CMD="$2"
                shift 2
                ;;
            *)
                DEPLOY_ARGS+=("$1")
                shift
                ;;
        esac
    done
}

# Validate project and env arguments are present
# Usage: _deploy_validate_args "command_name" || return 1
_deploy_validate_args() {
    local cmd="$1"
    local project="${DEPLOY_ARGS[0]:-}"
    local env="${DEPLOY_ARGS[1]:-}"

    if [[ -z "$project" || -z "$env" ]]; then
        echo "Usage: deploy $cmd [--dry-run] <project> <env>"
        return 1
    fi
    return 0
}

# Combined setup: parse opts, validate args, load target
# Usage: _deploy_setup "command_name" "$@" || return 1
# After call: target, env, dry_run, with_env, force variables are set
_deploy_setup() {
    local cmd="$1"
    shift

    _deploy_parse_opts "$@"
    _deploy_validate_args "$cmd" || return 1

    target="${DEPLOY_ARGS[0]}"
    env="${DEPLOY_ARGS[1]}"
    dry_run=$DEPLOY_DRY_RUN
    with_env=$DEPLOY_WITH_ENV
    force=$DEPLOY_FORCE

    return 0
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
    [[ -z "$user" ]] && user="$env"

    echo "${user}@${host}"
}

# Run command on remote server with consistent SSH options
_deploy_remote_exec() {
    local target="$1"
    shift
    local cmd="$*"

    ssh $DEPLOY_SSH_OPTIONS "$target" "$cmd"
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

# Build rsync command as array (avoids eval)
# Usage: _deploy_build_rsync_args <source> <dest> [excludes...]
# Returns via DEPLOY_RSYNC_CMD array
_deploy_build_rsync_args() {
    local source="$1"
    local dest="$2"
    shift 2

    DEPLOY_RSYNC_CMD=(rsync -avz --delete)

    for excl in "$@"; do
        excl="${excl//\"/}"
        DEPLOY_RSYNC_CMD+=(--exclude="$excl")
    done

    DEPLOY_RSYNC_CMD+=("$source" "$dest")
}

# Set file permissions on remote
_deploy_set_permissions() {
    local target="$1"
    local path="$2"

    local cmd="sudo chown -R ${DEPLOY_WWW_USER}:${DEPLOY_WWW_GROUP} $path && sudo chmod -R $DEPLOY_WWW_PERMS $path"
    _deploy_remote_exec "$target" "$cmd"
}

# =============================================================================
# PROXY CONFIG GENERATION
# =============================================================================

# Generate nginx proxy config for a service
# Usage: _deploy_generate_proxy_config <project> <service> <env> <domain> <port> <proxy_type>
_deploy_generate_proxy_config() {
    local project="$1"
    local service="$2"
    local env="$3"
    local base_domain="$4"
    local port="$5"
    local proxy_type="${6:-subdomain}"

    local config_name="${project}-${service}-${env}.conf"
    local config_dir="$MOD_DIR/nginx"
    mkdir -p "$config_dir"
    local config_file="$config_dir/$config_name"

    # Resolve service domain (subdomain pattern)
    local service_domain
    if [[ "$proxy_type" == "subdomain" ]]; then
        # service.project.env.domain.com or service.env.domain.com
        service_domain="${service}.${base_domain}"
    else
        service_domain="$base_domain"
    fi

    # Get SSL cert paths
    local ssl_cert=$(deploy_domain_get_ssl_cert "$service_domain")
    local ssl_key=$(deploy_domain_get_ssl_key "$service_domain")

    # Select template
    local template_file="$MOD_SRC/templates/nginx/proxy-${proxy_type}.conf.tmpl"
    if [[ ! -f "$template_file" ]]; then
        echo "Template not found: $template_file" >&2
        return 1
    fi

    # Generate config
    sed -e "s|{{PROJECT}}|$project|g" \
        -e "s|{{SERVICE}}|$service|g" \
        -e "s|{{ENV}}|$env|g" \
        -e "s|{{DOMAIN}}|$service_domain|g" \
        -e "s|{{PORT}}|$port|g" \
        -e "s|{{SSL_CERT}}|$ssl_cert|g" \
        -e "s|{{SSL_KEY}}|$ssl_key|g" \
        -e "s|{{TIMESTAMP}}|$(date -Iseconds)|g" \
        "$template_file" > "$config_file"

    echo "Generated: $config_file"
    return 0
}

# =============================================================================
# EXPORT HELPERS
# =============================================================================

export DEPLOY_WWW_USER DEPLOY_WWW_GROUP DEPLOY_WWW_PERMS
export DEPLOY_NGINX_SITES_AVAILABLE DEPLOY_NGINX_SITES_ENABLED
export DEPLOY_SSH_TIMEOUT DEPLOY_SSH_OPTIONS

export -f _deploy_parse_opts _deploy_validate_args _deploy_setup
export -f _deploy_ssh_target _deploy_remote_exec _deploy_log
export -f _deploy_build_rsync_args _deploy_set_permissions
export -f _deploy_generate_proxy_config

# =============================================================================
# SOURCE DEPLOY MODULES
# =============================================================================

# Core implementation (deploy_target_push, deploy_target_load, etc)
source "$MOD_SRC/deploy_remote.sh"

# Optional modules (use tetra_source_if_exists for missing files)
tetra_source_if_exists "$MOD_SRC/deploy_target.sh"
tetra_source_if_exists "$MOD_SRC/deploy_repo.sh"
tetra_source_if_exists "$MOD_SRC/deploy_env.sh"
tetra_source_if_exists "$MOD_SRC/deploy_preflight.sh"
tetra_source_if_exists "$MOD_SRC/deploy_domain.sh"
tetra_source_if_exists "$MOD_SRC/deploy_nginx.sh"
tetra_source_if_exists "$MOD_SRC/deploy_toml.sh"

# Main dispatcher (must come after implementations)
source "$MOD_SRC/deploy.sh"

# Tab completion
tetra_source_if_exists "$MOD_SRC/deploy_complete.sh"

complete -F _deploy_complete deploy 2>/dev/null || true
