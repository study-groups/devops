#!/usr/bin/env bash
# TMC Error Handling Module
# Provides standardized error codes and reporting

# Error codes
declare -gr TMC_ERR_SUCCESS=0
declare -gr TMC_ERR_GENERAL=1
declare -gr TMC_ERR_INVALID_ARG=2
declare -gr TMC_ERR_FILE_NOT_FOUND=3
declare -gr TMC_ERR_BRIDGE_FAILED=4
declare -gr TMC_ERR_SOCKET_FAILED=5
declare -gr TMC_ERR_MAP_LOAD_FAILED=6
declare -gr TMC_ERR_INVALID_CC_VALUE=7
declare -gr TMC_ERR_LEARNING_ACTIVE=8
declare -gr TMC_ERR_NO_DEVICE=9
declare -gr TMC_ERR_PERMISSION_DENIED=10

# Error messages
declare -gA TMC_ERR_MESSAGES=(
    [$TMC_ERR_SUCCESS]="Success"
    [$TMC_ERR_GENERAL]="General error"
    [$TMC_ERR_INVALID_ARG]="Invalid argument"
    [$TMC_ERR_FILE_NOT_FOUND]="File not found"
    [$TMC_ERR_BRIDGE_FAILED]="MIDI bridge failed"
    [$TMC_ERR_SOCKET_FAILED]="Socket communication failed"
    [$TMC_ERR_MAP_LOAD_FAILED]="Map loading failed"
    [$TMC_ERR_INVALID_CC_VALUE]="Invalid CC value (must be 0-127)"
    [$TMC_ERR_LEARNING_ACTIVE]="Learning already in progress"
    [$TMC_ERR_NO_DEVICE]="No MIDI device available"
    [$TMC_ERR_PERMISSION_DENIED]="Permission denied"
)

# Logging levels
declare -gr TMC_LOG_ERROR=0
declare -gr TMC_LOG_WARN=1
declare -gr TMC_LOG_INFO=2
declare -gr TMC_LOG_DEBUG=3

# Current log level (default: INFO)
TMC_LOG_LEVEL=${TMC_LOG_LEVEL:-$TMC_LOG_INFO}

# Color codes for output
if [[ -t 2 ]]; then
    declare -gr TMC_COLOR_ERROR='\033[0;31m'
    declare -gr TMC_COLOR_WARN='\033[1;33m'
    declare -gr TMC_COLOR_INFO='\033[0;36m'
    declare -gr TMC_COLOR_DEBUG='\033[0;90m'
    declare -gr TMC_COLOR_RESET='\033[0m'
else
    declare -gr TMC_COLOR_ERROR=''
    declare -gr TMC_COLOR_WARN=''
    declare -gr TMC_COLOR_INFO=''
    declare -gr TMC_COLOR_DEBUG=''
    declare -gr TMC_COLOR_RESET=''
fi

# Error reporting function
tmc_error() {
    local error_code="${1:-$TMC_ERR_GENERAL}"
    local custom_message="${2:-}"

    local message="${TMC_ERR_MESSAGES[$error_code]:-Unknown error}"
    if [[ -n "$custom_message" ]]; then
        message="$message: $custom_message"
    fi

    echo -e "${TMC_COLOR_ERROR}ERROR [$error_code]:${TMC_COLOR_RESET} $message" >&2
    return "$error_code"
}

# Warning function
tmc_warn() {
    local message="$1"

    if [[ $TMC_LOG_LEVEL -ge $TMC_LOG_WARN ]]; then
        echo -e "${TMC_COLOR_WARN}WARN:${TMC_COLOR_RESET} $message" >&2
    fi
}

# Info function
tmc_info() {
    local message="$1"

    if [[ $TMC_LOG_LEVEL -ge $TMC_LOG_INFO ]]; then
        echo -e "${TMC_COLOR_INFO}INFO:${TMC_COLOR_RESET} $message" >&2
    fi
}

# Debug function
tmc_debug() {
    local message="$1"

    if [[ $TMC_LOG_LEVEL -ge $TMC_LOG_DEBUG ]]; then
        echo -e "${TMC_COLOR_DEBUG}DEBUG:${TMC_COLOR_RESET} $message" >&2
    fi
}

# Validation functions
tmc_validate_cc_value() {
    local value="$1"

    if [[ ! "$value" =~ ^[0-9]+$ ]]; then
        tmc_error $TMC_ERR_INVALID_CC_VALUE "Not a number: $value"
        return $TMC_ERR_INVALID_CC_VALUE
    fi

    if [[ "$value" -lt 0 ]] || [[ "$value" -gt 127 ]]; then
        tmc_error $TMC_ERR_INVALID_CC_VALUE "Out of range: $value (must be 0-127)"
        return $TMC_ERR_INVALID_CC_VALUE
    fi

    return $TMC_ERR_SUCCESS
}

tmc_validate_channel() {
    local channel="$1"

    if [[ ! "$channel" =~ ^[0-9]+$ ]]; then
        tmc_error $TMC_ERR_INVALID_ARG "Invalid channel: $channel (not a number)"
        return $TMC_ERR_INVALID_ARG
    fi

    if [[ "$channel" -lt 1 ]] || [[ "$channel" -gt 16 ]]; then
        tmc_error $TMC_ERR_INVALID_ARG "Invalid channel: $channel (must be 1-16)"
        return $TMC_ERR_INVALID_ARG
    fi

    return $TMC_ERR_SUCCESS
}

tmc_validate_controller() {
    local controller="$1"

    if [[ ! "$controller" =~ ^[0-9]+$ ]]; then
        tmc_error $TMC_ERR_INVALID_ARG "Invalid controller: $controller (not a number)"
        return $TMC_ERR_INVALID_ARG
    fi

    if [[ "$controller" -lt 0 ]] || [[ "$controller" -gt 127 ]]; then
        tmc_error $TMC_ERR_INVALID_ARG "Invalid controller: $controller (must be 0-127)"
        return $TMC_ERR_INVALID_ARG
    fi

    return $TMC_ERR_SUCCESS
}

tmc_validate_file() {
    local file="$1"

    if [[ ! -f "$file" ]]; then
        tmc_error $TMC_ERR_FILE_NOT_FOUND "$file"
        return $TMC_ERR_FILE_NOT_FOUND
    fi

    return $TMC_ERR_SUCCESS
}

tmc_validate_socket() {
    local socket="$1"

    if [[ ! -S "$socket" ]]; then
        tmc_error $TMC_ERR_SOCKET_FAILED "Socket not found: $socket"
        return $TMC_ERR_SOCKET_FAILED
    fi

    return $TMC_ERR_SUCCESS
}

# Sanitization functions
tmc_sanitize_name() {
    local name="$1"

    # Only allow alphanumeric, hyphens, underscores
    if [[ ! "$name" =~ ^[a-zA-Z0-9_-]+$ ]]; then
        tmc_error $TMC_ERR_INVALID_ARG "Invalid name: $name (only alphanumeric, -, _ allowed)"
        return $TMC_ERR_INVALID_ARG
    fi

    echo "$name"
    return $TMC_ERR_SUCCESS
}

# Error context for debugging
tmc_error_context() {
    local context="$1"
    echo "  Context: $context" >&2
    echo "  Function: ${FUNCNAME[2]}" >&2
    echo "  Line: ${BASH_LINENO[1]}" >&2
    echo "  File: ${BASH_SOURCE[2]}" >&2
}

# Trap errors in strict mode
tmc_enable_strict_mode() {
    set -euo pipefail
    trap 'tmc_error $TMC_ERR_GENERAL "Unhandled error in ${FUNCNAME[0]:-main} at line $LINENO"' ERR
}

# Check required dependencies
tmc_check_dependencies() {
    local deps=("$@")
    local missing=()

    for dep in "${deps[@]}"; do
        if ! command -v "$dep" &>/dev/null; then
            missing+=("$dep")
        fi
    done

    if [[ ${#missing[@]} -gt 0 ]]; then
        tmc_error $TMC_ERR_GENERAL "Missing dependencies: ${missing[*]}"
        return $TMC_ERR_GENERAL
    fi

    return $TMC_ERR_SUCCESS
}
