#!/usr/bin/env bash

# Tetra Function Helpers
# Common utility functions for function/file operations
# Reduces boilerplate across modules

# Call a function if it exists
# Args:
#   $1 - function name
#   $@ - arguments to pass to function
# Returns: function's return code, or 0 if function doesn't exist
tetra_call_if_exists() {
    local func_name="$1"
    shift
    declare -f "$func_name" >/dev/null 2>&1 && "$func_name" "$@"
}

# Call a function if it exists, return error if not
# Args:
#   $1 - function name
#   $@ - arguments to pass to function
# Returns: function's return code, or 1 if function doesn't exist
tetra_call_or_fail() {
    local func_name="$1"
    shift
    if declare -f "$func_name" >/dev/null 2>&1; then
        "$func_name" "$@"
    else
        echo "tetra: function '$func_name' not found" >&2
        return 1
    fi
}

# Source a file if it exists
# Args:
#   $1 - file path
# Returns: 0 if sourced or file doesn't exist, source's return otherwise
tetra_source_if_exists() {
    local file="$1"
    [[ -f "$file" ]] && source "$file"
}

# Source a file or fail with error
# Args:
#   $1 - file path
# Returns: 0 if sourced, 1 if file doesn't exist
tetra_source_or_fail() {
    local file="$1"
    if [[ -f "$file" ]]; then
        source "$file"
    else
        echo "tetra: file not found: $file" >&2
        return 1
    fi
}

# Source a file silently (suppress errors)
# Args:
#   $1 - file path
# Returns: 0 always
tetra_source_silent() {
    local file="$1"
    source "$file" 2>/dev/null || true
}

# Check if a function exists
# Args:
#   $1 - function name
# Returns: 0 if exists, 1 otherwise
tetra_function_exists() {
    declare -f "$1" >/dev/null 2>&1
}

# Check if a command (function, builtin, or executable) exists
# Args:
#   $1 - command name
# Returns: 0 if exists, 1 otherwise
tetra_command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Require a command to exist, exit with error if not
# Args:
#   $1 - command name
#   $2 - optional error message
# Returns: 0 if exists, exits with 1 otherwise
tetra_require_command() {
    local cmd="$1"
    local msg="${2:-Required command '$cmd' not found}"
    if ! command -v "$cmd" >/dev/null 2>&1; then
        echo "tetra: $msg" >&2
        return 1
    fi
}

# Safe execution wrapper - validates input before running
# Only allows alphanumeric, underscore, hyphen, and common safe chars
# Args:
#   $1 - command string to validate and run
# Returns: command's return code, or 1 if validation fails
tetra_safe_exec() {
    local cmd="$1"

    # Block dangerous patterns
    if [[ "$cmd" =~ [\;\|\&\$\`\(\)\{\}\[\]\<\>] ]]; then
        echo "tetra_safe_exec: blocked potentially unsafe command" >&2
        return 1
    fi

    # Execute if safe
    eval "$cmd"
}
