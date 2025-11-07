#!/usr/bin/env bash
# TCS 4.0 Logging Wrapper for self module

# Module name constant
SELF_MODULE_NAME="self"

# Source unified logging if available
if [[ -f "$TETRA_SRC/bash/utils/unified_log.sh" ]]; then
    source "$TETRA_SRC/bash/utils/unified_log.sh"
fi

# Logging convenience functions for self module
self_log_try() {
    local verb="$1"
    local subject="$2"
    local metadata="${3:-{}}"

    if type tetra_log_try &>/dev/null; then
        tetra_log_try "$SELF_MODULE_NAME" "$verb" "$subject" "$metadata"
    fi
}

self_log_success() {
    local verb="$1"
    local subject="$2"
    local metadata="${3:-{}}"

    if type tetra_log_success &>/dev/null; then
        tetra_log_success "$SELF_MODULE_NAME" "$verb" "$subject" "$metadata"
    fi
}

self_log_fail() {
    local verb="$1"
    local subject="$2"
    local metadata="${3:-{}}"

    if type tetra_log_fail &>/dev/null; then
        tetra_log_fail "$SELF_MODULE_NAME" "$verb" "$subject" "$metadata"
    fi
}

self_log_info() {
    local verb="$1"
    local subject="$2"
    local metadata="${3:-{}}"

    if type tetra_log_info &>/dev/null; then
        tetra_log_info "$SELF_MODULE_NAME" "$verb" "$subject" "$metadata"
    fi
}

self_log_warn() {
    local verb="$1"
    local subject="$2"
    local metadata="${3:-{}}"

    if type tetra_log_warn &>/dev/null; then
        tetra_log_warn "$SELF_MODULE_NAME" "$verb" "$subject" "$metadata"
    fi
}

self_log_error() {
    local verb="$1"
    local subject="$2"
    local metadata="${3:-{}}"

    if type tetra_log_error &>/dev/null; then
        tetra_log_error "$SELF_MODULE_NAME" "$verb" "$subject" "$metadata"
    fi
}

# Export functions
export -f self_log_try
export -f self_log_success
export -f self_log_fail
export -f self_log_info
export -f self_log_warn
export -f self_log_error
