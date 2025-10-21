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

# Parse env file once and extract PORT and NAME together
# Returns: "PORT=value NAME=value" on stdout
# Usage: eval $(tsm_parse_env_file "$env_file")
tsm_parse_env_file() {
    local env_file="$1"

    if [[ ! -f "$env_file" ]]; then
        return 1
    fi

    # Source in subshell and extract both vars at once
    (
        source "$env_file" 2>/dev/null
        echo "ENV_PORT=${PORT:-${TETRA_PORT:-}}"
        echo "ENV_NAME=${NAME:-${TETRA_NAME:-}}"
    )
}

# Extract single variable from environment file
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
export -f tsm_parse_env_file
export -f _tsm_load_environment
export -f _tsm_extract_env_vars
export -f _tsm_get_env_port
export -f _tsm_get_env_name