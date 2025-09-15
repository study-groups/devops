#!/usr/bin/env bash
# tools.sh - Load RAG toolchain functions and utilities
# Source this file to get access to all bash functions

# Safe error handling
set -euo pipefail

# Logging function
rag_log() {
    local message="$1"
    echo "[RAG TOOLS DEBUG] $message" >&2
}

# Get the directory where this script is located
TOOLS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Source qa.sh for core functions
if [[ -f "$TOOLS_DIR/qa/qa.sh" ]]; then
    rag_log "Sourcing qa.sh"
    source "$TOOLS_DIR/qa/qa.sh"
else
    rag_log "Warning: qa/qa.sh not found in $TOOLS_DIR"
fi

# Source other bash function files if they exist
SPECIFIC_MODULES=(
    "$TOOLS_DIR/bash/rag_cursor.sh"
    "$TOOLS_DIR/bash/rag_mcursor.sh"
    "$TOOLS_DIR/bash/aliases.sh"
)

for func_file in "${SPECIFIC_MODULES[@]}"; do
    if [[ -f "$func_file" ]]; then
        rag_log "Sourcing: $func_file"
        source "$func_file"
    else
        rag_log "File not found: $func_file"
    fi
done

# Explicitly prevent auto-start of REPL
export RAG_REPL_AUTO_START=false

# No automatic messages or startup