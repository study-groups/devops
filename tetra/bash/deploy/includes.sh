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

# Source TPS (Tetra Prompt System) for [org:target:env] display
tetra_source_if_exists "${TETRA_SRC}/bash/tps/includes.sh"

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

# Core template substitution using nameref (bash 5.2+)
# Usage: _deploy_template_core <string> <assoc_array_name>
# Array keys: ssh, host, auth_user, work_user, user, name, remote, cwd,
#             domain, env, local, source, files, timestamp
_deploy_template_core() {
    local str="$1"
    local -n _vars="$2"

    # Expand {{user}} in cwd/remote first (common pattern)
    local cwd="${_vars[cwd]:-}"
    cwd="${cwd//\{\{user\}\}/${_vars[user]:-}}"

    # Core substitutions
    str="${str//\{\{ssh\}\}/${_vars[ssh]:-}}"
    str="${str//\{\{host\}\}/${_vars[host]:-}}"
    str="${str//\{\{auth_user\}\}/${_vars[auth_user]:-}}"
    str="${str//\{\{work_user\}\}/${_vars[work_user]:-}}"
    str="${str//\{\{user\}\}/${_vars[user]:-}}"
    str="${str//\{\{name\}\}/${_vars[name]:-}}"
    str="${str//\{\{remote\}\}/$cwd}"
    str="${str//\{\{cwd\}\}/$cwd}"
    str="${str//\{\{domain\}\}/${_vars[domain]:-}}"
    str="${str//\{\{env\}\}/${_vars[env]:-}}"
    str="${str//\{\{local\}\}/${_vars[local]:-}}"
    str="${str//\{\{source\}\}/${_vars[source]:-}}"
    str="${str//\{\{files\}\}/${_vars[files]:-}}"

    # Dynamic values
    [[ "$str" == *"{{timestamp}}"* ]] && str="${str//\{\{timestamp\}\}/$(date -Iseconds)}"

    echo "$str"
}

# =============================================================================
# TOML PARSING UTILITIES
# =============================================================================

# Get single value from TOML file
# Usage: _deploy_toml_get <file> <section> <key>
_deploy_toml_get() {
    local file="$1" section="$2" key="$3"

    awk -v sect="$section" -v k="$key" '
        /^\[/ { in_sect = ($0 == "[" sect "]") }
        in_sect && $1 == k && $2 == "=" {
            val = $0
            sub(/^[^=]*=[ \t]*/, "", val)
            gsub(/^["'\''"]|["'\''"]$/, "", val)
            print val
            exit
        }
    ' "$file"
}

# Get array from TOML (single line [...] format)
# Usage: _deploy_toml_get_array <file> <section> <key>
_deploy_toml_get_array() {
    local file="$1" section="$2" key="$3"

    local raw=$(_deploy_toml_get "$file" "$section" "$key")
    [[ -z "$raw" ]] && return

    # Strip brackets and parse quoted strings
    raw="${raw#\[}"
    raw="${raw%\]}"

    while [[ "$raw" =~ \"([^\"]+)\" ]]; do
        echo "${BASH_REMATCH[1]}"
        raw="${raw#*\"${BASH_REMATCH[1]}\"}"
    done
}

# Check if TOML has ssh key in envs section (standalone mode indicator)
# Usage: _deploy_toml_has_ssh <file> <env>
_deploy_toml_has_ssh() {
    local file="$1" env="$2"
    local ssh=$(_deploy_toml_get "$file" "envs.$env" "ssh")
    [[ -z "$ssh" ]] && ssh=$(_deploy_toml_get "$file" "envs.all" "ssh")
    [[ -z "$ssh" ]] && ssh=$(_deploy_toml_get "$file" "env.$env" "ssh")
    [[ -z "$ssh" ]] && ssh=$(_deploy_toml_get "$file" "env.all" "ssh")
    [[ -n "$ssh" ]]
}

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
# Usage: _deploy_log <target> <env> <action> <status> [duration_secs] [extra...]
_deploy_log() {
    local target="$1"
    local env="$2"
    local action="$3"
    local status="$4"
    local duration="${5:-0}"
    shift 5 2>/dev/null || shift 4
    local extra="$*"

    local log_dir="$DEPLOY_DIR/logs"
    local log_file="$log_dir/deploy.log"

    # Gather context
    local user="${USER:-unknown}"
    local branch=""
    local commit=""
    if [[ -d .git ]]; then
        branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
        commit=$(git rev-parse --short HEAD 2>/dev/null)
    fi

    mkdir -p "$log_dir"
    # Format: timestamp|target|env|action|status|duration|user|branch|commit|extra
    printf "%s|%s|%s|%s|%s|%s|%s|%s|%s|%s\n" \
        "$(date -Iseconds)" "$target" "$env" "$action" "$status" \
        "$duration" "$user" "$branch" "$commit" "$extra" >> "$log_file"
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
    local config_dir="$DEPLOY_DIR/nginx"
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
    local template_file="$DEPLOY_SRC/templates/nginx/proxy-${proxy_type}.conf.tmpl"
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

export -f _deploy_template_core
export -f _deploy_toml_get _deploy_toml_get_array _deploy_toml_has_ssh
export -f _deploy_parse_opts _deploy_validate_args _deploy_setup
export -f _deploy_ssh_target _deploy_remote_exec _deploy_log
export -f _deploy_build_rsync_args _deploy_set_permissions
export -f _deploy_generate_proxy_config

# =============================================================================
# SOURCE DEPLOY MODULES
# =============================================================================
# Use DEPLOY_SRC (stable) instead of MOD_SRC (overwritten by TPS)

# Context management (must come first - sets up state)
source "$DEPLOY_SRC/deploy_ctx.sh"

# Address parsing and validation (shared by dispatcher and completion)
source "$DEPLOY_SRC/deploy_addr.sh"

# Transport layer (var/array/func serialization across SSH)
source "$DEPLOY_SRC/deploy_transport.sh"

# Core implementation (deploy_target_push, deploy_target_load, etc)
source "$DEPLOY_SRC/deploy_remote.sh"

# Optional modules (use tetra_source_if_exists for missing files)
# NOTE: deploy_target.sh is LEGACY - do not source (conflicts with deploy_remote.sh)
tetra_source_if_exists "$DEPLOY_SRC/deploy_domain.sh"
tetra_source_if_exists "$DEPLOY_SRC/deploy_env.sh"

# File-centric deploy engine
source "$DEPLOY_SRC/deploy_engine.sh"

# Main dispatcher (must come after implementations)
source "$DEPLOY_SRC/deploy.sh"

# Tab completion
tetra_source_if_exists "$DEPLOY_SRC/deploy_complete.sh"

complete -F _deploy_complete deploy 2>/dev/null || true
