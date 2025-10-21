#!/usr/bin/env bash

# RAG Logging Wrapper - TCS 4.0 Compliant
# Provides convenience functions for RAG module logging

# Ensure unified logging is loaded
if ! type tetra_log_event >/dev/null 2>&1; then
    source "${TETRA_SRC}/bash/utils/unified_log.sh"
fi

# === RAG LOGGING WRAPPERS ===

# Generic RAG log event
rag_log() {
    tetra_log_event rag "$@"
}

# RAG try events
rag_log_try() {
    local verb="$1"
    local subject="$2"
    local metadata="${3:-{}}"
    tetra_log_try rag "$verb" "$subject" "$metadata"
}

# RAG success events
rag_log_success() {
    local verb="$1"
    local subject="$2"
    local metadata="${3:-{}}"
    tetra_log_success rag "$verb" "$subject" "$metadata"
}

# RAG fail events
rag_log_fail() {
    local verb="$1"
    local subject="$2"
    local metadata="${3:-{}}"
    tetra_log_fail rag "$verb" "$subject" "$metadata"
}

# RAG info events
rag_log_info() {
    local verb="$1"
    local subject="$2"
    local metadata="${3:-{}}"
    tetra_log_info rag "$verb" "$subject" "$metadata"
}

# RAG debug events
rag_log_debug() {
    local verb="$1"
    local subject="$2"
    local metadata="${3:-{}}"
    tetra_log_debug rag "$verb" "$subject" "$metadata"
}

# RAG warning events
rag_log_warn() {
    local verb="$1"
    local subject="$2"
    local metadata="${3:-{}}"
    tetra_log_warn rag "$verb" "$subject" "$metadata"
}

# RAG error events
rag_log_error() {
    local verb="$1"
    local subject="$2"
    local metadata="${3:-{}}"
    tetra_log_error rag "$verb" "$subject" "$metadata"
}

# === RAG-SPECIFIC LOGGING ===

# Log a RAG query attempt
rag_log_query_try() {
    local query_hash="$1"
    local files_count="${2:-0}"
    local context_size="${3:-0}"

    local metadata=$(jq -n \
        --arg query_hash "$query_hash" \
        --argjson files_count "$files_count" \
        --argjson context_size "$context_size" \
        '{query_hash: $query_hash, files_count: $files_count, context_size: $context_size}')

    rag_log_try "query" "$query_hash" "$metadata"
}

# Log a RAG query success
rag_log_query_success() {
    local query_hash="$1"
    local agent="${2:-base}"
    local files_count="${3:-0}"
    local context_size="${4:-0}"

    local metadata=$(jq -n \
        --arg query_hash "$query_hash" \
        --arg agent "$agent" \
        --argjson files_count "$files_count" \
        --argjson context_size "$context_size" \
        '{query_hash: $query_hash, agent: $agent, files_count: $files_count, context_size: $context_size}')

    rag_log_success "query" "$query_hash" "$metadata"
}

# Log a RAG query failure
rag_log_query_fail() {
    local query_hash="$1"
    local error="${2:-unknown error}"

    local metadata=$(jq -n \
        --arg query_hash "$query_hash" \
        --arg error "$error" \
        '{query_hash: $query_hash, error: $error}')

    rag_log_fail "query" "$query_hash" "$metadata"
}

# Log evidence addition
rag_log_evidence_add() {
    local file_path="$1"
    local file_count="${2:-1}"

    local metadata=$(jq -n \
        --arg file_path "$file_path" \
        --argjson file_count "$file_count" \
        '{file_path: $file_path, file_count: $file_count}')

    rag_log_info "evidence-add" "$(basename "$file_path")" "$metadata"
}

# Log evidence removal
rag_log_evidence_remove() {
    local file_path="$1"
    local remaining_count="${2:-0}"

    local metadata=$(jq -n \
        --arg file_path "$file_path" \
        --argjson remaining_count "$remaining_count" \
        '{file_path: $file_path, remaining_count: $remaining_count}')

    rag_log_info "evidence-remove" "$(basename "$file_path")" "$metadata"
}

# Log agent selection
rag_log_agent_select() {
    local agent="$1"
    local reason="${2:-user selection}"

    local metadata=$(jq -n \
        --arg agent "$agent" \
        --arg reason "$reason" \
        '{agent: $agent, reason: $reason}')

    rag_log_info "agent-select" "$agent" "$metadata"
}

# === QUERY HELPERS ===

# Query RAG logs
rag_log_query() {
    tetra_log_query_module rag
}

# Query RAG queries
rag_log_query_queries() {
    tetra_log_query_module rag | jq -c 'select(.verb == "query")'
}

# Query RAG errors
rag_log_query_errors() {
    tetra_log_query_module rag | jq -c 'select(.status == "fail" or .level == "ERROR")'
}

# Query specific agent usage
rag_log_query_agent() {
    local agent="$1"
    tetra_log_query_module rag | jq -c --arg agent "$agent" 'select(.metadata.agent == $agent)'
}
