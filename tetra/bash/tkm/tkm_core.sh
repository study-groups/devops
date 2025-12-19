#!/usr/bin/env bash
# tkm_core.sh - Core paths and helper functions
#
# Foundational functions used by all tkm modules:
# - Path resolution (org, keys directory, key paths)
# - Org helper wrappers
# - Init function

# =============================================================================
# PATHS
# =============================================================================

# Org name for directory
tkm_org_name() {
    local org=$(org_active 2>/dev/null)
    [[ "$org" == "none" || -z "$org" ]] && return 1
    echo "$org"
}

# Keys directory: ~/.ssh/<org>/
tkm_keys_dir() {
    local org=$(tkm_org_name) || return 1
    echo "$HOME/.ssh/$org"
}

# Key path: ~/.ssh/<org>/<env>_<user>
tkm_key_path() {
    local env="$1"
    local user="$2"
    local dir=$(tkm_keys_dir) || return 1
    echo "$dir/${env}_${user}"
}

# App user name for environment (from tetra.toml ssh_work_user, fallback to env name)
tkm_app_user() {
    local env="$1"
    local work_user=$(_tkm_get_work_user "$env")
    [[ -n "$work_user" ]] && echo "$work_user" || echo "$env"
}

# Expected keys for an environment
tkm_expected_keys() {
    local env="$1"
    local app_user=$(tkm_app_user "$env")
    echo "${env}_root"
    echo "${env}_${app_user}"
}

# =============================================================================
# HELPERS (wrappers to org module functions)
# =============================================================================

_tkm_get_host() { _org_get_host "$1"; }
_tkm_get_auth_user() { _org_get_user "$1"; }
_tkm_get_work_user() { _org_get_work_user "$1"; }

# =============================================================================
# INIT
# =============================================================================

tkm_init() {
    local org=$(tkm_org_name) || { echo "No active org"; return 1; }
    local keys_dir="$HOME/.ssh/$org"

    mkdir -p "$keys_dir"
    chmod 700 "$keys_dir"

    echo "Initialized: $keys_dir"
    echo ""
    echo "Next: tkm gen all"
}

# =============================================================================
# EXPORTS
# =============================================================================

export -f tkm_org_name tkm_keys_dir tkm_key_path tkm_app_user tkm_expected_keys
export -f _tkm_get_host _tkm_get_auth_user _tkm_get_work_user
export -f tkm_init
