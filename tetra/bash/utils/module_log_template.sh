#!/usr/bin/env bash

# MODULE_NAME Logging Wrapper - TCS 4.0 Compliant
# Template for creating module-specific logging wrappers
#
# USAGE:
# 1. Copy this file to bash/MODULE_NAME/MODULE_NAME_log.sh
# 2. Replace MODULE_NAME with your module name (lowercase)
# 3. Add module-specific logging functions as needed
# 4. Source from your module's main file

# Ensure unified logging is loaded
if ! type tetra_log_event >/dev/null 2>&1; then
    source "${TETRA_SRC}/bash/utils/unified_log.sh"
fi

# === GENERIC MODULE LOGGING WRAPPERS ===
# Replace MODULE_NAME with your module name (e.g., tsm, rag, qa, tmod)

# Generic log event
MODULE_NAME_log() {
    tetra_log_event MODULE_NAME "$@"
}

# Try events
MODULE_NAME_log_try() {
    local verb="$1"
    local subject="$2"
    local metadata="${3:-{}}"
    tetra_log_try MODULE_NAME "$verb" "$subject" "$metadata"
}

# Success events
MODULE_NAME_log_success() {
    local verb="$1"
    local subject="$2"
    local metadata="${3:-{}}"
    tetra_log_success MODULE_NAME "$verb" "$subject" "$metadata"
}

# Fail events
MODULE_NAME_log_fail() {
    local verb="$1"
    local subject="$2"
    local metadata="${3:-{}}"
    tetra_log_fail MODULE_NAME "$verb" "$subject" "$metadata"
}

# Info events
MODULE_NAME_log_info() {
    local verb="$1"
    local subject="$2"
    local metadata="${3:-{}}"
    tetra_log_info MODULE_NAME "$verb" "$subject" "$metadata"
}

# Debug events
MODULE_NAME_log_debug() {
    local verb="$1"
    local subject="$2"
    local metadata="${3:-{}}"
    tetra_log_debug MODULE_NAME "$verb" "$subject" "$metadata"
}

# Warning events
MODULE_NAME_log_warn() {
    local verb="$1"
    local subject="$2"
    local metadata="${3:-{}}"
    tetra_log_warn MODULE_NAME "$verb" "$subject" "$metadata"
}

# Error events
MODULE_NAME_log_error() {
    local verb="$1"
    local subject="$2"
    local metadata="${3:-{}}"
    tetra_log_error MODULE_NAME "$verb" "$subject" "$metadata"
}

# === MODULE-SPECIFIC LOGGING FUNCTIONS ===
# Add your custom logging functions here
# Example:
#
# MODULE_NAME_log_operation_try() {
#     local operation_id="$1"
#     local params="$2"
#
#     local metadata=$(jq -n --arg params "$params" '{params: $params}')
#     MODULE_NAME_log_try "operation" "$operation_id" "$metadata"
# }
#
# MODULE_NAME_log_operation_success() {
#     local operation_id="$1"
#     local result="$2"
#
#     local metadata=$(jq -n --arg result "$result" '{result: $result}')
#     MODULE_NAME_log_success "operation" "$operation_id" "$metadata"
# }

# === QUERY HELPERS ===

# Query module logs
MODULE_NAME_log_query() {
    tetra_log_query_module MODULE_NAME
}

# Query module errors
MODULE_NAME_log_query_errors() {
    tetra_log_query_module MODULE_NAME | jq -c 'select(.status == "fail" or .level == "ERROR")'
}

# Query specific verb
MODULE_NAME_log_query_verb() {
    local verb="$1"
    tetra_log_query_module MODULE_NAME | jq -c --arg verb "$verb" 'select(.verb == $verb)'
}
