#!/usr/bin/env bash
# tools.sh - Utility tool commands (multicat, etc.)

: "${RAG_SRC:=$TETRA_SRC/bash/rag}"

# ============================================================================
# MULTICAT COMMANDS
# ============================================================================

rag_cmd_mc() {
    if command -v mc >/dev/null 2>&1; then
        mc "$@"
    else
        echo "Error: mc (multicat) not available" >&2
        echo "Source RAG aliases: source $RAG_SRC/bash/aliases.sh" >&2
    fi
}

rag_cmd_ms() {
    if command -v ms >/dev/null 2>&1; then
        ms "$@"
    else
        echo "Error: ms (multisplit) not available" >&2
    fi
}

rag_cmd_mi() {
    if command -v mi >/dev/null 2>&1; then
        mi "$@"
    else
        echo "Error: mi (mcinfo) not available" >&2
    fi
}

# Export functions
export -f rag_cmd_mc
export -f rag_cmd_ms
export -f rag_cmd_mi
