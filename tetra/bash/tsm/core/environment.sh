#!/usr/bin/env bash

# TSM Environment - Environment file loading and variable management
# This module handles environment file sourcing and variable extraction

# === ENVIRONMENT LOADING ===

_tsm_load_environment() {
    local env_file="$1"
    local cwd="$2"

    if [[ -n "$env_file" && -f "$cwd/$env_file" ]]; then
        # Export variables from env file
        set -a  # Mark all variables for export
        source "$cwd/$env_file"
        set +a  # Turn off auto-export
        return 0
    else
        return 1
    fi
}

# Extract PORT and NAME from environment files
_tsm_extract_env_vars() {
    local env_file="$1"
    local var_name="$2"

    if [[ -f "$env_file" ]]; then
        # Source in subshell to avoid affecting current environment
        (source "$env_file" 2>/dev/null && echo "${!var_name}")
    fi
}

# Get PORT from environment file
_tsm_get_env_port() {
    local env_file="$1"
    _tsm_extract_env_vars "$env_file" "PORT" || _tsm_extract_env_vars "$env_file" "TETRA_PORT"
}

# Get NAME from environment file
_tsm_get_env_name() {
    local env_file="$1"
    _tsm_extract_env_vars "$env_file" "NAME" || _tsm_extract_env_vars "$env_file" "TETRA_NAME"
}

# Export environment functions
export -f _tsm_load_environment
export -f _tsm_extract_env_vars
export -f _tsm_get_env_port
export -f _tsm_get_env_name