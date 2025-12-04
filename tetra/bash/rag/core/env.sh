#!/usr/bin/env bash
# env.sh - RAG Environment Variables
# Central configuration for all RAG environment variables

# ============================================================================
# CORE PATHS
# ============================================================================

# RAG source directory (where bash/rag lives)
: "${RAG_SRC:=$TETRA_SRC/bash/rag}"

# RAG data directory (where flows/sessions/kb live)
: "${RAG_DIR:=$TETRA_DIR/rag}"

# ============================================================================
# RAG SUBDIRECTORIES (following TCS 3.0 + TTM conventions)
# ============================================================================

# Database directory (flows, sessions, KB)
: "${RAG_DB_DIR:=$RAG_DIR/db}"

# Configuration directory
: "${RAG_CONFIG_DIR:=$RAG_DIR/config}"

# Logs directory
: "${RAG_LOGS_DIR:=$RAG_DIR/logs}"

# TTM transactions directory
: "${RAG_TXNS_DIR:=$RAG_DIR/txns}"

# Index directory (for search/retrieval)
: "${RAG_INDEX_DIR:=$RAG_DIR/index}"

# Chunks directory (for embeddings)
: "${RAG_CHUNKS_DIR:=$RAG_DIR/chunks}"

# ============================================================================
# FLOW SETTINGS
# ============================================================================

# Flow scope (local or global)
: "${RAG_SCOPE:=local}"

# ============================================================================
# HISTORY SETTINGS
# ============================================================================

# History file location
: "${RAG_HISTORY_FILE:=$TETRA_DIR/rag/history}"

# History size (number of entries to keep)
: "${RAG_HISTORY_SIZE:=1000}"

# ============================================================================
# MODULE STATE (internal use)
# ============================================================================

# Loaded modules tracking (associative array, initialized in deps.sh)
declare -gA RAG_LOADED_MODULES 2>/dev/null || true

# ============================================================================
# VALIDATION
# ============================================================================

rag_validate_env() {
    local errors=0

    # Check required globals
    if [[ -z "$TETRA_SRC" ]]; then
        echo "Error: TETRA_SRC not set" >&2
        ((errors++))
    fi

    if [[ -z "$TETRA_DIR" ]]; then
        echo "Error: TETRA_DIR not set" >&2
        ((errors++))
    fi

    # Verify RAG_SRC exists
    if [[ ! -d "$RAG_SRC" ]]; then
        echo "Error: RAG_SRC directory not found: $RAG_SRC" >&2
        ((errors++))
    fi

    # Verify critical subdirectories exist or can be created
    local required_dirs=("$RAG_DIR" "$RAG_DB_DIR" "$RAG_CONFIG_DIR")
    for dir in "${required_dirs[@]}"; do
        if [[ ! -d "$dir" ]]; then
            if ! mkdir -p "$dir" 2>/dev/null; then
                echo "Error: Cannot create directory: $dir" >&2
                ((errors++))
            fi
        fi
    done

    return $errors
}

# ============================================================================
# ENVIRONMENT INFO
# ============================================================================

rag_show_env() {
    cat <<EOF
RAG Environment Variables
═════════════════════════════════════════

Core Paths:
  RAG_SRC         = $RAG_SRC
  RAG_DIR         = $RAG_DIR

Subdirectories:
  RAG_DB_DIR      = $RAG_DB_DIR
  RAG_CONFIG_DIR  = $RAG_CONFIG_DIR
  RAG_LOGS_DIR    = $RAG_LOGS_DIR
  RAG_TXNS_DIR    = $RAG_TXNS_DIR
  RAG_INDEX_DIR   = $RAG_INDEX_DIR
  RAG_CHUNKS_DIR  = $RAG_CHUNKS_DIR

Flow Settings:
  RAG_SCOPE       = $RAG_SCOPE

History:
  RAG_HISTORY_FILE = $RAG_HISTORY_FILE
  RAG_HISTORY_SIZE = $RAG_HISTORY_SIZE

Global Dependencies:
  TETRA_SRC       = $TETRA_SRC
  TETRA_DIR       = $TETRA_DIR

EOF
}

# Export environment functions
export -f rag_validate_env
export -f rag_show_env

# Export all RAG environment variables
export RAG_SRC RAG_DIR
export RAG_DB_DIR RAG_CONFIG_DIR RAG_LOGS_DIR RAG_TXNS_DIR
export RAG_INDEX_DIR RAG_CHUNKS_DIR
export RAG_SCOPE
export RAG_HISTORY_FILE RAG_HISTORY_SIZE
