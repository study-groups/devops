#!/usr/bin/env bash
# deps.sh - Centralized dependency management for RAG module
#
# Provides lazy-loading and "source once" pattern to avoid redundant sourcing

: "${RAG_SRC:=$TETRA_SRC/bash/rag}"

# Track loaded modules
declare -g -A RAG_LOADED_MODULES

# Load a module once (source-once pattern)
rag_load_module() {
    local module="$1"
    local module_path="$RAG_SRC/core/${module}.sh"

    # Check if already loaded
    [[ -n "${RAG_LOADED_MODULES[$module]+x}" ]] && return 0

    # Check if file exists
    if [[ ! -f "$module_path" ]]; then
        echo "Warning: Module not found: $module_path" >&2
        return 1
    fi

    # Source the module
    source "$module_path"
    RAG_LOADED_MODULES[$module]=1
}

# Load multiple modules
rag_load_modules() {
    local module
    for module in "$@"; do
        rag_load_module "$module" || return $?
    done
}

# Lazy load flow manager
rag_require_flow_manager() {
    rag_load_module "flow_manager_ttm"
}

# Lazy load session manager
rag_require_session_manager() {
    rag_load_module "session_manager"
}

# Lazy load evidence manager
rag_require_evidence_manager() {
    rag_load_modules "flow_manager_ttm" "evidence_manager"
}

# Lazy load evidence selector
rag_require_evidence_selector() {
    rag_load_modules "flow_manager_ttm" "evidence_selector"
}

# Lazy load assembler
rag_require_assembler() {
    rag_load_modules "flow_manager_ttm" "assembler"
}

# Lazy load QA submit
rag_require_qa_submit() {
    rag_load_modules "flow_manager_ttm" "qa_submit"
}

# Lazy load KB manager
rag_require_kb_manager() {
    rag_load_modules "flow_manager_ttm" "kb_manager"
}

# Lazy load stats manager
rag_require_stats_manager() {
    rag_load_module "stats_manager" 2>/dev/null || true
}

# Export functions
export -f rag_load_module
export -f rag_load_modules
export -f rag_require_flow_manager
export -f rag_require_session_manager
export -f rag_require_evidence_manager
export -f rag_require_evidence_selector
export -f rag_require_assembler
export -f rag_require_qa_submit
export -f rag_require_kb_manager
export -f rag_require_stats_manager
