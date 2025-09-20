#!/usr/bin/env bash
# RAG Module Includes - Controls what gets loaded for RAG functionality

# Follow tetra convention: MOD_DIR for data, MOD_SRC for source
RAG_DIR="${RAG_DIR:-$TETRA_DIR/rag}"
RAG_SRC="${RAG_SRC:-$TETRA_SRC/bash/rag}"

# Create storage directory if it doesn't exist
[[ ! -d "$RAG_DIR" ]] && mkdir -p "$RAG_DIR"

# Load core RAG functionality
source "$RAG_SRC/bash/rag_repl.sh"
source "$RAG_SRC/bash/rag_tools.sh"
source "$RAG_SRC/bash/aliases.sh"

# Export RAG environment variables
export RAG_SRC RAG_DIR

echo "RAG module loaded successfully" >&2
