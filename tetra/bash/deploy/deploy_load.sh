#!/usr/bin/env bash
# deploy_load.sh - Context loading, template substitution, command execution
#
# Functions: _deploy_clear, _deploy_load, _deploy_load_standalone,
#            _deploy_load_org, _deploy_template, _deploy_exec

# =============================================================================
# INTERNAL STATE
# =============================================================================

# Cleared by _deploy_clear, set by _deploy_load
DEPLOY_TOML=""
DEPLOY_TOML_DIR=""
DEPLOY_ENV=""
DEPLOY_MODE=""          # "standalone" or "org"

# From target TOML
DEPLOY_NAME=""
DEPLOY_REMOTE=""
DEPLOY_DOMAIN=""

# SSH info (from TOML in standalone, from org in org-mode)
DEPLOY_SSH=""           # user@host shortcut
DEPLOY_HOST=""
DEPLOY_AUTH_USER=""
DEPLOY_WORK_USER=""

# Command arrays
declare -ga DEPLOY_PRE=()
declare -ga DEPLOY_COMMANDS=()
declare -ga DEPLOY_POST=()

# =============================================================================
# CONTEXT LOADING
# =============================================================================

_deploy_clear() {
    DEPLOY_TOML=""
    DEPLOY_TOML_DIR=""
    DEPLOY_ENV=""
    DEPLOY_MODE=""
    DEPLOY_NAME=""
    DEPLOY_REMOTE=""
    DEPLOY_DOMAIN=""
    DEPLOY_SSH=""
    DEPLOY_HOST=""
    DEPLOY_AUTH_USER=""
    DEPLOY_WORK_USER=""
    DEPLOY_PRE=()
    DEPLOY_COMMANDS=()
    DEPLOY_POST=()
}

# Load deploy context from TOML
# Auto-detects standalone vs org mode
# Usage: _deploy_load <toml_file> <env>
_deploy_load() {
    local toml="$1"
    local env="$2"

    _deploy_clear

    [[ ! -f "$toml" ]] && { echo "Not found: $toml" >&2; return 1; }

    DEPLOY_TOML="$toml"
    DEPLOY_TOML_DIR=$(dirname "$toml")
    DEPLOY_ENV="$env"

    # From target TOML [target] section
    DEPLOY_NAME=$(_deploy_toml_get "$toml" "target" "name")
    DEPLOY_REMOTE=$(_deploy_toml_get "$toml" "target" "remote")
    [[ -z "$DEPLOY_REMOTE" ]] && DEPLOY_REMOTE=$(_deploy_toml_get "$toml" "target" "cwd")
    DEPLOY_DOMAIN=$(_deploy_toml_get "$toml" "target" "domain")

    # Detect mode: does TOML have ssh in envs section?
    if _deploy_toml_has_ssh "$toml" "$env"; then
        DEPLOY_MODE="standalone"
        _deploy_load_standalone "$toml" "$env"
    else
        DEPLOY_MODE="org"
        _deploy_load_org "$toml" "$env"
    fi

    local rc=$?
    [[ $rc -ne 0 ]] && return $rc

    # Load command arrays
    mapfile -t DEPLOY_PRE < <(_deploy_toml_get_array "$toml" "deploy" "pre")
    mapfile -t DEPLOY_COMMANDS < <(_deploy_toml_get_array "$toml" "deploy" "commands")
    mapfile -t DEPLOY_POST < <(_deploy_toml_get_array "$toml" "deploy" "post")

    return 0
}

# Load SSH info from target TOML (standalone mode)
_deploy_load_standalone() {
    local toml="$1"
    local env="$2"

    # Try envs.<env> first, fall back to envs.all, then env.<env>, env.all
    local ssh=$(_deploy_toml_get "$toml" "envs.$env" "ssh")
    [[ -z "$ssh" ]] && ssh=$(_deploy_toml_get "$toml" "envs.all" "ssh")
    [[ -z "$ssh" ]] && ssh=$(_deploy_toml_get "$toml" "env.$env" "ssh")
    [[ -z "$ssh" ]] && ssh=$(_deploy_toml_get "$toml" "env.all" "ssh")

    if [[ -z "$ssh" ]]; then
        echo "No ssh config for env: $env" >&2
        return 1
    fi

    DEPLOY_SSH="$ssh"
    DEPLOY_AUTH_USER="${ssh%@*}"
    DEPLOY_HOST="${ssh#*@}"

    # Work user (optional, defaults to auth user)
    local user=$(_deploy_toml_get "$toml" "envs.$env" "user")
    [[ -z "$user" ]] && user=$(_deploy_toml_get "$toml" "envs.all" "user")
    [[ -z "$user" ]] && user=$(_deploy_toml_get "$toml" "env.$env" "user")
    [[ -z "$user" ]] && user=$(_deploy_toml_get "$toml" "env.all" "user")
    DEPLOY_WORK_USER="${user:-$DEPLOY_AUTH_USER}"

    # Domain override from env
    local domain=$(_deploy_toml_get "$toml" "envs.$env" "domain")
    [[ -z "$domain" ]] && domain=$(_deploy_toml_get "$toml" "env.$env" "domain")
    [[ -n "$domain" ]] && DEPLOY_DOMAIN="$domain"

    return 0
}

# Load SSH info from org module
_deploy_load_org() {
    local toml="$1"
    local env="$2"

    # Check org module
    if ! type org_active &>/dev/null; then
        echo "org module not loaded (and no ssh in target TOML)" >&2
        return 1
    fi

    if [[ "$(org_active)" == "none" ]]; then
        echo "No active org. Run: org switch <name>" >&2
        return 1
    fi

    DEPLOY_HOST=$(_org_get_host "$env")
    DEPLOY_AUTH_USER=$(_org_get_user "$env")
    DEPLOY_WORK_USER=$(_org_get_work_user "$env")

    if [[ -z "$DEPLOY_HOST" ]]; then
        echo "No host for env '$env' in org $(org_active)" >&2
        return 1
    fi

    DEPLOY_SSH="${DEPLOY_AUTH_USER}@${DEPLOY_HOST}"

    return 0
}

# =============================================================================
# TEMPLATE SUBSTITUTION
# =============================================================================

_deploy_template() {
    local str="$1"

    # Build vars array from DEPLOY_* globals
    local -A _tmpl_vars=(
        [ssh]="$DEPLOY_SSH"
        [host]="$DEPLOY_HOST"
        [auth_user]="$DEPLOY_AUTH_USER"
        [work_user]="$DEPLOY_WORK_USER"
        [user]="$DEPLOY_WORK_USER"
        [name]="$DEPLOY_NAME"
        [cwd]="$DEPLOY_REMOTE"
        [domain]="$DEPLOY_DOMAIN"
        [env]="$DEPLOY_ENV"
        [local]="$DEPLOY_TOML_DIR"
    )

    _deploy_template_core "$str" _tmpl_vars
}

# =============================================================================
# COMMAND EXECUTION
# =============================================================================

_deploy_exec() {
    local cmd="$1"
    local dry_run="${2:-0}"

    cmd=$(_deploy_template "$cmd")

    echo "  \$ $cmd"

    if [[ "$dry_run" -eq 1 ]]; then
        return 0
    fi

    eval "$cmd"
}

# =============================================================================
# EXPORTS
# =============================================================================

export -f _deploy_clear _deploy_load _deploy_load_standalone _deploy_load_org
export -f _deploy_template _deploy_exec
