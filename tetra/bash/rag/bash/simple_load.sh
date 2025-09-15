#!/usr/bin/env bash
# Simple loader for debugging

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export RAG_TOOLS_DIR="$SCRIPT_DIR"
export RAG_DIR="$HOME/.rag"
mkdir -p "$RAG_DIR"

# Function to load RAG tools manually
rag_load_tools() {
    echo "=== Simple RAG Loader ==="
    echo "Loading rag_repl.sh..."
    source "$SCRIPT_DIR/rag_repl.sh"
    
    echo "Loading rag_cursor.sh..."
    source "$SCRIPT_DIR/rag_cursor.sh"
    
    echo "Loading rag_mcursor.sh..."
    source "$SCRIPT_DIR/rag_mcursor.sh"
    
    echo "Functions available:"
    declare -F | grep rag_repl
    echo "✓ RAG functions loaded"
}

# Do not automatically load tools
# To load, call rag_load_tools manually