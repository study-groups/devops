#!/usr/bin/env bash
# RAG Module Includes - Controls what gets loaded for RAG functionality

# Get the directory where this script is located
RAG_BASH_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Set RAG_SRC if not already set
if [ -z "$RAG_SRC" ]; then
    RAG_SRC="$(dirname "$RAG_BASH_DIR")"
fi

# Set RAG_DIR if not already set 
[ -z "$RAG_DIR" ] && RAG_DIR="$HOME/.rag"

# Create storage directory if it doesn't exist
[[ ! -d "$RAG_DIR" ]] && mkdir -p "$RAG_DIR"

# Load core RAG functionality
source "$RAG_BASH_DIR/rag_cursor.sh"
source "$RAG_BASH_DIR/rag_mcursor.sh" 
source "$RAG_BASH_DIR/rag_repl.sh"
source "$RAG_BASH_DIR/aliases.sh"

# Export RAG environment variables
export RAG_SRC RAG_DIR

echo "RAG module loaded successfully" >&2
