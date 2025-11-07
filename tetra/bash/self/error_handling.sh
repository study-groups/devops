#!/usr/bin/env bash
# Error Handling Template Library
# Provides standard error handling patterns for tetra bash scripts
#
# Usage:
#   source "$TETRA_SRC/bash/self/error_handling.sh"
#   tetra_error_setup    # Add at top of script after shebang
#
# Or for simple inclusion:
#   set -euo pipefail
#   trap 'tetra_error_handler $? $LINENO' ERR

# Standard error handler
# Called automatically on ERR trap
tetra_error_handler() {
    local exit_code=$1
    local line_number=$2
    local bash_lineno="${BASH_LINENO[1]}"
    local function_name="${FUNCNAME[2]:-main}"
    local command="${BASH_COMMAND}"

    echo "ERROR in ${BASH_SOURCE[1]##*/}:$line_number" >&2
    echo "  Function: $function_name" >&2
    echo "  Command: $command" >&2
    echo "  Exit code: $exit_code" >&2

    # Log to tetra log if available
    if declare -f tetra_log_error &>/dev/null; then
        tetra_log_error "script_error" \
            "file=${BASH_SOURCE[1]##*/}" \
            "line=$line_number" \
            "function=$function_name" \
            "exit_code=$exit_code"
    fi

    return $exit_code
}

# Cleanup handler
# Override this in your script for custom cleanup
tetra_cleanup_handler() {
    local exit_code=$?
    # Default: do nothing
    # Override in calling script for custom cleanup
    return $exit_code
}

# Exit handler
# Calls cleanup and handles final exit
tetra_exit_handler() {
    local exit_code=$?
    tetra_cleanup_handler
    exit $exit_code
}

# Setup standard error handling
# Call this at the top of your script
tetra_error_setup() {
    set -euo pipefail
    trap 'tetra_error_handler $? $LINENO' ERR
    trap 'tetra_exit_handler' EXIT
}

# Validate required environment variables
# Usage: tetra_require_env TETRA_SRC TETRA_DIR
tetra_require_env() {
    local missing=()
    local var_name

    for var_name in "$@"; do
        if [[ -z "${!var_name:-}" ]]; then
            missing+=("$var_name")
        fi
    done

    if [[ ${#missing[@]} -gt 0 ]]; then
        echo "ERROR: Required environment variables not set:" >&2
        printf "  - %s\n" "${missing[@]}" >&2
        return 1
    fi

    return 0
}

# Validate TETRA_SRC is set and valid
tetra_validate_tetra_src() {
    if [[ -z "${TETRA_SRC:-}" ]]; then
        echo "ERROR: TETRA_SRC is not set" >&2
        echo "  Set it with: export TETRA_SRC=/path/to/tetra" >&2
        return 1
    fi

    if [[ ! -d "$TETRA_SRC" ]]; then
        echo "ERROR: TETRA_SRC directory does not exist: $TETRA_SRC" >&2
        return 1
    fi

    if [[ ! -d "$TETRA_SRC/bash" ]]; then
        echo "ERROR: TETRA_SRC does not appear to be a valid tetra directory" >&2
        echo "  Missing bash/ subdirectory in: $TETRA_SRC" >&2
        return 1
    fi

    return 0
}

# Validate command exists
# Usage: tetra_require_command git jq curl
tetra_require_command() {
    local missing=()
    local cmd

    for cmd in "$@"; do
        if ! command -v "$cmd" &>/dev/null; then
            missing+=("$cmd")
        fi
    done

    if [[ ${#missing[@]} -gt 0 ]]; then
        echo "ERROR: Required commands not found:" >&2
        printf "  - %s\n" "${missing[@]}" >&2
        return 1
    fi

    return 0
}

# Safely source a file with error checking
# Usage: tetra_source_safe "$TETRA_SRC/bash/utils/common.sh"
tetra_source_safe() {
    local file="$1"

    if [[ ! -f "$file" ]]; then
        echo "ERROR: Cannot source file (not found): $file" >&2
        return 1
    fi

    if [[ ! -r "$file" ]]; then
        echo "ERROR: Cannot source file (not readable): $file" >&2
        return 1
    fi

    # shellcheck disable=SC1090
    source "$file"
}

# Export functions for use in scripts
export -f tetra_error_handler
export -f tetra_cleanup_handler
export -f tetra_exit_handler
export -f tetra_error_setup
export -f tetra_require_env
export -f tetra_validate_tetra_src
export -f tetra_require_command
export -f tetra_source_safe
